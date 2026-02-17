"""
SIE Exam For Dummies 题库解析脚本
从教材 txt 文件中提取练习题和模拟考试题目，输出结构化 JSON
"""
import re
import json
import sys
from pathlib import Path

# 章节到知识领域的映射
CHAPTER_CATEGORY = {
    5: "Securities Underwriting",
    6: "Equity Securities",
    7: "Debt Securities",
    8: "Municipal Bonds",
    9: "Packaged Securities",
    10: "DPPs and REITs",
    11: "Options",
    12: "Customer Accounts",
    13: "Securities Analysis",
    14: "Securities Markets",
    15: "Taxation",
    16: "Rules and Regulations",
    17: "Practice Exam 1",
    19: "Practice Exam 2",
}

CHAPTER_DIFFICULTY = {
    5: "medium", 6: "easy", 7: "medium", 8: "medium",
    9: "medium", 10: "hard", 11: "hard", 12: "medium",
    13: "medium", 14: "medium", 15: "hard", 16: "hard",
    17: "medium", 19: "medium",
}


def read_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    # 全局替换特殊字符
    text = text.replace('\u00ad', ' ')
    text = text.replace('\u00a0', ' ')
    return text


def clean_block(text: str, split_columns: bool = False) -> str:
    """清理页眉页脚和特殊字符"""
    # 替换 soft hyphen (U+00AD) 和其他特殊空白为普通空格
    text = text.replace('\u00ad', ' ')
    text = text.replace('\u00a0', ' ')
    text = re.sub(r'\n---\s*Page \d+\s*---\n', '\n', text)
    text = re.sub(r'\nCHAPTER \d+[^\n]*\n', '\n', text)
    text = re.sub(r'\n\d+ PART \d+[^\n]*\n', '\n', text)
    if split_columns:
        # 双列排版：在行中间的题号前插入换行
        text = re.sub(r'(?<=\S)\s+(\d+\.\s+[A-Z])', r'\n\1', text)
    return text


def parse_options(text: str) -> list:
    """从文本中提取 (A)-(D) 选项"""
    opts = re.split(r'(?:^|\n)\s*\(([A-D])\)\s*', text)
    options = []
    i = 1
    while i < len(opts) - 1:
        letter = opts[i]
        content = re.sub(r'\s+', ' ', opts[i + 1]).strip()
        options.append(f"({letter}) {content}")
        i += 2
    return options


def detect_type(stem: str) -> str:
    """检测题型"""
    if re.search(r'\bI{1,3}V?\b\.', stem) and re.search(r'\bII\b', stem):
        return "roman_numeral"
    return "single"


def find_chapter_at(text: str, pos: int) -> int:
    """根据位置向前查找最近的 CHAPTER 编号"""
    before = text[:pos]
    matches = list(re.finditer(r'CHAPTER (\d+)', before))
    if matches:
        return int(matches[-1].group(1))
    return 0


def extract_qa(q_block: str, ans_block: str, chapter: int, split_columns: bool = False) -> list:
    """从题目块和答案块中提取结构化题目"""
    questions = []
    q_block = clean_block(q_block, split_columns)
    ans_block = clean_block(ans_block)

    # 找所有题号位置，支持行首和行中（双列排版）
    q_dict = {}
    q_positions = []
    for m in re.finditer(r'(?:^|\n|\s)(\d+)\.\s+([A-Z])', q_block):
        num = int(m.group(1))
        q_positions.append((num, m.start()))

    # 去重并按位置排序
    seen = set()
    unique_positions = []
    for num, pos in q_positions:
        if num not in seen:
            seen.add(num)
            unique_positions.append((num, pos))

    for idx, (num, pos) in enumerate(unique_positions):
        end = unique_positions[idx + 1][1] if idx + 1 < len(unique_positions) else len(q_block)
        body = q_block[pos:end]
        # 去掉开头的题号
        body = re.sub(r'^\s*\d+\.\s+', '', body)
        q_dict[num] = body

    # 解析答案
    ans_dict = {}
    ans_parts = re.split(r'\n(\d+)\.\s+([A-D])\.?\s+', '\n' + ans_block)
    i = 1
    while i < len(ans_parts) - 2:
        num = int(ans_parts[i])
        letter = ans_parts[i + 1]
        expl = ans_parts[i + 2].strip()
        expl = re.sub(r'^\(Chapter \d+\)\s*', '', expl)
        expl = re.sub(r'\s+', ' ', expl).strip()
        ans_dict[num] = {"answer": letter, "explanation": expl}
        i += 3

    category = CHAPTER_CATEGORY.get(chapter, f"Chapter {chapter}")
    difficulty = CHAPTER_DIFFICULTY.get(chapter, "medium")

    for num in sorted(q_dict.keys()):
        body = q_dict[num]
        opt_start = re.search(r'\(A\)\s', body)
        if not opt_start:
            continue
        stem = re.sub(r'\s+', ' ', body[:opt_start.start()]).strip()
        options = parse_options(body[opt_start.start():])
        if len(options) < 2:
            continue
        ans_info = ans_dict.get(num, {"answer": "", "explanation": ""})
        questions.append({
            "chapter": chapter,
            "category": category,
            "type": detect_type(stem),
            "stem": stem,
            "options": options,
            "answer": ans_info["answer"],
            "explanation": ans_info["explanation"],
            "difficulty": difficulty,
        })
    return questions


def parse_chapter_practice(text: str) -> list:
    """解析所有章节末尾的练习题（直接在全文中搜索）"""
    all_qs = []
    # 找所有 "Practice questions" 出现的位置（排除目录区域，只取行号>500的）
    for m in re.finditer(r'^Practice questions$', text, re.MULTILINE):
        if m.start() < 2000:  # 跳过目录区域
            continue
        chapter = find_chapter_at(text, m.start())
        if chapter < 5 or chapter > 16:
            continue

        # 题目区域：从 "Practice questions" 到 "Answers and explanations"
        ans_header = re.search(r'^Answers and explanations$', text[m.end():], re.MULTILINE)
        if not ans_header:
            continue
        q_block = text[m.end():m.end() + ans_header.start()]

        # 答案区域：从 "Answers and explanations" 到下一个章节的 Practice/Testing 或真正的新章节
        ans_start = m.end() + ans_header.end()
        # 结束标记：下一个 "Practice questions" 或 "Testing Your Knowledge"
        # 注意：不用 CHAPTER 行作为结束标记，因为页眉也包含 CHAPTER
        ans_end_match = re.search(
            r'\n(?:Practice questions|Testing Your Knowledge)',
            text[ans_start:ans_start + 20000]
        )
        ans_end = ans_start + ans_end_match.start() if ans_end_match else min(ans_start + 20000, len(text))
        ans_block = text[ans_start:ans_end]

        qs = extract_qa(q_block, ans_block, chapter)
        print(f"Chapter {chapter}: {len(qs)} questions")
        all_qs.extend(qs)
    return all_qs


def parse_practice_exam(text: str, exam_ch: int, ans_ch: int) -> list:
    """解析模拟考试（双列排版特殊处理）"""
    exam_markers = list(re.finditer(r'^TIME:.*?75 questions$', text, re.MULTILINE))
    marker = exam_markers[0] if exam_ch == 17 and exam_markers else (
        exam_markers[1] if exam_ch == 19 and len(exam_markers) > 1 else None
    )
    if not marker:
        return []

    q_start = marker.end()
    ans_header = re.search(r'Answers and Explanations\s*\nto Practice Exam', text[q_start:])
    if not ans_header:
        return []
    q_block = text[q_start:q_start + ans_header.start()]

    a_start = q_start + ans_header.end()
    a_end_match = re.search(r'\nAnswer Key for Practice Exam', text[a_start:])
    a_end = a_start + a_end_match.start() if a_end_match else a_start + 30000
    ans_block = clean_block(text[a_start:a_end])

    # 解析答案（格式清晰，作为主要数据源）
    ans_dict = {}
    ans_parts = re.split(r'\n(\d+)\.\s+([A-D])\.?\s+', '\n' + ans_block)
    i = 1
    while i < len(ans_parts) - 2:
        num = int(ans_parts[i])
        letter = ans_parts[i + 1]
        expl = ans_parts[i + 2].strip()
        expl = re.sub(r'^\(Chapter \d+\)\s*', '', expl)
        expl = re.sub(r'\s+', ' ', expl).strip()
        ans_dict[num] = {"answer": letter, "explanation": expl}
        i += 3

    # 尝试从题目区域提取题干和选项
    q_block = clean_block(q_block, split_columns=True)
    q_positions = []
    seen = set()
    for m in re.finditer(r'(?:^|\n|\s)(\d+)\.\s+([A-Z])', q_block):
        num = int(m.group(1))
        if num not in seen and 1 <= num <= 75:
            seen.add(num)
            q_positions.append((num, m.start()))

    q_dict = {}
    for idx, (num, pos) in enumerate(q_positions):
        end = q_positions[idx + 1][1] if idx + 1 < len(q_positions) else len(q_block)
        body = q_block[pos:end]
        body = re.sub(r'^\s*\d+\.\s+', '', body)
        q_dict[num] = body

    # 组装所有 75 题
    questions = []
    category = CHAPTER_CATEGORY.get(exam_ch, f"Chapter {exam_ch}")
    difficulty = CHAPTER_DIFFICULTY.get(exam_ch, "medium")

    for num in range(1, 76):
        ans_info = ans_dict.get(num, {"answer": "", "explanation": ""})
        body = q_dict.get(num, "")
        stem = ""
        options = []

        if body:
            opt_start = re.search(r'\(A\)\s', body)
            if opt_start:
                stem = re.sub(r'\s+', ' ', body[:opt_start.start()]).strip()
                options = parse_options(body[opt_start.start():])
            if not stem:
                stem = re.sub(r'\s+', ' ', body).strip()

        if not stem:
            stem = f"(Question {num} - see explanation)"

        questions.append({
            "chapter": exam_ch,
            "category": category,
            "type": detect_type(stem),
            "stem": stem,
            "options": options if len(options) >= 2 else [],
            "answer": ans_info["answer"],
            "explanation": ans_info["explanation"],
            "difficulty": difficulty,
        })

    return questions


def main():
    txt_path = Path(__file__).parent.parent.parent / "exam" / "SIE_Exam_For_Dummies.txt"
    if not txt_path.exists():
        print(f"Error: {txt_path} not found")
        sys.exit(1)

    text = read_file(str(txt_path))
    all_questions = []

    # 1. 解析各章节练习题 (Chapter 5-16)
    qs = parse_chapter_practice(text)
    all_questions.extend(qs)

    # 2. 解析 Practice Exam 1 (Ch17 + Ch18)
    qs1 = parse_practice_exam(text, 17, 18)
    print(f"Practice Exam 1: {len(qs1)} questions")
    all_questions.extend(qs1)

    # 3. 解析 Practice Exam 2 (Ch19 + Ch20)
    qs2 = parse_practice_exam(text, 19, 20)
    print(f"Practice Exam 2: {len(qs2)} questions")
    all_questions.extend(qs2)

    print(f"\nTotal: {len(all_questions)} questions")

    # 输出 JSON
    out_path = Path(__file__).parent / "questions.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)
    print(f"Output: {out_path}")


if __name__ == "__main__":
    main()

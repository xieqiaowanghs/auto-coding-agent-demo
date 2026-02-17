"""
SIE Exam For Dummies Glossary 解析脚本
从教材 txt 文件中提取术语表，输出结构化 JSON
"""
import re
import json
import sys
from pathlib import Path


def read_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    text = text.replace('\u00ad', ' ')
    text = text.replace('\u00a0', ' ')
    return text


def parse_glossary(text: str) -> list:
    """解析 Glossary 部分"""
    lines = text.split('\n')

    # 找 Glossary 正文起始（跳过目录，找独立的 "Glossary" 行）
    start_idx = 0
    for i, line in enumerate(lines):
        if line.strip() == 'Glossary' and i > 1000:
            start_idx = i + 1
            break

    # 找结束：Index 部分
    end_idx = len(lines)
    for i in range(start_idx, len(lines)):
        if lines[i].strip() == 'Index':
            end_idx = i
            break

    # 清理并合并行
    clean_lines = []
    for line in lines[start_idx:end_idx]:
        s = line.strip()
        # 跳过页眉页脚
        if not s or s.startswith('---') or re.match(r'^Glossary\s+\d+$', s):
            if clean_lines and clean_lines[-1] != '':
                clean_lines.append('')
            continue
        clean_lines.append(s)

    # 解析术语：格式为 "Term: Definition..."
    # 术语行特征：包含冒号，冒号前是术语名
    flashcards = []
    current_term = None
    current_def = []

    for line in clean_lines:
        if not line:
            # 空行：保存当前术语
            if current_term and current_def:
                flashcards.append({
                    "term": current_term,
                    "definition": ' '.join(current_def),
                    "familiarity_level": "unknown",
                })
                current_term = None
                current_def = []
            continue

        # 检查是否是新术语行（包含冒号且冒号前的部分像术语名）
        colon_match = re.match(r'^([^:]+):\s*(.*)$', line)
        if colon_match:
            term_part = colon_match.group(1).strip()
            def_part = colon_match.group(2).strip()

            # 判断是否是新术语（术语名通常以大写或数字开头，长度适中）
            if (len(term_part) < 100
                    and (term_part[0].isupper() or term_part[0].isdigit())
                    and not term_part.startswith('1.')
                    and not term_part.startswith('2.')):
                # 保存上一个术语
                if current_term and current_def:
                    flashcards.append({
                        "term": current_term,
                        "definition": ' '.join(current_def),
                        "familiarity_level": "unknown",
                    })
                current_term = term_part
                current_def = [def_part] if def_part else []
                continue

        # 续行：追加到当前定义
        if current_term is not None:
            current_def.append(line)

    # 保存最后一个术语
    if current_term and current_def:
        flashcards.append({
            "term": current_term,
            "definition": ' '.join(current_def),
            "familiarity_level": "unknown",
        })

    return flashcards

def main():
    txt_path = Path(__file__).parent.parent.parent / "exam" / "SIE_Exam_For_Dummies.txt"
    if not txt_path.exists():
        print(f"Error: {txt_path} not found")
        sys.exit(1)

    text = read_file(str(txt_path))
    flashcards = parse_glossary(text)
    print(f"Total flashcards: {len(flashcards)}")

    if flashcards:
        print(f"First: {flashcards[0]['term']}")
        print(f"Last: {flashcards[-1]['term']}")

    out_path = Path(__file__).parent / "flashcards.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(flashcards, f, ensure_ascii=False, indent=2)
    print(f"Output: {out_path}")


if __name__ == "__main__":
    main()

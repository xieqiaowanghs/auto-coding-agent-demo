/**
 * 数据库集合 TypeScript 类型定义
 */

/** 题目类型 */
export type QuestionType = 'single' | 'roman_numeral';

/** 题目难度 */
export type Difficulty = 'easy' | 'medium' | 'hard';

/** 题目 */
export interface Question {
  _id?: string;
  /** 章节编号 */
  chapter: number;
  /** 知识领域分类 */
  category: string;
  /** 题型 */
  type: QuestionType;
  /** 题干 */
  stem: string;
  /** 选项列表 */
  options: string[];
  /** 正确答案（选项索引或字母） */
  answer: string;
  /** 答案解析 */
  explanation: string;
  /** 难度 */
  difficulty: Difficulty;
}

/** 用户做题记录 */
export interface UserRecord {
  _id?: string;
  /** 用户 openid */
  user_id: string;
  /** 题目 ID */
  question_id: string;
  /** 用户选择的答案 */
  selected_answer: string;
  /** 是否正确 */
  is_correct: boolean;
  /** 创建时间 */
  created_at: Date;
}

/** 用户收藏 */
export interface UserFavorite {
  _id?: string;
  /** 用户 openid */
  user_id: string;
  /** 题目 ID */
  question_id: string;
  /** 自定义标签（如：重点、易错、公式题） */
  tag: string;
  /** 创建时间 */
  created_at: Date;
}

/** 用户错题 */
export interface UserMistake {
  _id?: string;
  /** 用户 openid */
  user_id: string;
  /** 题目 ID */
  question_id: string;
  /** 错误次数 */
  wrong_count: number;
  /** 最近一次做错时间 */
  last_wrong_at: Date;
  /** 是否已掌握（连续答对3次） */
  mastered: boolean;
}

/** 模拟考试答题记录 */
export interface MockExamAnswer {
  question_id: string;
  selected_answer: string;
  is_correct: boolean;
}

/** 模拟考试 */
export interface MockExam {
  _id?: string;
  /** 用户 openid */
  user_id: string;
  /** 得分 */
  score: number;
  /** 总题数 */
  total: number;
  /** 用时（秒） */
  duration: number;
  /** 答题详情 */
  answers: MockExamAnswer[];
  /** 创建时间 */
  created_at: Date;
}

/** 熟悉度等级 */
export type FamiliarityLevel = 'unknown' | 'fuzzy' | 'known';

/** 术语卡片 */
export interface Flashcard {
  _id?: string;
  /** 术语 */
  term: string;
  /** 定义 */
  definition: string;
  /** 熟悉度 */
  familiarity_level: FamiliarityLevel;
  /** 下次复习时间 */
  next_review_at: Date;
}

/** 每日统计 */
export interface DailyStat {
  _id?: string;
  /** 用户 openid */
  user_id: string;
  /** 日期（YYYY-MM-DD） */
  date: string;
  /** 当日做题总数 */
  total_count: number;
  /** 当日答对数 */
  correct_count: number;
  /** 学习时长（分钟） */
  study_minutes: number;
}

/** 集合名称常量 */
export const COLLECTIONS = {
  QUESTIONS: 'questions',
  USER_RECORDS: 'user_records',
  USER_FAVORITES: 'user_favorites',
  USER_MISTAKES: 'user_mistakes',
  MOCK_EXAMS: 'mock_exams',
  FLASHCARDS: 'flashcards',
  DAILY_STATS: 'daily_stats',
} as const;
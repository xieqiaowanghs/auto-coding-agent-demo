/**
 * 刷题逻辑和状态管理
 */
import { reactive } from 'vue';
import { db } from './cloud';
import { getUserId } from '@/store/user';
import { COLLECTIONS } from '@/types/database';
import type { Question } from '@/types/database';

export interface PracticeState {
  questions: Question[];
  currentIndex: number;
  selectedAnswer: string;
  submitted: boolean;
  favorites: Set<string>;
  mode: string;
}

const state = reactive<PracticeState>({
  questions: [],
  currentIndex: 0,
  selectedAnswer: '',
  submitted: false,
  favorites: new Set(),
  mode: '',
});

/** 初始化练习 */
export function initPractice(questions: Question[], mode: string, startIndex = 0) {
  state.questions = questions;
  state.currentIndex = startIndex;
  state.selectedAnswer = '';
  state.submitted = false;
  state.mode = mode;
}

/** 获取当前题目 */
export function currentQuestion(): Question | null {
  return state.questions[state.currentIndex] || null;
}

/** 保存做题进度到本地 */
export function saveProgress(chapter: number, index?: number) {
  const key = `practice_progress_ch${chapter}`;
  uni.setStorageSync(key, index !== undefined ? index : state.currentIndex);
}

/** 读取做题进度 */
export function loadProgress(chapter: number): number {
  const key = `practice_progress_ch${chapter}`;
  return uni.getStorageSync(key) || 0;
}

/** 随机打乱数组 */
export function shuffleQuestions(questions: Question[]): Question[] {
  const arr = [...questions];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 选择答案 */
export function selectAnswer(answer: string) {
  if (!state.submitted) {
    state.selectedAnswer = answer;
  }
}

/** 提交答案并记录 */
export async function submitAnswer(): Promise<boolean> {
  const q = currentQuestion();
  if (!q || state.submitted || !state.selectedAnswer) return false;

  state.submitted = true;
  const isCorrect = state.selectedAnswer === q.answer;
  const userId = getUserId();

  if (userId && q._id) {
    try {
      // 写入做题记录
      await db.add(COLLECTIONS.USER_RECORDS, {
        user_id: userId,
        question_id: q._id,
        selected_answer: state.selectedAnswer,
        is_correct: isCorrect,
        created_at: db.serverDate(),
      });

      // 错题写入 user_mistakes
      if (!isCorrect) {
        const existing = await db.get(COLLECTIONS.USER_MISTAKES, {
          user_id: userId,
          question_id: q._id,
        });
        if (existing.length > 0) {
          await db.update(COLLECTIONS.USER_MISTAKES, existing[0]._id!, {
            wrong_count: db.command().inc(1),
            last_wrong_at: db.serverDate(),
            mastered: false,
          });
        } else {
          await db.add(COLLECTIONS.USER_MISTAKES, {
            user_id: userId,
            question_id: q._id,
            wrong_count: 1,
            last_wrong_at: db.serverDate(),
            mastered: false,
          });
        }
      } else {
        // 答对：检查是否连续答对 3 次，标记为已掌握
        const existing = await db.get(COLLECTIONS.USER_MISTAKES, {
          user_id: userId,
          question_id: q._id,
        });
        if (existing.length > 0 && !existing[0].mastered) {
          // 查最近 3 次做题记录
          const recent = await db.collection(COLLECTIONS.USER_RECORDS)
            .where({ user_id: userId, question_id: q._id })
            .orderBy('created_at', 'desc')
            .limit(3)
            .get();
          const allCorrect = recent.data.length >= 3
            && recent.data.every((r: any) => r.is_correct);
          if (allCorrect) {
            await db.update(COLLECTIONS.USER_MISTAKES, existing[0]._id!, {
              mastered: true,
            });
          }
        }
      }

      // 更新每日统计
      await updateDailyStats(userId, isCorrect);
    } catch (e) {
      console.error('记录答题失败:', e);
    }
  }

  return isCorrect;
}

async function updateDailyStats(userId: string, isCorrect: boolean) {
  const today = getToday();
  try {
    const existing = await db.get(COLLECTIONS.DAILY_STATS, {
      user_id: userId,
      date: today,
    });
    if (existing.length > 0) {
      const updates: any = { total_count: db.command().inc(1) };
      if (isCorrect) updates.correct_count = db.command().inc(1);
      await db.update(COLLECTIONS.DAILY_STATS, existing[0]._id!, updates);
    } else {
      await db.add(COLLECTIONS.DAILY_STATS, {
        user_id: userId,
        date: today,
        total_count: 1,
        correct_count: isCorrect ? 1 : 0,
        study_minutes: 0,
      });
    }
  } catch (e) {
    console.error('更新每日统计失败:', e);
  }
}

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 下一题 */
export function nextQuestion() {
  if (state.currentIndex < state.questions.length - 1) {
    state.currentIndex++;
    state.selectedAnswer = '';
    state.submitted = false;
  }
}

/** 上一题 */
export function prevQuestion() {
  if (state.currentIndex > 0) {
    state.currentIndex--;
    state.selectedAnswer = '';
    state.submitted = false;
  }
}

/** 跳转到指定题目 */
export function goToQuestion(index: number) {
  if (index >= 0 && index < state.questions.length) {
    state.currentIndex = index;
    state.selectedAnswer = '';
    state.submitted = false;
  }
}

/** 切换收藏 */
export async function toggleFavorite() {
  const q = currentQuestion();
  const userId = getUserId();
  if (!q?._id || !userId) return;

  if (state.favorites.has(q._id)) {
    state.favorites.delete(q._id);
    try {
      const existing = await db.get(COLLECTIONS.USER_FAVORITES, {
        user_id: userId,
        question_id: q._id,
      });
      if (existing.length > 0) {
        await db.remove(COLLECTIONS.USER_FAVORITES, existing[0]._id!);
      }
    } catch (e) {
      console.error('取消收藏失败:', e);
    }
  } else {
    state.favorites.add(q._id);
    try {
      await db.add(COLLECTIONS.USER_FAVORITES, {
        user_id: userId,
        question_id: q._id,
        tag: '',
        created_at: db.serverDate(),
      });
    } catch (e) {
      console.error('收藏失败:', e);
    }
  }
}

/** 加载用户收藏列表 */
export async function loadFavorites() {
  const userId = getUserId();
  if (!userId) return;
  try {
    const res = await db.get(COLLECTIONS.USER_FAVORITES, { user_id: userId });
    state.favorites = new Set(res.map((r: any) => r.question_id));
  } catch (e) {
    console.error('加载收藏失败:', e);
  }
}

export default state;

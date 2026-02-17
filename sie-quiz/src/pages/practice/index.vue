<template>
  <view class="page">
    <!-- 顶部进度条 -->
    <view class="progress-header">
      <text class="progress-text">{{ state.currentIndex + 1 }} / {{ state.questions.length }}</text>
      <view class="progress-bar">
        <view class="progress-fill" :style="{ width: progressPercent + '%' }"></view>
      </view>
    </view>

    <view class="question-area" v-if="question">
      <!-- 题干 -->
      <scroll-view scroll-y class="stem-scroll">
        <text class="stem-text">{{ question.stem }}</text>
      </scroll-view>

      <!-- 选项列表 -->
      <view class="options">
        <view v-for="(opt, idx) in question.options" :key="idx"
              :class="optionClass(opt)" @click="onSelectOption(opt)">
          <text class="option-text">{{ opt }}</text>
        </view>
      </view>

      <!-- 提交按钮 -->
      <view class="submit-btn" v-if="!state.submitted && state.selectedAnswer" @click="onSubmit">
        <text>提交答案</text>
      </view>

      <!-- 答案解析 -->
      <view class="explanation" v-if="state.submitted">
        <view :class="['result-tag', isCorrect ? 'correct' : 'wrong']">
          <text>{{ isCorrect ? '回答正确' : '回答错误' }}</text>
        </view>
        <text class="correct-answer" v-if="!isCorrect">正确答案: ({{ question.answer }})</text>
        <text class="explanation-text" v-if="question.explanation">{{ question.explanation }}</text>
      </view>
    </view>

    <!-- 底部导航 -->
    <view class="bottom-nav">
      <view class="nav-btn" @click="onPrev">
        <text>上一题</text>
      </view>
      <view class="nav-btn fav-btn" @click="onToggleFavorite">
        <text>{{ isFavorited ? '★' : '☆' }}</text>
      </view>
      <view class="nav-btn" @click="onNext">
        <text>{{ isLast ? '完成' : '下一题' }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { db } from '@/utils/cloud';
import { getUserId } from '@/store/user';
import { COLLECTIONS } from '@/types/database';
import type { Question } from '@/types/database';
import practiceState, {
  initPractice, selectAnswer, submitAnswer,
  nextQuestion, prevQuestion, toggleFavorite, loadFavorites,
  currentQuestion, saveProgress, loadProgress, shuffleQuestions,
} from '@/utils/practice';

const state = practiceState;

const question = computed(() => currentQuestion());
const progressPercent = computed(() => {
  if (state.questions.length === 0) return 0;
  return Math.round(((state.currentIndex + 1) / state.questions.length) * 100);
});
const isCorrect = computed(() => state.submitted && state.selectedAnswer === question.value?.answer);
const isLast = computed(() => state.currentIndex >= state.questions.length - 1);
const isFavorited = computed(() => {
  const q = question.value;
  return q?._id ? state.favorites.has(q._id) : false;
});

function optionClass(opt: string) {
  const letter = opt.match(/^\(([A-D])\)/)?.[1] || '';
  const classes = ['option-item'];
  if (state.submitted) {
    if (letter === question.value?.answer) classes.push('correct');
    else if (letter === state.selectedAnswer) classes.push('wrong');
  } else if (letter === state.selectedAnswer) {
    classes.push('selected');
  }
  return classes;
}

function onSelectOption(opt: string) {
  const letter = opt.match(/^\(([A-D])\)/)?.[1] || '';
  if (letter) selectAnswer(letter);
}

async function onSubmit() {
  await submitAnswer();
}

function onPrev() {
  prevQuestion();
}

function onNext() {
  if (isLast.value) {
    // 顺序练习完成后清除进度
    if (state.mode === 'chapter') {
      const q = state.questions[0];
      if (q) saveProgress(q.chapter, 0);
    }
    // 每日一练完成后标记
    if (state.mode === 'daily') {
      markDailyComplete();
    }
    uni.showToast({ title: '练习完成!', icon: 'success' });
    setTimeout(() => uni.navigateBack(), 1500);
    return;
  }
  nextQuestion();
  // 保存顺序练习进度
  if (state.mode === 'chapter' && state.questions[0]) {
    saveProgress(state.questions[0].chapter, state.currentIndex);
  }
}

async function markDailyComplete() {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  uni.setStorageSync('daily_complete_date', dateStr);
}

function onToggleFavorite() {
  toggleFavorite();
}

async function loadQuestions(options: any) {
  const mode = options.mode || 'chapter';
  const chapter = Number(options.chapter) || 0;
  const category = decodeURIComponent(options.category || '');
  const keyword = decodeURIComponent(options.keyword || '');
  const count = Number(options.count) || 0;

  uni.showLoading({ title: '加载题目...' });
  try {
    let questions: Question[] = [];
    const col = db.collection(COLLECTIONS.QUESTIONS);

    if (mode === 'chapter' && chapter) {
      const res = await col.where({ chapter }).orderBy('_id', 'asc').limit(100).get();
      questions = res.data as Question[];
    } else if (mode === 'category' && category) {
      const res = await col.where({ category }).limit(100).get();
      questions = res.data as Question[];
    } else if (mode === 'search' && keyword) {
      const res = await col.where({ stem: { $regex: keyword, $options: 'i' } }).limit(50).get();
      questions = res.data as Question[];
    } else if (mode === 'random') {
      // 随机练习：支持按章节/分类筛选 + 数量限制
      const where: any = {};
      if (chapter) where.chapter = chapter;
      if (category) where.category = category;
      const res = await col.where(where).limit(200).get();
      questions = shuffleQuestions(res.data as Question[]);
      if (count > 0) questions = questions.slice(0, count);
    } else if (mode === 'daily') {
      // 每日一练：智能选题，优先薄弱知识点和错题
      const dailyCount = Number(options.count) || uni.getStorageSync('daily_count') || 20;
      const userId = getUserId();
      let questions_pool: Question[] = [];

      // 1. 优先从错题中抽取（未掌握）
      if (userId) {
        try {
          const mistakeRes = await db.collection(COLLECTIONS.USER_MISTAKES)
            .where({ user_id: userId, mastered: false })
            .orderBy('wrong_count', 'desc')
            .limit(50)
            .get();
          for (const m of mistakeRes.data as any[]) {
            try {
              const qRes = await col.doc(m.question_id).get();
              if (qRes.data) questions_pool.push(qRes.data as unknown as Question);
            } catch { /* skip */ }
          }
        } catch { /* skip */ }
      }

      // 2. 补充随机题目凑够数量
      if (questions_pool.length < dailyCount) {
        const existIds = new Set(questions_pool.map(q => q._id));
        const res = await col.limit(200).get();
        const extra = shuffleQuestions(res.data as Question[]).filter(q => !existIds.has(q._id));
        questions_pool = [...questions_pool, ...extra];
      }

      questions = shuffleQuestions(questions_pool).slice(0, dailyCount);
    } else if (mode === 'weakness') {
      // 薄弱知识点专项练习
      const chapters = (options.chapters || '').split(',').map(Number).filter(Boolean);
      if (chapters.length > 0) {
        for (const ch of chapters) {
          const res = await col.where({ chapter: ch }).limit(50).get();
          questions.push(...(res.data as Question[]));
        }
        questions = shuffleQuestions(questions);
      }
    } else if (mode === 'mistakes') {
      // 错题重练：从 user_mistakes 获取未掌握的错题 ID，再查题目
      const userId = getUserId();
      const where: any = { user_id: userId, mastered: false };
      if (chapter) where.chapter = chapter;
      const mistakeRes = await db.collection(COLLECTIONS.USER_MISTAKES)
        .where(where)
        .orderBy('wrong_count', 'desc')
        .limit(100)
        .get();
      const qIds = mistakeRes.data.map((m: any) => m.question_id);
      if (qIds.length > 0) {
        for (const qId of qIds) {
          const qRes = await col.doc(qId).get();
          if (qRes.data) questions.push(qRes.data as unknown as Question);
        }
      }
    } else if (mode === 'favorites') {
      // 收藏练习：从 user_favorites 获取收藏题目 ID
      const userId = getUserId();
      const favRes = await db.collection(COLLECTIONS.USER_FAVORITES)
        .where({ user_id: userId })
        .limit(100)
        .get();
      const qIds = favRes.data.map((f: any) => f.question_id);
      if (qIds.length > 0) {
        for (const qId of qIds) {
          const qRes = await col.doc(qId).get();
          if (qRes.data) questions.push(qRes.data as unknown as Question);
        }
      }
    }

    if (questions.length === 0) {
      uni.showToast({ title: '暂无题目', icon: 'none' });
      return;
    }

    // 顺序练习模式：恢复上次进度
    let startIndex = 0;
    if (mode === 'chapter' && chapter) {
      startIndex = loadProgress(chapter);
      if (startIndex >= questions.length) startIndex = 0;
    }

    initPractice(questions, mode, startIndex);
    await loadFavorites();
  } catch (e) {
    console.error('加载题目失败:', e);
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    uni.hideLoading();
  }
}

onLoad((options) => {
  loadQuestions(options || {});
});
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #f5f5f5;
}
.progress-header {
  padding: 20rpx 30rpx;
  background: #fff;
}
.progress-text {
  font-size: 24rpx;
  color: #666;
  display: block;
  margin-bottom: 10rpx;
}
.progress-bar {
  height: 6rpx;
  background: #eee;
  border-radius: 3rpx;
}
.progress-fill {
  height: 100%;
  background: #2B5BA3;
  border-radius: 3rpx;
}
.question-area {
  flex: 1;
  padding: 30rpx;
}
.stem-scroll {
  max-height: 300rpx;
  margin-bottom: 30rpx;
}
.stem-text {
  font-size: 32rpx;
  color: #333;
  line-height: 1.6;
}
.option-item {
  background: #fff;
  border: 2rpx solid #e8e8e8;
  border-radius: 12rpx;
  padding: 28rpx 30rpx;
  margin-bottom: 16rpx;
}
.option-item.selected {
  border-color: #2B5BA3;
  background: rgba(43,91,163,0.05);
}
.option-item.correct {
  border-color: #4CAF50;
  background: rgba(76,175,80,0.08);
}
.option-item.wrong {
  border-color: #F44336;
  background: rgba(244,67,54,0.08);
}
.option-text {
  font-size: 28rpx;
  color: #333;
  line-height: 1.5;
}
.submit-btn {
  background: #2B5BA3;
  color: #fff;
  text-align: center;
  padding: 28rpx;
  border-radius: 12rpx;
  margin-top: 20rpx;
  font-size: 30rpx;
}
.explanation {
  background: #fff;
  border-radius: 12rpx;
  padding: 30rpx;
  margin-top: 24rpx;
}
.result-tag {
  display: inline-block;
  padding: 8rpx 24rpx;
  border-radius: 8rpx;
  font-size: 26rpx;
  margin-bottom: 16rpx;
}
.result-tag.correct {
  background: rgba(76,175,80,0.1);
  color: #4CAF50;
}
.result-tag.wrong {
  background: rgba(244,67,54,0.1);
  color: #F44336;
}
.correct-answer {
  display: block;
  font-size: 28rpx;
  color: #4CAF50;
  margin-bottom: 16rpx;
}
.explanation-text {
  font-size: 26rpx;
  color: #666;
  line-height: 1.6;
  display: block;
}
.bottom-nav {
  display: flex;
  background: #fff;
  padding: 20rpx 30rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -2rpx 12rpx rgba(0,0,0,0.08);
}
.nav-btn {
  flex: 1;
  text-align: center;
  padding: 20rpx;
  font-size: 28rpx;
  color: #333;
}
.fav-btn {
  font-size: 40rpx;
  color: #FFB300;
}
</style>

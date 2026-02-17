<template>
  <view class="page">
    <!-- 顶部：倒计时 + 进度 -->
    <view class="exam-header">
      <text class="timer" :class="{ warning: remainSeconds < 600 }">{{ timerText }}</text>
      <text class="progress-text">{{ currentIdx + 1 }} / {{ questions.length }}</text>
    </view>

    <view class="question-area" v-if="currentQ">
      <scroll-view scroll-y class="stem-scroll">
        <text class="stem-text">{{ currentQ.stem }}</text>
      </scroll-view>

      <view class="options">
        <view v-for="(opt, idx) in currentQ.options" :key="idx"
              :class="['option-item', getOptionLetter(opt) === answers[currentIdx] && 'selected',
                        marked[currentIdx] && 'marked-border']"
              @click="selectOption(opt)">
          <text class="option-text">{{ opt }}</text>
        </view>
      </view>
    </view>

    <!-- 底部导航 -->
    <view class="bottom-nav">
      <view class="nav-btn" @click="prev"><text>上一题</text></view>
      <view class="nav-btn mark-btn" @click="toggleMark">
        <text>{{ marked[currentIdx] ? '取消标记' : '标记回顾' }}</text>
      </view>
      <view class="nav-btn" @click="next">
        <text>{{ currentIdx >= questions.length - 1 ? '交卷' : '下一题' }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { db } from '@/utils/cloud';
import { getUserId } from '@/store/user';
import { COLLECTIONS } from '@/types/database';
import { shuffleQuestions } from '@/utils/practice';
import type { Question } from '@/types/database';

const TOTAL_TIME = 105 * 60; // 105 minutes in seconds
const TOTAL_QUESTIONS = 75;

const questions = ref<Question[]>([]);
const currentIdx = ref(0);
const answers = ref<Record<number, string>>({});
const marked = ref<Record<number, boolean>>({});
const remainSeconds = ref(TOTAL_TIME);
const startTime = ref(0);
let timer: any = null;

const currentQ = computed(() => questions.value[currentIdx.value] || null);
const timerText = computed(() => {
  const m = Math.floor(remainSeconds.value / 60);
  const s = remainSeconds.value % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
});

function getOptionLetter(opt: string): string {
  return opt.match(/^\(([A-D])\)/)?.[1] || '';
}

function selectOption(opt: string) {
  const letter = getOptionLetter(opt);
  if (letter) answers.value[currentIdx.value] = letter;
}

function prev() {
  if (currentIdx.value > 0) currentIdx.value--;
}

function next() {
  if (currentIdx.value >= questions.value.length - 1) {
    confirmSubmit();
  } else {
    currentIdx.value++;
  }
}

function toggleMark() {
  marked.value[currentIdx.value] = !marked.value[currentIdx.value];
}

function confirmSubmit() {
  const answered = Object.keys(answers.value).length;
  const unanswered = questions.value.length - answered;
  const msg = unanswered > 0
    ? `还有 ${unanswered} 题未作答，确定交卷？`
    : '确定交卷？';
  uni.showModal({
    title: '交卷确认',
    content: msg,
    success: (res) => { if (res.confirm) submitExam(); },
  });
}

async function submitExam() {
  if (timer) { clearInterval(timer); timer = null; }
  const duration = Math.round((Date.now() - startTime.value) / 1000);
  let score = 0;
  const examAnswers: any[] = [];

  for (let i = 0; i < questions.value.length; i++) {
    const q = questions.value[i];
    const selected = answers.value[i] || '';
    const correct = selected === q.answer;
    if (correct) score++;
    examAnswers.push({
      question_id: q._id || '',
      selected_answer: selected,
      is_correct: correct,
    });
  }

  // 保存到云端
  const userId = getUserId();
  let examId = '';
  if (userId) {
    try {
      examId = (await db.add(COLLECTIONS.MOCK_EXAMS, {
        user_id: userId,
        score,
        total: questions.value.length,
        duration,
        answers: examAnswers,
        created_at: db.serverDate(),
      })) as unknown as string;
    } catch (e) {
      console.error('保存考试结果失败:', e);
    }
  }

  uni.redirectTo({
    url: `/pages/mock-exam/result?score=${score}&total=${questions.value.length}&duration=${duration}&id=${examId}`,
  });
}

async function loadExamQuestions() {
  uni.showLoading({ title: '加载试卷...' });
  try {
    const col = db.collection(COLLECTIONS.QUESTIONS);
    const res = await col.limit(200).get();
    const all = res.data as Question[];
    questions.value = shuffleQuestions(all).slice(0, TOTAL_QUESTIONS);
  } catch (e) {
    console.error('加载题目失败:', e);
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    uni.hideLoading();
  }
}

function startTimer() {
  startTime.value = Date.now();
  timer = setInterval(() => {
    remainSeconds.value--;
    if (remainSeconds.value <= 0) {
      uni.showToast({ title: '时间到，自动交卷', icon: 'none' });
      submitExam();
    }
  }, 1000);
}

onMounted(async () => {
  await loadExamQuestions();
  startTimer();
});

onUnmounted(() => {
  if (timer) { clearInterval(timer); timer = null; }
});
</script>

<style scoped>
.page { display: flex; flex-direction: column; min-height: 100vh; background: #f5f5f5; }
.exam-header { display: flex; justify-content: space-between; align-items: center; padding: 20rpx 30rpx; background: #fff; }
.timer { font-size: 36rpx; font-weight: bold; color: #2B5BA3; }
.timer.warning { color: #F44336; }
.progress-text { font-size: 26rpx; color: #666; }
.question-area { flex: 1; padding: 30rpx; }
.stem-scroll { max-height: 300rpx; margin-bottom: 30rpx; }
.stem-text { font-size: 32rpx; color: #333; line-height: 1.6; }
.option-item { background: #fff; border: 2rpx solid #e8e8e8; border-radius: 12rpx; padding: 28rpx 30rpx; margin-bottom: 16rpx; }
.option-item.selected { border-color: #2B5BA3; background: rgba(43,91,163,0.05); }
.option-item.marked-border { border-left: 6rpx solid #FFB300; }
.option-text { font-size: 28rpx; color: #333; line-height: 1.5; }
.bottom-nav { display: flex; background: #fff; padding: 20rpx 30rpx; padding-bottom: calc(20rpx + env(safe-area-inset-bottom)); box-shadow: 0 -2rpx 12rpx rgba(0,0,0,0.08); }
.nav-btn { flex: 1; text-align: center; padding: 20rpx; font-size: 28rpx; color: #333; }
.mark-btn { color: #FFB300; }
</style>

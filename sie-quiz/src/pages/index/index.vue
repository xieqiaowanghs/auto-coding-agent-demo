<template>
  <view class="page">
    <view class="header">
      <text class="title">SIE 刷题</text>
      <text class="subtitle">Securities Industry Essentials</text>
    </view>

    <!-- 考试倒计时 -->
    <view class="countdown-card" v-if="daysLeft >= 0">
      <text class="countdown-label">距离 SIE 考试还有</text>
      <text class="countdown-num">{{ daysLeft }}</text>
      <text class="countdown-unit">天</text>
    </view>

    <!-- 学习统计 -->
    <view class="stats-card">
      <view class="stat-item">
        <text class="stat-num">{{ todayCount }}</text>
        <text class="stat-label">今日做题</text>
      </view>
      <view class="stat-item">
        <text class="stat-num">{{ accuracyText }}</text>
        <text class="stat-label">正确率</text>
      </view>
      <view class="stat-item">
        <text class="stat-num">{{ streakDays }}</text>
        <text class="stat-label">连续打卡</text>
      </view>
    </view>

    <!-- 快速操作 -->
    <view class="actions">
      <view :class="['action-btn', 'primary', dailyDone && 'done']" @click="startDailyPractice">
        <text v-if="dailyDone">今日已完成 ✓</text>
        <text v-else>{{ hasUnfinished ? '继续练习' : '每日一练' }}</text>
      </view>
      <view class="daily-config">
        <text class="config-label">每日题数：</text>
        <text :class="['config-opt', dailyCount === 10 && 'active']" @click="setDailyCount(10)">10</text>
        <text :class="['config-opt', dailyCount === 20 && 'active']" @click="setDailyCount(20)">20</text>
        <text :class="['config-opt', dailyCount === 30 && 'active']" @click="setDailyCount(30)">30</text>
      </view>
      <view class="action-btn" @click="startMockExam">
        <text>模拟考试</text>
      </view>
    </view>

    <!-- 薄弱知识点提示 -->
    <view class="weakness-card" v-if="weakChapters.length > 0">
      <text class="weakness-title">薄弱知识点</text>
      <view class="weakness-item" v-for="w in weakChapters.slice(0, 3)" :key="w.chapter">
        <text class="weakness-label">Ch{{ w.chapter }}</text>
        <view class="weakness-bar-bg">
          <view class="weakness-bar-fill" :style="{ width: w.accuracy + '%' }"></view>
        </view>
        <text class="weakness-percent">{{ w.accuracy }}%</text>
      </view>
      <view class="weakness-action" @click="startWeaknessPractice">
        <text>专项练习</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { db, callFunction } from '@/utils/cloud';
import userStore, { getUserId } from '@/store/user';

const todayCount = ref(0);
const todayCorrect = ref(0);
const streakDays = ref(0);
const hasUnfinished = ref(false);
const examDate = ref('');
const weakChapters = ref<{ chapter: number; accuracy: number }[]>([]);
const dailyDone = ref(false);
const dailyCount = ref(20);

const accuracyText = computed(() => {
  if (todayCount.value === 0) return '0%';
  return Math.round((todayCorrect.value / todayCount.value) * 100) + '%';
});

const daysLeft = computed(() => {
  if (!examDate.value) return -1;
  const target = new Date(examDate.value);
  const now = new Date();
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : -1;
});

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function loadStats() {
  const userId = getUserId();
  if (!userId) return;

  try {
    const today = getToday();
    const res = await db.get('daily_stats', { user_id: userId, date: today });
    if (res.length > 0) {
      todayCount.value = res[0].total_count || 0;
      todayCorrect.value = res[0].correct_count || 0;
    }
  } catch (e) {
    console.error('加载统计失败:', e);
  }
}

async function loadStreak() {
  const userId = getUserId();
  if (!userId) return;

  try {
    const res = await db.collection('daily_stats')
      .where({ user_id: userId })
      .orderBy('date', 'desc')
      .limit(30)
      .get();

    let streak = 0;
    const today = new Date();
    for (let i = 0; i < res.data.length; i++) {
      const expected = new Date(today);
      expected.setDate(expected.getDate() - i);
      const expectedStr = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, '0')}-${String(expected.getDate()).padStart(2, '0')}`;
      if (res.data[i].date === expectedStr && res.data[i].total_count > 0) {
        streak++;
      } else {
        break;
      }
    }
    streakDays.value = streak;
  } catch (e) {
    console.error('加载打卡天数失败:', e);
  }
}

function loadExamDate() {
  examDate.value = uni.getStorageSync('sie_exam_date') || '';
}

function loadDailyStatus() {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  dailyDone.value = uni.getStorageSync('daily_complete_date') === dateStr;
  dailyCount.value = uni.getStorageSync('daily_count') || 20;
}

function setDailyCount(count: number) {
  dailyCount.value = count;
  uni.setStorageSync('daily_count', count);
}

function startDailyPractice() {
  uni.navigateTo({ url: `/pages/practice/index?mode=daily&count=${dailyCount.value}` });
}

function startMockExam() {
  uni.navigateTo({ url: '/pages/mock-exam/index' });
}

function startWeaknessPractice() {
  const chapters = weakChapters.value.map(w => w.chapter).join(',');
  uni.navigateTo({ url: `/pages/practice/index?mode=weakness&chapters=${chapters}` });
}

async function loadWeakness() {
  const userId = getUserId();
  if (!userId) return;
  try {
    const res = await callFunction('analyze-weakness', { user_id: userId });
    if (res?.result?.weakChapters) {
      weakChapters.value = res.result.weakChapters;
    }
  } catch (e) {
    console.error('加载薄弱知识点失败:', e);
  }
}

onShow(() => {
  loadStats();
  loadStreak();
  loadExamDate();
  loadDailyStatus();
  loadWeakness();
});
</script>

<style scoped>
.page {
  padding: 30rpx;
  background-color: #f5f5f5;
  min-height: 100vh;
}
.header {
  text-align: center;
  padding: 40rpx 0;
}
.title {
  font-size: 48rpx;
  font-weight: bold;
  color: #2B5BA3;
  display: block;
}
.subtitle {
  font-size: 24rpx;
  color: #999;
  margin-top: 10rpx;
  display: block;
}
.countdown-card {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #2B5BA3, #4A90D9);
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
}
.countdown-label {
  font-size: 28rpx;
  color: rgba(255,255,255,0.9);
}
.countdown-num {
  font-size: 56rpx;
  font-weight: bold;
  color: #fff;
  margin: 0 12rpx;
}
.countdown-unit {
  font-size: 28rpx;
  color: rgba(255,255,255,0.9);
}
.stats-card {
  display: flex;
  justify-content: space-around;
  background: #fff;
  border-radius: 16rpx;
  padding: 40rpx 20rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.08);
}
.stat-item {
  text-align: center;
}
.stat-num {
  font-size: 44rpx;
  font-weight: bold;
  color: #2B5BA3;
  display: block;
}
.stat-label {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
  display: block;
}
.actions {
  margin-top: 10rpx;
}
.action-btn {
  background: #fff;
  border-radius: 16rpx;
  padding: 36rpx;
  text-align: center;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.08);
  font-size: 32rpx;
  color: #333;
}
.action-btn.primary {
  background: #2B5BA3;
  color: #fff;
}
.action-btn.primary.done {
  background: #4CAF50;
}
.daily-config {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20rpx;
  gap: 12rpx;
}
.config-label {
  font-size: 24rpx;
  color: #999;
}
.config-opt {
  font-size: 24rpx;
  color: #666;
  background: #f0f0f0;
  padding: 8rpx 24rpx;
  border-radius: 20rpx;
}
.config-opt.active {
  color: #fff;
  background: #2B5BA3;
}
.weakness-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-top: 10rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.08);
}
.weakness-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #F44336;
  display: block;
  margin-bottom: 20rpx;
}
.weakness-item {
  display: flex;
  align-items: center;
  margin-bottom: 14rpx;
}
.weakness-label {
  font-size: 24rpx;
  color: #666;
  width: 80rpx;
  flex-shrink: 0;
}
.weakness-bar-bg {
  flex: 1;
  height: 16rpx;
  background: #eee;
  border-radius: 8rpx;
  margin: 0 16rpx;
}
.weakness-bar-fill {
  height: 100%;
  background: #F44336;
  border-radius: 8rpx;
}
.weakness-percent {
  font-size: 24rpx;
  color: #F44336;
  width: 70rpx;
  text-align: right;
  flex-shrink: 0;
}
.weakness-action {
  margin-top: 20rpx;
  background: #F44336;
  color: #fff;
  text-align: center;
  padding: 20rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
}
</style>

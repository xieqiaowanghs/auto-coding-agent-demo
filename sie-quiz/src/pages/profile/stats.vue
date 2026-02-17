<template>
  <view class="page">
    <!-- 总体统计 -->
    <view class="stat-card">
      <text class="card-title">总体统计</text>
      <view class="stat-row">
        <view class="stat-item">
          <text class="stat-num">{{ totalCount }}</text>
          <text class="stat-label">总做题数</text>
        </view>
        <view class="stat-item">
          <text class="stat-num">{{ totalAccuracy }}%</text>
          <text class="stat-label">总正确率</text>
        </view>
        <view class="stat-item">
          <text class="stat-num">{{ streakDays }}</text>
          <text class="stat-label">连续打卡</text>
        </view>
      </view>
    </view>

    <!-- 章节正确率 -->
    <view class="stat-card">
      <text class="card-title">各章节正确率</text>
      <view class="empty-hint" v-if="chapterStats.length === 0">暂无数据</view>
      <view class="chapter-bar" v-for="ch in chapterStats" :key="ch.chapter">
        <text class="ch-label">Ch{{ ch.chapter }}</text>
        <view class="bar-bg">
          <view :class="['bar-fill', ch.accuracy < 60 && 'weak']" :style="{ width: ch.accuracy + '%' }"></view>
        </view>
        <text :class="['ch-percent', ch.accuracy < 60 && 'weak-text']">{{ ch.accuracy }}%</text>
      </view>
    </view>

    <!-- 知识领域正确率 -->
    <view class="stat-card">
      <text class="card-title">知识领域正确率</text>
      <view class="empty-hint" v-if="categoryStats.length === 0">暂无数据</view>
      <view class="chapter-bar" v-for="cat in categoryStats" :key="cat.category">
        <text class="cat-label">{{ cat.category }}</text>
        <view class="bar-bg">
          <view :class="['bar-fill', 'cat-fill', cat.accuracy < 60 && 'weak']" :style="{ width: cat.accuracy + '%' }"></view>
        </view>
        <text :class="['ch-percent', cat.accuracy < 60 && 'weak-text']">{{ cat.accuracy }}%</text>
      </view>
    </view>

    <!-- 最近 30 天做题趋势 -->
    <view class="stat-card">
      <text class="card-title">最近 30 天做题数</text>
      <scroll-view scroll-x class="daily-scroll">
        <view class="daily-bars">
          <view class="daily-col" v-for="d in dailyStats" :key="d.date">
            <text class="daily-count" v-if="d.count > 0">{{ d.count }}</text>
            <view class="daily-bar" :style="{ height: d.barHeight + 'rpx' }"></view>
            <text class="daily-label">{{ d.label }}</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 每周学习时长 -->
    <view class="stat-card">
      <text class="card-title">每周学习时长 (分钟)</text>
      <view class="empty-hint" v-if="weeklyStats.length === 0">暂无数据</view>
      <view class="weekly-bars">
        <view class="weekly-col" v-for="w in weeklyStats" :key="w.week">
          <text class="weekly-count" v-if="w.minutes > 0">{{ w.minutes }}</text>
          <view class="weekly-bar" :style="{ height: w.barHeight + 'rpx' }"></view>
          <text class="weekly-label">{{ w.label }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { db } from '@/utils/cloud';
import { getUserId } from '@/store/user';
import { COLLECTIONS } from '@/types/database';

const totalCount = ref(0);
const totalAccuracy = ref(0);
const streakDays = ref(0);
const chapterStats = ref<{ chapter: number; accuracy: number }[]>([]);
const categoryStats = ref<{ category: string; accuracy: number }[]>([]);
const dailyStats = ref<{ date: string; label: string; count: number; barHeight: number }[]>([]);
const weeklyStats = ref<{ week: string; label: string; minutes: number; barHeight: number }[]>([]);

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function loadStats() {
  const userId = getUserId();
  if (!userId) return;

  try {
    // 总体统计：从 user_records 读取
    const records = await db.collection(COLLECTIONS.USER_RECORDS)
      .where({ user_id: userId }).limit(2000).get();
    const allRecords = records.data as any[];
    totalCount.value = allRecords.length;
    const correctCount = allRecords.filter((r: any) => r.is_correct).length;
    totalAccuracy.value = totalCount.value > 0 ? Math.round((correctCount / totalCount.value) * 100) : 0;

    // 收集所有涉及的 question_id，批量查询题目信息
    const qIds = [...new Set(allRecords.map(r => r.question_id))];
    const qMap: Record<string, { chapter: number; category: string }> = {};
    for (const qId of qIds) {
      try {
        const qRes = await db.collection(COLLECTIONS.QUESTIONS).doc(qId).get();
        const q = qRes.data as any;
        if (q) qMap[qId] = { chapter: q.chapter || 0, category: q.category || '' };
      } catch { /* skip */ }
    }

    // 章节正确率
    const chMap: Record<number, { total: number; correct: number }> = {};
    for (const r of allRecords) {
      const info = qMap[r.question_id];
      if (!info || !info.chapter) continue;
      if (!chMap[info.chapter]) chMap[info.chapter] = { total: 0, correct: 0 };
      chMap[info.chapter].total++;
      if (r.is_correct) chMap[info.chapter].correct++;
    }
    chapterStats.value = Object.entries(chMap)
      .map(([ch, v]) => ({ chapter: Number(ch), accuracy: Math.round((v.correct / v.total) * 100) }))
      .sort((a, b) => a.chapter - b.chapter);

    // 知识领域正确率
    const catMap: Record<string, { total: number; correct: number }> = {};
    for (const r of allRecords) {
      const info = qMap[r.question_id];
      if (!info || !info.category) continue;
      if (!catMap[info.category]) catMap[info.category] = { total: 0, correct: 0 };
      catMap[info.category].total++;
      if (r.is_correct) catMap[info.category].correct++;
    }
    categoryStats.value = Object.entries(catMap)
      .map(([cat, v]) => ({ category: cat, accuracy: Math.round((v.correct / v.total) * 100) }))
      .sort((a, b) => a.accuracy - b.accuracy);

    // 最近 30 天做题趋势
    const days: typeof dailyStats.value = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push({ date: formatDate(d), label: `${d.getMonth() + 1}/${d.getDate()}`, count: 0, barHeight: 10 });
    }

    const statsRes = await db.collection(COLLECTIONS.DAILY_STATS)
      .where({ user_id: userId })
      .orderBy('date', 'desc')
      .limit(30)
      .get();

    for (const s of statsRes.data as any[]) {
      const day = days.find(d => d.date === s.date);
      if (day) day.count = s.total_count || 0;
    }

    const maxCount = Math.max(...days.map(d => d.count), 1);
    for (const d of days) {
      d.barHeight = Math.max(10, Math.round((d.count / maxCount) * 200));
    }
    dailyStats.value = days;

    // 连续打卡（从今天往回数）
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].count > 0) streak++;
      else break;
    }
    streakDays.value = streak;

    // 每周学习时长（最近 4 周）
    const weeks: typeof weeklyStats.value = [];
    for (let w = 3; w >= 0; w--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() - w * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const startStr = formatDate(weekStart);
      const endStr = formatDate(weekEnd);

      let minutes = 0;
      for (const s of statsRes.data as any[]) {
        if (s.date >= startStr && s.date <= endStr) {
          minutes += s.study_minutes || 0;
        }
      }
      weeks.push({
        week: startStr,
        label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
        minutes,
        barHeight: 10,
      });
    }
    const maxMin = Math.max(...weeks.map(w => w.minutes), 1);
    for (const w of weeks) {
      w.barHeight = Math.max(10, Math.round((w.minutes / maxMin) * 200));
    }
    weeklyStats.value = weeks;

  } catch (e) {
    console.error('加载统计失败:', e);
  }
}

onMounted(() => { loadStats(); });
</script>

<style scoped>
.page { padding: 30rpx; background: #f5f5f5; min-height: 100vh; }
.stat-card { background: #fff; border-radius: 16rpx; padding: 30rpx; margin-bottom: 24rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.08); }
.card-title { font-size: 30rpx; font-weight: bold; color: #333; display: block; margin-bottom: 24rpx; }
.stat-row { display: flex; justify-content: space-around; }
.stat-item { text-align: center; }
.stat-num { font-size: 44rpx; font-weight: bold; color: #2B5BA3; display: block; }
.stat-label { font-size: 24rpx; color: #999; margin-top: 8rpx; display: block; }
.empty-hint { font-size: 26rpx; color: #ccc; text-align: center; padding: 20rpx 0; }
.chapter-bar { display: flex; align-items: center; margin-bottom: 16rpx; }
.ch-label { font-size: 24rpx; color: #666; width: 80rpx; flex-shrink: 0; }
.cat-label { font-size: 22rpx; color: #666; width: 160rpx; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bar-bg { flex: 1; height: 20rpx; background: #eee; border-radius: 10rpx; margin: 0 16rpx; }
.bar-fill { height: 100%; background: #2B5BA3; border-radius: 10rpx; transition: width 0.3s; }
.bar-fill.weak { background: #F44336; }
.bar-fill.cat-fill { background: #FF9800; }
.bar-fill.cat-fill.weak { background: #F44336; }
.ch-percent { font-size: 24rpx; color: #333; width: 80rpx; text-align: right; flex-shrink: 0; }
.weak-text { color: #F44336; font-weight: bold; }
.daily-scroll { width: 100%; }
.daily-bars { display: inline-flex; justify-content: flex-start; align-items: flex-end; height: 280rpx; gap: 8rpx; padding-bottom: 40rpx; }
.daily-col { display: flex; flex-direction: column; align-items: center; width: 50rpx; }
.daily-count { font-size: 18rpx; color: #2B5BA3; margin-bottom: 4rpx; }
.daily-bar { width: 32rpx; background: #2B5BA3; border-radius: 6rpx 6rpx 0 0; }
.daily-label { font-size: 18rpx; color: #999; margin-top: 8rpx; }
.weekly-bars { display: flex; justify-content: space-around; align-items: flex-end; height: 250rpx; }
.weekly-col { display: flex; flex-direction: column; align-items: center; }
.weekly-count { font-size: 22rpx; color: #FF9800; margin-bottom: 4rpx; }
.weekly-bar { width: 60rpx; background: #FF9800; border-radius: 6rpx 6rpx 0 0; }
.weekly-label { font-size: 20rpx; color: #999; margin-top: 8rpx; }
</style>

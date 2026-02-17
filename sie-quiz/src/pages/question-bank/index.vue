<template>
  <view class="page">
    <!-- 搜索栏 -->
    <view class="search-bar">
      <input class="search-input" placeholder="搜索题目关键词" v-model="keyword" @confirm="onSearch" />
    </view>

    <!-- Tab 切换 -->
    <view class="tabs">
      <text :class="['tab', activeTab === 'chapter' && 'active']" @click="activeTab = 'chapter'">按章节</text>
      <text :class="['tab', activeTab === 'category' && 'active']" @click="activeTab = 'category'">按知识领域</text>
    </view>

    <!-- 按章节浏览 -->
    <view v-if="activeTab === 'chapter'">
      <view class="part-group" v-for="part in parts" :key="part.id">
        <text class="part-title">{{ part.name }}</text>
        <view class="chapter-item" v-for="ch in part.chapters" :key="ch.chapter"
              @click="goToPractice(ch.chapter)">
          <view class="chapter-info">
            <text class="chapter-name">Ch{{ ch.chapter }}. {{ ch.name }}</text>
            <text class="chapter-count">{{ ch.count }} 题</text>
          </view>
          <view class="progress-bar" v-if="ch.count > 0">
            <view class="progress-fill" :style="{ width: ch.progress + '%' }"></view>
          </view>
        </view>
      </view>
    </view>

    <!-- 按知识领域浏览 -->
    <view v-if="activeTab === 'category'">
      <view class="chapter-item" v-for="cat in categories" :key="cat.name"
            @click="goToPracticeByCategory(cat.name)">
        <view class="chapter-info">
          <text class="chapter-name">{{ cat.name }}</text>
          <text class="chapter-count">{{ cat.count }} 题</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { db } from '@/utils/cloud';
import { getUserId } from '@/store/user';
import { COLLECTIONS } from '@/types/database';

const keyword = ref('');
const activeTab = ref<'chapter' | 'category'>('chapter');

interface ChapterInfo {
  chapter: number;
  name: string;
  count: number;
  progress: number;
}

const CHAPTER_NAMES: Record<number, string> = {
  5: 'Securities Underwriting',
  6: 'Equity Securities',
  7: 'Debt Securities',
  8: 'Municipal Bonds',
  9: 'Packaged Securities',
  10: 'DPPs and REITs',
  11: 'Options',
  12: 'Customer Accounts',
  13: 'Securities Analysis',
  14: 'Securities Markets',
  15: 'Taxation',
  16: 'Rules and Regulations',
  17: 'Practice Exam 1',
  19: 'Practice Exam 2',
};

const parts = reactive([
  { id: 1, name: 'Part 1: 考试入门', chapters: [] as ChapterInfo[] },
  { id: 2, name: 'Part 2: 基础证券投资', chapters: [
    { chapter: 5, name: CHAPTER_NAMES[5], count: 10, progress: 0 },
    { chapter: 6, name: CHAPTER_NAMES[6], count: 18, progress: 0 },
    { chapter: 7, name: CHAPTER_NAMES[7], count: 16, progress: 0 },
    { chapter: 8, name: CHAPTER_NAMES[8], count: 16, progress: 0 },
  ] as ChapterInfo[] },
  { id: 3, name: 'Part 3: 复杂证券产品', chapters: [
    { chapter: 9, name: CHAPTER_NAMES[9], count: 15, progress: 0 },
    { chapter: 10, name: CHAPTER_NAMES[10], count: 10, progress: 0 },
    { chapter: 11, name: CHAPTER_NAMES[11], count: 18, progress: 0 },
  ] as ChapterInfo[] },
  { id: 4, name: 'Part 4: 客户服务与合规', chapters: [
    { chapter: 12, name: CHAPTER_NAMES[12], count: 12, progress: 0 },
    { chapter: 13, name: CHAPTER_NAMES[13], count: 17, progress: 0 },
    { chapter: 14, name: CHAPTER_NAMES[14], count: 14, progress: 0 },
    { chapter: 15, name: CHAPTER_NAMES[15], count: 9, progress: 0 },
    { chapter: 16, name: CHAPTER_NAMES[16], count: 25, progress: 0 },
  ] as ChapterInfo[] },
  { id: 5, name: 'Part 5: 模拟考试', chapters: [
    { chapter: 17, name: CHAPTER_NAMES[17], count: 75, progress: 0 },
    { chapter: 19, name: CHAPTER_NAMES[19], count: 75, progress: 0 },
  ] as ChapterInfo[] },
]);

const categories = reactive([
  { name: 'Securities Underwriting', count: 10 },
  { name: 'Equity Securities', count: 18 },
  { name: 'Debt Securities', count: 16 },
  { name: 'Municipal Bonds', count: 16 },
  { name: 'Packaged Securities', count: 15 },
  { name: 'DPPs and REITs', count: 10 },
  { name: 'Options', count: 18 },
  { name: 'Customer Accounts', count: 12 },
  { name: 'Securities Analysis', count: 17 },
  { name: 'Securities Markets', count: 14 },
  { name: 'Taxation', count: 9 },
  { name: 'Rules and Regulations', count: 25 },
]);

async function loadProgress() {
  const userId = getUserId();
  if (!userId) return;
  try {
    const records = await db.collection(COLLECTIONS.USER_RECORDS)
      .where({ user_id: userId })
      .field({ question_id: true })
      .limit(1000)
      .get();
    // 简单统计已做题数（后续可优化）
    const doneIds = new Set(records.data.map((r: any) => r.question_id));
    for (const part of parts) {
      for (const ch of part.chapters) {
        if (ch.count > 0) {
          // 粗略进度估算
          ch.progress = Math.min(100, Math.round((doneIds.size / ch.count) * 10));
        }
      }
    }
  } catch (e) {
    console.error('加载进度失败:', e);
  }
}

function goToPractice(chapter: number) {
  uni.navigateTo({ url: `/pages/practice/index?mode=chapter&chapter=${chapter}` });
}

function goToPracticeByCategory(category: string) {
  uni.navigateTo({ url: `/pages/practice/index?mode=category&category=${encodeURIComponent(category)}` });
}

function onSearch() {
  if (keyword.value.trim()) {
    uni.navigateTo({ url: `/pages/practice/index?mode=search&keyword=${encodeURIComponent(keyword.value.trim())}` });
  }
}

onShow(() => {
  loadProgress();
});
</script>

<style scoped>
.page {
  padding: 30rpx;
  background-color: #f5f5f5;
  min-height: 100vh;
}
.search-bar {
  margin-bottom: 20rpx;
}
.search-input {
  background: #fff;
  border-radius: 12rpx;
  padding: 20rpx 30rpx;
  font-size: 28rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.08);
}
.tabs {
  display: flex;
  margin-bottom: 24rpx;
}
.tab {
  flex: 1;
  text-align: center;
  padding: 20rpx 0;
  font-size: 28rpx;
  color: #666;
  border-bottom: 4rpx solid transparent;
}
.tab.active {
  color: #2B5BA3;
  font-weight: bold;
  border-bottom-color: #2B5BA3;
}
.part-group {
  margin-bottom: 24rpx;
}
.part-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 16rpx;
  display: block;
}
.chapter-item {
  background: #fff;
  border-radius: 12rpx;
  padding: 28rpx 30rpx;
  margin-bottom: 12rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.08);
}
.chapter-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.chapter-name {
  font-size: 26rpx;
  color: #333;
  flex: 1;
}
.chapter-count {
  font-size: 24rpx;
  color: #999;
  margin-left: 16rpx;
}
.progress-bar {
  height: 6rpx;
  background: #eee;
  border-radius: 3rpx;
  margin-top: 16rpx;
}
.progress-fill {
  height: 100%;
  background: #2B5BA3;
  border-radius: 3rpx;
  transition: width 0.3s;
}
</style>

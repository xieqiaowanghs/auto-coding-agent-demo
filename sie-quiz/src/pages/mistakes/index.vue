<template>
  <view class="page">
    <!-- 统计 -->
    <view class="stats-bar" v-if="mistakes.length > 0">
      <text class="stat">未掌握: {{ unmasteredCount }}</text>
      <text class="stat">已掌握: {{ masteredCount }}</text>
    </view>

    <!-- 筛选 -->
    <view class="filter-bar" v-if="mistakes.length > 0">
      <text :class="['filter-tab', sortBy === 'count' && 'active']" @click="sortBy = 'count'">多错优先</text>
      <text :class="['filter-tab', sortBy === 'time' && 'active']" @click="sortBy = 'time'">最近优先</text>
    </view>

    <!-- 错题列表 -->
    <view class="list" v-if="sortedMistakes.length > 0">
      <view class="mistake-item" v-for="item in sortedMistakes" :key="item._id"
            @click="goToPractice">
        <view class="mistake-info">
          <text class="mistake-stem">{{ item.stemPreview }}</text>
          <view class="mistake-meta">
            <text class="meta-tag">Ch{{ item.chapter }}</text>
            <text class="meta-text">错 {{ item.wrong_count }} 次</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view class="empty" v-if="!loading && mistakes.length === 0">
      <text class="empty-icon">✓</text>
      <text class="empty-text">暂无错题，继续加油！</text>
    </view>

    <!-- 开始重练按钮 -->
    <view class="practice-btn" v-if="unmasteredCount > 0" @click="goToPractice">
      <text>开始错题重练 ({{ unmasteredCount }} 题)</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { db } from '@/utils/cloud';
import { getUserId } from '@/store/user';
import { COLLECTIONS } from '@/types/database';

interface MistakeItem {
  _id: string;
  question_id: string;
  wrong_count: number;
  last_wrong_at: any;
  mastered: boolean;
  stemPreview: string;
  chapter: number;
}

const mistakes = ref<MistakeItem[]>([]);
const loading = ref(true);
const sortBy = ref<'count' | 'time'>('count');

const unmasteredCount = computed(() => mistakes.value.filter(m => !m.mastered).length);
const masteredCount = computed(() => mistakes.value.filter(m => m.mastered).length);

const sortedMistakes = computed(() => {
  const unmastered = mistakes.value.filter(m => !m.mastered);
  if (sortBy.value === 'count') {
    return unmastered.sort((a, b) => b.wrong_count - a.wrong_count);
  }
  return [...unmastered].reverse();
});

async function loadMistakes() {
  const userId = getUserId();
  if (!userId) { loading.value = false; return; }

  try {
    const res = await db.collection(COLLECTIONS.USER_MISTAKES)
      .where({ user_id: userId })
      .orderBy('wrong_count', 'desc')
      .limit(200)
      .get();

    const items: MistakeItem[] = [];
    for (const m of res.data as any[]) {
      let stemPreview = '';
      let chapter = 0;
      try {
        const qRes = await db.collection(COLLECTIONS.QUESTIONS).doc(m.question_id).get();
        const q = qRes.data as any;
        stemPreview = (q?.stem || '').slice(0, 50) + '...';
        chapter = q?.chapter || 0;
      } catch { /* question may be deleted */ }

      items.push({
        _id: m._id,
        question_id: m.question_id,
        wrong_count: m.wrong_count,
        last_wrong_at: m.last_wrong_at,
        mastered: m.mastered || false,
        stemPreview,
        chapter,
      });
    }
    mistakes.value = items;
  } catch (e) {
    console.error('加载错题失败:', e);
  } finally {
    loading.value = false;
  }
}

function goToPractice() {
  uni.navigateTo({ url: '/pages/practice/index?mode=mistakes' });
}

onShow(() => {
  loadMistakes();
});
</script>

<style scoped>
.page { padding: 30rpx; background: #f5f5f5; min-height: 100vh; }
.stats-bar { display: flex; justify-content: center; gap: 40rpx; margin-bottom: 20rpx; }
.stat { font-size: 26rpx; color: #666; }
.filter-bar { display: flex; margin-bottom: 20rpx; }
.filter-tab { flex: 1; text-align: center; padding: 16rpx; font-size: 26rpx; color: #666; border-bottom: 4rpx solid transparent; }
.filter-tab.active { color: #2B5BA3; font-weight: bold; border-bottom-color: #2B5BA3; }
.mistake-item { background: #fff; border-radius: 12rpx; padding: 24rpx 30rpx; margin-bottom: 12rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.08); }
.mistake-stem { font-size: 28rpx; color: #333; display: block; margin-bottom: 12rpx; }
.mistake-meta { display: flex; align-items: center; gap: 16rpx; }
.meta-tag { font-size: 22rpx; color: #2B5BA3; background: rgba(43,91,163,0.08); padding: 4rpx 12rpx; border-radius: 6rpx; }
.meta-text { font-size: 22rpx; color: #F44336; }
.empty { display: flex; flex-direction: column; align-items: center; padding-top: 300rpx; }
.empty-icon { font-size: 120rpx; color: #2B5BA3; }
.empty-text { font-size: 28rpx; color: #999; margin-top: 20rpx; }
.practice-btn { position: fixed; bottom: calc(120rpx + env(safe-area-inset-bottom)); left: 30rpx; right: 30rpx; background: #2B5BA3; color: #fff; text-align: center; padding: 28rpx; border-radius: 12rpx; font-size: 30rpx; }
</style>

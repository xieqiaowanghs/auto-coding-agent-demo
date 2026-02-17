<template>
  <view class="page">
    <view class="search-bar">
      <input class="search-input" placeholder="搜索术语" v-model="keyword" @input="onSearch" />
    </view>

    <!-- 首字母索引 -->
    <scroll-view scroll-x class="letter-bar" v-if="!keyword">
      <text :class="['letter', activeLetter === '' && 'active']" @click="activeLetter = ''">全部</text>
      <text :class="['letter', activeLetter === l && 'active']"
            v-for="l in availableLetters" :key="l" @click="activeLetter = l">{{ l }}</text>
    </scroll-view>

    <view class="list">
      <view class="card-item" v-for="card in displayCards" :key="card._id"
            @click="toggleCard(card)">
        <view class="card-header">
          <text class="term">{{ card.term }}</text>
          <text :class="['level-dot', card.familiarity_level]"></text>
        </view>
        <text class="definition" v-if="card.expanded">{{ card.definition }}</text>
      </view>
    </view>

    <view class="empty" v-if="!loading && cards.length === 0">
      <text class="empty-text">暂无术语卡片</text>
    </view>

    <view class="review-btn" v-if="cards.length > 0" @click="startReview">
      <text>开始复习</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { db } from '@/utils/cloud';
import { COLLECTIONS } from '@/types/database';

interface CardItem {
  _id: string;
  term: string;
  definition: string;
  familiarity_level: string;
  expanded: boolean;
}

const cards = ref<CardItem[]>([]);
const keyword = ref('');
const activeLetter = ref('');
const loading = ref(true);

// 提取所有可用的首字母
const availableLetters = computed(() => {
  const letters = new Set<string>();
  cards.value.forEach(c => {
    const first = c.term.charAt(0).toUpperCase();
    if (/[A-Z]/.test(first)) letters.add(first);
  });
  return Array.from(letters).sort();
});

// 按搜索关键词筛选
const filteredCards = computed(() => {
  if (!keyword.value) return cards.value;
  const kw = keyword.value.toLowerCase();
  return cards.value.filter(c => c.term.toLowerCase().includes(kw));
});

// 按首字母筛选（仅在无搜索时生效）
const displayCards = computed(() => {
  if (keyword.value) return filteredCards.value;
  if (!activeLetter.value) return cards.value;
  return cards.value.filter(c => c.term.charAt(0).toUpperCase() === activeLetter.value);
});

async function loadCards() {
  try {
    const res = await db.collection(COLLECTIONS.FLASHCARDS)
      .orderBy('term', 'asc')
      .limit(500)
      .get();
    cards.value = (res.data as any[]).map(c => ({ ...c, expanded: false }));
  } catch (e) {
    console.error('加载术语失败:', e);
  } finally {
    loading.value = false;
  }
}

function toggleCard(card: CardItem) {
  card.expanded = !card.expanded;
}

function onSearch() { /* reactive filtering via computed */ }

function startReview() {
  uni.navigateTo({ url: '/pages/flashcards/review' });
}

onShow(() => { loadCards(); });
</script>

<style scoped>
.page { padding: 30rpx; background: #f5f5f5; min-height: 100vh; padding-bottom: 160rpx; }
.search-bar { margin-bottom: 20rpx; }
.search-input { background: #fff; border-radius: 12rpx; padding: 20rpx 30rpx; font-size: 28rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.08); }
.letter-bar { white-space: nowrap; margin-bottom: 20rpx; }
.letter { display: inline-block; font-size: 24rpx; color: #666; background: #fff; padding: 10rpx 20rpx; border-radius: 8rpx; margin-right: 12rpx; border: 2rpx solid #e0e0e0; }
.letter.active { color: #fff; background: #2B5BA3; border-color: #2B5BA3; }
.card-item { background: #fff; border-radius: 12rpx; padding: 24rpx 30rpx; margin-bottom: 12rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.08); }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.term { font-size: 30rpx; font-weight: bold; color: #2B5BA3; }
.level-dot { width: 16rpx; height: 16rpx; border-radius: 50%; background: #ccc; }
.level-dot.known { background: #4CAF50; }
.level-dot.fuzzy { background: #FF9800; }
.level-dot.unknown { background: #F44336; }
.definition { font-size: 26rpx; color: #666; margin-top: 12rpx; line-height: 1.5; display: block; }
.empty { text-align: center; padding-top: 300rpx; }
.empty-text { font-size: 28rpx; color: #999; }
.review-btn { position: fixed; bottom: calc(40rpx + env(safe-area-inset-bottom)); left: 30rpx; right: 30rpx; background: #2B5BA3; color: #fff; text-align: center; padding: 28rpx; border-radius: 12rpx; font-size: 30rpx; }
</style>

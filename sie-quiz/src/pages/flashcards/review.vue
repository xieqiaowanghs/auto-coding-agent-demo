<template>
  <view class="page">
    <view class="progress-text">{{ currentIdx + 1 }} / {{ cards.length }}</view>

    <view class="card-container" v-if="currentCard" @click="flipped = !flipped">
      <view :class="['card', flipped && 'flipped']">
        <view class="card-front">
          <text class="card-term">{{ currentCard.term }}</text>
          <text class="card-hint">点击翻转</text>
        </view>
        <view class="card-back">
          <text class="card-definition">{{ currentCard.definition }}</text>
        </view>
      </view>
    </view>

    <view class="rating-bar" v-if="flipped">
      <view class="rate-btn known" @click="rate('known')"><text>认识</text></view>
      <view class="rate-btn fuzzy" @click="rate('fuzzy')"><text>模糊</text></view>
      <view class="rate-btn unknown" @click="rate('unknown')"><text>不认识</text></view>
    </view>

    <view class="done" v-if="cards.length > 0 && currentIdx >= cards.length">
      <text class="done-text">复习完成!</text>
      <view class="done-btn" @click="restart"><text>再来一轮</text></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { db } from '@/utils/cloud';
import { COLLECTIONS } from '@/types/database';
import type { FamiliarityLevel } from '@/types/database';

interface ReviewCard {
  _id: string;
  term: string;
  definition: string;
  familiarity_level: FamiliarityLevel;
}

const cards = ref<ReviewCard[]>([]);
const currentIdx = ref(0);
const flipped = ref(false);

const currentCard = computed(() => cards.value[currentIdx.value] || null);

async function loadCards() {
  try {
    const res = await db.collection(COLLECTIONS.FLASHCARDS)
      .where({ familiarity_level: db.command().neq('known') })
      .limit(200)
      .get();
    let all = res.data as ReviewCard[];
    // 不认识的优先，间隔重复
    all.sort((a, b) => {
      const order: Record<string, number> = { unknown: 0, fuzzy: 1, known: 2 };
      return (order[a.familiarity_level] || 0) - (order[b.familiarity_level] || 0);
    });
    // 如果没有未掌握的，加载全部
    if (all.length === 0) {
      const allRes = await db.collection(COLLECTIONS.FLASHCARDS).limit(200).get();
      all = allRes.data as ReviewCard[];
    }
    cards.value = all;
  } catch (e) {
    console.error('加载卡片失败:', e);
  }
}

async function rate(level: FamiliarityLevel) {
  const card = currentCard.value;
  if (!card) return;

  // 计算下次复习时间
  const intervals: Record<string, number> = { known: 7, fuzzy: 2, unknown: 0 };
  const days = intervals[level] || 0;
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + days);

  try {
    await db.update(COLLECTIONS.FLASHCARDS, card._id, {
      familiarity_level: level,
      next_review_at: nextReview,
    });
  } catch (e) {
    console.error('更新卡片失败:', e);
  }

  flipped.value = false;
  currentIdx.value++;
}

function restart() {
  currentIdx.value = 0;
  flipped.value = false;
  loadCards();
}

onMounted(() => { loadCards(); });
</script>

<style scoped>
.page { padding: 30rpx; background: #f5f5f5; min-height: 100vh; display: flex; flex-direction: column; align-items: center; }
.progress-text { font-size: 26rpx; color: #999; margin-bottom: 30rpx; }
.card-container { width: 100%; perspective: 1000rpx; margin-bottom: 40rpx; }
.card { width: 100%; min-height: 400rpx; position: relative; transition: transform 0.5s; transform-style: preserve-3d; }
.card.flipped { transform: rotateY(180deg); }
.card-front, .card-back { width: 100%; min-height: 400rpx; position: absolute; backface-visibility: hidden; background: #fff; border-radius: 16rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40rpx; box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.1); }
.card-back { transform: rotateY(180deg); }
.card-term { font-size: 40rpx; font-weight: bold; color: #2B5BA3; text-align: center; }
.card-hint { font-size: 24rpx; color: #ccc; margin-top: 20rpx; }
.card-definition { font-size: 28rpx; color: #333; line-height: 1.6; text-align: center; }
.rating-bar { display: flex; gap: 20rpx; width: 100%; }
.rate-btn { flex: 1; text-align: center; padding: 24rpx; border-radius: 12rpx; font-size: 28rpx; color: #fff; }
.rate-btn.known { background: #4CAF50; }
.rate-btn.fuzzy { background: #FF9800; }
.rate-btn.unknown { background: #F44336; }
.done { text-align: center; padding-top: 200rpx; }
.done-text { font-size: 36rpx; color: #333; display: block; margin-bottom: 30rpx; }
.done-btn { background: #2B5BA3; color: #fff; padding: 24rpx 60rpx; border-radius: 12rpx; font-size: 30rpx; display: inline-block; }
</style>

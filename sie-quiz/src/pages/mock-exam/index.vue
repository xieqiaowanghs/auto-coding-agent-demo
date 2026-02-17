<template>
  <view class="page">
    <view class="header">
      <text class="title">SIE 模拟考试</text>
      <text class="desc">75 道题 · 105 分钟 · 70% 及格</text>
    </view>

    <view class="info-card">
      <view class="info-row">
        <text class="info-label">题目数量</text>
        <text class="info-value">75 题</text>
      </view>
      <view class="info-row">
        <text class="info-label">考试时间</text>
        <text class="info-value">105 分钟</text>
      </view>
      <view class="info-row">
        <text class="info-label">及格线</text>
        <text class="info-value">70%（53 题）</text>
      </view>
      <view class="info-row">
        <text class="info-label">内容分布</text>
        <text class="info-value">按 SIE 考试比例</text>
      </view>
    </view>

    <view class="start-btn" @click="startExam">
      <text>开始考试</text>
    </view>

    <!-- 历史记录 -->
    <view class="history" v-if="history.length > 0">
      <text class="section-title">历史成绩</text>
      <view class="history-item" v-for="(item, idx) in history" :key="idx"
            @click="viewResult(item._id)">
        <view class="history-info">
          <text class="history-date">{{ item.created_at }}</text>
          <text :class="['history-score', item.score >= 53 ? 'pass' : 'fail']">
            {{ item.score }}/{{ item.total }}
          </text>
        </view>
        <text class="history-status">{{ item.score >= 53 ? 'PASS' : 'FAIL' }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { db } from '@/utils/cloud';
import { getUserId } from '@/store/user';
import { COLLECTIONS } from '@/types/database';

const history = ref<any[]>([]);

async function loadHistory() {
  const userId = getUserId();
  if (!userId) return;
  try {
    const res = await db.collection(COLLECTIONS.MOCK_EXAMS)
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(10)
      .get();
    history.value = res.data;
  } catch (e) {
    console.error('加载历史失败:', e);
  }
}

function startExam() {
  uni.navigateTo({ url: '/pages/mock-exam/exam' });
}

function viewResult(id: string) {
  uni.navigateTo({ url: `/pages/mock-exam/result?id=${id}` });
}

onShow(() => {
  loadHistory();
});
</script>

<style scoped>
.page { padding: 30rpx; background: #f5f5f5; min-height: 100vh; }
.header { text-align: center; padding: 40rpx 0; }
.title { font-size: 44rpx; font-weight: bold; color: #2B5BA3; display: block; }
.desc { font-size: 26rpx; color: #999; margin-top: 12rpx; display: block; }
.info-card { background: #fff; border-radius: 16rpx; padding: 30rpx; margin-bottom: 30rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.08); }
.info-row { display: flex; justify-content: space-between; padding: 16rpx 0; border-bottom: 1rpx solid #f0f0f0; }
.info-row:last-child { border-bottom: none; }
.info-label { font-size: 28rpx; color: #666; }
.info-value { font-size: 28rpx; color: #333; font-weight: bold; }
.start-btn { background: #2B5BA3; color: #fff; text-align: center; padding: 32rpx; border-radius: 16rpx; font-size: 34rpx; margin-bottom: 40rpx; }
.section-title { font-size: 30rpx; font-weight: bold; color: #333; margin-bottom: 16rpx; display: block; }
.history-item { background: #fff; border-radius: 12rpx; padding: 24rpx 30rpx; margin-bottom: 12rpx; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.08); }
.history-info { flex: 1; }
.history-date { font-size: 24rpx; color: #999; display: block; }
.history-score { font-size: 32rpx; font-weight: bold; display: block; margin-top: 8rpx; }
.history-score.pass { color: #4CAF50; }
.history-score.fail { color: #F44336; }
.history-status { font-size: 28rpx; font-weight: bold; padding: 8rpx 20rpx; border-radius: 8rpx; }
</style>

<template>
  <view class="page">
    <view class="result-card">
      <text :class="['result-status', passed ? 'pass' : 'fail']">
        {{ passed ? 'PASS' : 'FAIL' }}
      </text>
      <text class="score-text">{{ score }} / {{ total }}</text>
      <text class="percent-text">{{ percent }}%</text>
      <text class="duration-text">用时 {{ durationText }}</text>
    </view>

    <view class="pass-line">
      <text class="pass-label">及格线: 70% (53/75)</text>
    </view>

    <view class="actions">
      <view class="action-btn" @click="goBack">
        <text>返回</text>
      </view>
      <view class="action-btn primary" @click="retake">
        <text>再考一次</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';

const score = ref(0);
const total = ref(75);
const duration = ref(0);

const passed = computed(() => total.value > 0 && (score.value / total.value) >= 0.7);
const percent = computed(() => total.value > 0 ? Math.round((score.value / total.value) * 100) : 0);
const durationText = computed(() => {
  const m = Math.floor(duration.value / 60);
  const s = duration.value % 60;
  return `${m} 分 ${s} 秒`;
});

function goBack() {
  uni.navigateBack({ delta: 2 });
}

function retake() {
  uni.redirectTo({ url: '/pages/mock-exam/exam' });
}

onLoad((options) => {
  score.value = Number(options?.score) || 0;
  total.value = Number(options?.total) || 75;
  duration.value = Number(options?.duration) || 0;
});
</script>

<style scoped>
.page { padding: 30rpx; background: #f5f5f5; min-height: 100vh; }
.result-card { background: #fff; border-radius: 16rpx; padding: 60rpx 30rpx; text-align: center; margin-bottom: 30rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.08); }
.result-status { font-size: 64rpx; font-weight: bold; display: block; margin-bottom: 20rpx; }
.result-status.pass { color: #4CAF50; }
.result-status.fail { color: #F44336; }
.score-text { font-size: 48rpx; font-weight: bold; color: #333; display: block; }
.percent-text { font-size: 36rpx; color: #666; display: block; margin-top: 12rpx; }
.duration-text { font-size: 26rpx; color: #999; display: block; margin-top: 16rpx; }
.pass-line { text-align: center; margin-bottom: 40rpx; }
.pass-label { font-size: 26rpx; color: #999; }
.actions { display: flex; gap: 20rpx; }
.action-btn { flex: 1; background: #fff; text-align: center; padding: 30rpx; border-radius: 12rpx; font-size: 30rpx; color: #333; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.08); }
.action-btn.primary { background: #2B5BA3; color: #fff; }
</style>

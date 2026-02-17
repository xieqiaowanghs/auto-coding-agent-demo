<template>
  <view class="page">
    <!-- 用户信息卡片 -->
    <view class="user-card">
      <view class="avatar-wrap">
        <image v-if="avatarUrl" :src="avatarUrl" class="avatar-img" mode="aspectFill" />
        <text v-else class="avatar-placeholder">{{ userStore.isLoggedIn ? 'U' : '?' }}</text>
      </view>
      <view class="user-info">
        <text class="username">{{ nickname || (userStore.isLoggedIn ? '微信用户' : '未登录') }}</text>
        <text class="user-id" v-if="userStore.isLoggedIn">ID: {{ userStore.openid.slice(-6) }}</text>
      </view>
    </view>

    <!-- 功能菜单 -->
    <view class="menu-list">
      <view class="menu-item" @click="goTo('/pages/profile/stats')">
        <text class="menu-icon">📊</text>
        <text class="menu-text">学习统计</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="goTo('/pages/favorites/index')">
        <text class="menu-icon">⭐</text>
        <text class="menu-text">收藏夹</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="goTo('/pages/flashcards/index')">
        <text class="menu-icon">📇</text>
        <text class="menu-text">知识卡片</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <!-- 设置菜单 -->
    <view class="menu-list">
      <view class="menu-item" @click="setExamDate">
        <text class="menu-icon">📅</text>
        <text class="menu-text">考试倒计时</text>
        <text class="menu-value">{{ examDateDisplay }}</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="setDailyCount">
        <text class="menu-icon">📝</text>
        <text class="menu-text">每日一练题数</text>
        <text class="menu-value">{{ dailyCount }} 题</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="toggleReminder">
        <text class="menu-icon">🔔</text>
        <text class="menu-text">学习提醒</text>
        <text class="menu-value">{{ reminderOn ? '已开启' : '未开启' }}</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import userStore from '@/store/user';

const avatarUrl = ref('');
const nickname = ref('');
const examDate = ref('');
const dailyCount = ref(20);
const reminderOn = ref(false);

const examDateDisplay = computed(() => {
  if (!examDate.value) return '未设置';
  return examDate.value;
});

function loadSettings() {
  examDate.value = uni.getStorageSync('sie_exam_date') || '';
  dailyCount.value = uni.getStorageSync('daily_count') || 20;
  reminderOn.value = uni.getStorageSync('reminder_on') || false;
  avatarUrl.value = uni.getStorageSync('user_avatar') || '';
  nickname.value = uni.getStorageSync('user_nickname') || '';
}

function goTo(url: string) {
  uni.navigateTo({ url });
}

function setExamDate() {
  // #ifdef MP-WEIXIN
  uni.showModal({
    title: '设置考试日期',
    editable: true,
    placeholderText: 'YYYY-MM-DD',
    content: examDate.value,
    success(res) {
      if (res.confirm && res.content) {
        const dateStr = res.content.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          examDate.value = dateStr;
          uni.setStorageSync('sie_exam_date', dateStr);
        } else {
          uni.showToast({ title: '格式错误', icon: 'none' });
        }
      }
    },
  });
  // #endif
  // #ifndef MP-WEIXIN
  uni.showToast({ title: '请在小程序中设置', icon: 'none' });
  // #endif
}

function setDailyCount() {
  uni.showActionSheet({
    itemList: ['10 题', '20 题', '30 题'],
    success(res) {
      const counts = [10, 20, 30];
      dailyCount.value = counts[res.tapIndex];
      uni.setStorageSync('daily_count', dailyCount.value);
    },
  });
}

function toggleReminder() {
  reminderOn.value = !reminderOn.value;
  uni.setStorageSync('reminder_on', reminderOn.value);
  if (reminderOn.value) {
    // #ifdef MP-WEIXIN
    uni.showToast({ title: '提醒已开启', icon: 'success' });
    // #endif
  } else {
    uni.showToast({ title: '提醒已关闭', icon: 'none' });
  }
}

onShow(() => { loadSettings(); });
</script>

<style scoped>
.page { padding: 30rpx; background: #f5f5f5; min-height: 100vh; }
.user-card { display: flex; align-items: center; background: linear-gradient(135deg, #2B5BA3, #4A90D9); border-radius: 16rpx; padding: 40rpx 30rpx; margin-bottom: 24rpx; }
.avatar-wrap { width: 100rpx; height: 100rpx; border-radius: 50%; background: rgba(255,255,255,0.3); display: flex; align-items: center; justify-content: center; margin-right: 24rpx; overflow: hidden; }
.avatar-img { width: 100rpx; height: 100rpx; }
.avatar-placeholder { font-size: 48rpx; color: #fff; }
.user-info { flex: 1; }
.username { font-size: 32rpx; color: #fff; font-weight: bold; display: block; }
.user-id { font-size: 22rpx; color: rgba(255,255,255,0.7); margin-top: 8rpx; display: block; }
.menu-list { background: #fff; border-radius: 16rpx; overflow: hidden; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.08); margin-bottom: 24rpx; }
.menu-item { display: flex; align-items: center; padding: 32rpx 30rpx; border-bottom: 1rpx solid #f0f0f0; }
.menu-item:last-child { border-bottom: none; }
.menu-icon { font-size: 36rpx; margin-right: 20rpx; }
.menu-text { flex: 1; font-size: 28rpx; color: #333; }
.menu-value { font-size: 24rpx; color: #999; margin-right: 8rpx; }
.menu-arrow { font-size: 32rpx; color: #ccc; }
</style>

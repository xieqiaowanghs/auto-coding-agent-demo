<template>
  <view class="page">
    <!-- 统计 -->
    <view class="stats-bar" v-if="favorites.length > 0">
      <text class="stat">共 {{ favorites.length }} 题收藏</text>
    </view>

    <!-- 标签筛选 -->
    <view class="tag-bar" v-if="allTags.length > 0">
      <scroll-view scroll-x class="tag-scroll">
        <text :class="['tag-chip', !activeTag && 'active']" @click="activeTag = ''">全部</text>
        <text :class="['tag-chip', activeTag === t && 'active']"
              v-for="t in allTags" :key="t" @click="activeTag = t">{{ t }}</text>
      </scroll-view>
    </view>

    <!-- 收藏列表 -->
    <view class="list" v-if="filteredFavorites.length > 0">
      <view class="fav-item" v-for="item in filteredFavorites" :key="item._id">
        <view class="fav-info" @click="goToPractice">
          <text class="fav-stem">{{ item.stemPreview }}</text>
          <view class="fav-meta">
            <text class="meta-tag">Ch{{ item.chapter }}</text>
            <text class="meta-tag tag" v-if="item.tag">{{ item.tag }}</text>
          </view>
        </view>
        <view class="fav-actions">
          <text class="action-btn tag-btn" @click="showTagPicker(item)">标签</text>
          <text class="action-btn remove-btn" @click="removeFavorite(item)">取消</text>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view class="empty" v-if="!loading && favorites.length === 0">
      <text class="empty-icon">☆</text>
      <text class="empty-text">暂无收藏题目</text>
    </view>
    <view class="empty" v-else-if="!loading && filteredFavorites.length === 0">
      <text class="empty-text">该标签下暂无题目</text>
    </view>

    <!-- 开始练习按钮 -->
    <view class="practice-btn" v-if="filteredFavorites.length > 0" @click="goToPractice">
      <text>开始收藏练习 ({{ filteredFavorites.length }} 题)</text>
    </view>

    <!-- 标签选择弹窗 -->
    <view class="modal-mask" v-if="tagPickerVisible" @click="tagPickerVisible = false">
      <view class="modal-content" @click.stop>
        <text class="modal-title">设置标签</text>
        <view class="preset-tags">
          <text :class="['preset-tag', editingTag === t && 'selected']"
                v-for="t in presetTags" :key="t" @click="editingTag = t">{{ t }}</text>
        </view>
        <input class="tag-input" v-model="editingTag" placeholder="或输入自定义标签" maxlength="10" />
        <view class="modal-btns">
          <text class="modal-btn cancel" @click="tagPickerVisible = false">取消</text>
          <text class="modal-btn clear" v-if="editingItem?.tag" @click="saveTag('')">清除</text>
          <text class="modal-btn confirm" @click="saveTag(editingTag)">确定</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { db } from '@/utils/cloud';
import { getUserId } from '@/store/user';
import { COLLECTIONS } from '@/types/database';

interface FavItem {
  _id: string;
  question_id: string;
  tag: string;
  stemPreview: string;
  chapter: number;
}

const presetTags = ['重点', '易错', '公式题', '概念题'];

const favorites = ref<FavItem[]>([]);
const loading = ref(true);
const activeTag = ref('');

// 标签弹窗状态
const tagPickerVisible = ref(false);
const editingItem = ref<FavItem | null>(null);
const editingTag = ref('');

// 从收藏数据中提取所有已使用的标签
const allTags = computed(() => {
  const tags = new Set<string>();
  favorites.value.forEach(f => { if (f.tag) tags.add(f.tag); });
  return Array.from(tags);
});

// 按标签筛选
const filteredFavorites = computed(() => {
  if (!activeTag.value) return favorites.value;
  return favorites.value.filter(f => f.tag === activeTag.value);
});

async function loadFavorites() {
  const userId = getUserId();
  if (!userId) { loading.value = false; return; }
  try {
    const res = await db.collection(COLLECTIONS.USER_FAVORITES)
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(200)
      .get();
    const items: FavItem[] = [];
    for (const f of res.data as any[]) {
      let stemPreview = '';
      let chapter = 0;
      try {
        const qRes = await db.collection(COLLECTIONS.QUESTIONS).doc(f.question_id).get();
        const q = qRes.data as any;
        stemPreview = (q?.stem || '').slice(0, 50) + '...';
        chapter = q?.chapter || 0;
      } catch { /* skip */ }
      items.push({ _id: f._id, question_id: f.question_id, tag: f.tag || '', stemPreview, chapter });
    }
    favorites.value = items;
  } catch (e) {
    console.error('加载收藏失败:', e);
  } finally {
    loading.value = false;
  }
}

async function removeFavorite(item: FavItem) {
  try {
    await db.remove(COLLECTIONS.USER_FAVORITES, item._id);
    favorites.value = favorites.value.filter(f => f._id !== item._id);
    // 如果当前筛选标签已无题目，重置筛选
    if (activeTag.value && !favorites.value.some(f => f.tag === activeTag.value)) {
      activeTag.value = '';
    }
  } catch (e) {
    console.error('取消收藏失败:', e);
  }
}

function showTagPicker(item: FavItem) {
  editingItem.value = item;
  editingTag.value = item.tag;
  tagPickerVisible.value = true;
}

async function saveTag(tag: string) {
  if (!editingItem.value) return;
  const trimmed = tag.trim();
  try {
    await db.update(COLLECTIONS.USER_FAVORITES, editingItem.value._id, { tag: trimmed });
    const target = favorites.value.find(f => f._id === editingItem.value!._id);
    if (target) target.tag = trimmed;
  } catch (e) {
    console.error('更新标签失败:', e);
  }
  tagPickerVisible.value = false;
}

function goToPractice() {
  uni.navigateTo({ url: '/pages/practice/index?mode=favorites' });
}

onShow(() => { loadFavorites(); });
</script>

<style scoped>
.page { padding: 30rpx; background: #f5f5f5; min-height: 100vh; padding-bottom: 160rpx; }
.stats-bar { text-align: center; margin-bottom: 20rpx; }
.stat { font-size: 26rpx; color: #666; }
.tag-bar { margin-bottom: 20rpx; }
.tag-scroll { white-space: nowrap; }
.tag-chip { display: inline-block; font-size: 24rpx; color: #666; background: #fff; padding: 10rpx 24rpx; border-radius: 30rpx; margin-right: 16rpx; border: 2rpx solid #e0e0e0; }
.tag-chip.active { color: #fff; background: #2B5BA3; border-color: #2B5BA3; }
.fav-item { background: #fff; border-radius: 12rpx; padding: 24rpx 30rpx; margin-bottom: 12rpx; display: flex; align-items: center; box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.08); }
.fav-info { flex: 1; }
.fav-stem { font-size: 28rpx; color: #333; display: block; margin-bottom: 10rpx; }
.fav-meta { display: flex; gap: 12rpx; }
.meta-tag { font-size: 22rpx; color: #2B5BA3; background: rgba(43,91,163,0.08); padding: 4rpx 12rpx; border-radius: 6rpx; }
.meta-tag.tag { color: #FF9800; background: rgba(255,152,0,0.08); }
.fav-actions { display: flex; flex-direction: column; gap: 12rpx; margin-left: 16rpx; }
.action-btn { font-size: 24rpx; padding: 8rpx 16rpx; border-radius: 6rpx; text-align: center; }
.tag-btn { color: #2B5BA3; background: rgba(43,91,163,0.08); }
.remove-btn { color: #999; }
.empty { display: flex; flex-direction: column; align-items: center; padding-top: 300rpx; }
.empty-icon { font-size: 120rpx; color: #FFB300; }
.empty-text { font-size: 28rpx; color: #999; margin-top: 20rpx; }
.practice-btn { position: fixed; bottom: calc(40rpx + env(safe-area-inset-bottom)); left: 30rpx; right: 30rpx; background: #2B5BA3; color: #fff; text-align: center; padding: 28rpx; border-radius: 12rpx; font-size: 30rpx; }
/* 标签弹窗 */
.modal-mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 999; }
.modal-content { background: #fff; border-radius: 16rpx; padding: 40rpx; width: 80%; }
.modal-title { font-size: 32rpx; font-weight: bold; color: #333; display: block; margin-bottom: 30rpx; text-align: center; }
.preset-tags { display: flex; flex-wrap: wrap; gap: 16rpx; margin-bottom: 24rpx; }
.preset-tag { font-size: 26rpx; color: #666; background: #f5f5f5; padding: 12rpx 24rpx; border-radius: 8rpx; border: 2rpx solid #e0e0e0; }
.preset-tag.selected { color: #fff; background: #2B5BA3; border-color: #2B5BA3; }
.tag-input { border: 2rpx solid #e0e0e0; border-radius: 8rpx; padding: 16rpx 20rpx; font-size: 28rpx; margin-bottom: 30rpx; }
.modal-btns { display: flex; justify-content: flex-end; gap: 20rpx; }
.modal-btn { font-size: 28rpx; padding: 12rpx 32rpx; border-radius: 8rpx; }
.modal-btn.cancel { color: #999; }
.modal-btn.clear { color: #F44336; }
.modal-btn.confirm { color: #fff; background: #2B5BA3; }
</style>
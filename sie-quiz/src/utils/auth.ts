import { setUser, setLoading, clearUser } from '../store/user';
import { callFunction } from './cloud';

const STORAGE_KEY = 'sie_user_openid';

/** 静默登录：调用云函数获取 openid */
export async function silentLogin(): Promise<string> {
  setLoading(true);
  try {
    // 先检查本地缓存
    const cached = uni.getStorageSync(STORAGE_KEY);
    if (cached) {
      setUser(cached);
      return cached;
    }

    // #ifdef MP-WEIXIN
    const result = await callFunction<{ openid: string }>('login');
    if (result?.openid) {
      uni.setStorageSync(STORAGE_KEY, result.openid);
      setUser(result.openid);
      return result.openid;
    }
    // #endif

    // H5 或其他平台使用模拟 ID
    // #ifndef MP-WEIXIN
    const mockId = 'dev_user_' + Date.now();
    uni.setStorageSync(STORAGE_KEY, mockId);
    setUser(mockId);
    return mockId;
    // #endif

    throw new Error('登录失败：无法获取用户标识');
  } catch (err) {
    console.error('登录失败:', err);
    clearUser();
    throw err;
  } finally {
    setLoading(false);
  }
}

/** 退出登录 */
export function logout() {
  uni.removeStorageSync(STORAGE_KEY);
  clearUser();
}

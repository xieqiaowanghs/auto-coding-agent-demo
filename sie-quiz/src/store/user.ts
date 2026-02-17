import { reactive } from 'vue';

export interface UserState {
  /** 用户 openid，作为 user_id */
  openid: string;
  /** 是否已登录 */
  isLoggedIn: boolean;
  /** 是否正在登录 */
  loading: boolean;
}

const userStore = reactive<UserState>({
  openid: '',
  isLoggedIn: false,
  loading: false,
});

/** 设置用户登录信息 */
export function setUser(openid: string) {
  userStore.openid = openid;
  userStore.isLoggedIn = true;
  userStore.loading = false;
}

/** 清除用户信息 */
export function clearUser() {
  userStore.openid = '';
  userStore.isLoggedIn = false;
  userStore.loading = false;
}

/** 设置加载状态 */
export function setLoading(val: boolean) {
  userStore.loading = val;
}

/** 获取当前用户 ID */
export function getUserId(): string {
  return userStore.openid;
}

export default userStore;

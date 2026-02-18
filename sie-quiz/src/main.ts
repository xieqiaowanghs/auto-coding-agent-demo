import { createSSRApp } from "vue";
import App from "./App.vue";

// #ifdef MP-WEIXIN
wx.cloud.init({
  env: 'cloudbase-6guyl3x84f03f5e4',
  traceUser: true,
});
// #endif

export function createApp() {
  const app = createSSRApp(App);
  return {
    app,
  };
}

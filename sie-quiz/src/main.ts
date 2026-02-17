import { createSSRApp } from "vue";
import App from "./App.vue";

// #ifdef MP-WEIXIN
wx.cloud.init({
  traceUser: true,
});
// #endif

export function createApp() {
  const app = createSSRApp(App);
  return {
    app,
  };
}

<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
import { silentLogin } from "./utils/auth";

onLaunch(async () => {
  console.log("App Launch");
  try {
    const openid = await silentLogin();
    console.log("登录成功, openid:", openid);
  } catch (err) {
    console.error("自动登录失败:", err);
  }
});
onShow(() => {
  console.log("App Show");
});
onHide(() => {
  console.log("App Hide");
});
</script>
<style></style>

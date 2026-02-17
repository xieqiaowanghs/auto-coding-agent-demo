const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event) => {
  const { user_id } = event;
  if (!user_id) return { error: "user_id is required" };

  // 获取用户所有做题记录
  const records = await db.collection("user_records")
    .where({ user_id })
    .limit(2000)
    .get();

  if (records.data.length === 0) {
    return { weakChapters: [], weakCategories: [] };
  }

  // 收集题目信息
  const qIds = [...new Set(records.data.map(r => r.question_id))];
  const qMap = {};
  for (const qId of qIds) {
    try {
      const res = await db.collection("questions").doc(qId).get();
      if (res.data) qMap[qId] = { chapter: res.data.chapter, category: res.data.category };
    } catch (e) { /* skip */ }
  }

  // 按章节统计
  const chStats = {};
  // 按知识领域统计
  const catStats = {};

  for (const r of records.data) {
    const info = qMap[r.question_id];
    if (!info) continue;

    if (info.chapter) {
      if (!chStats[info.chapter]) chStats[info.chapter] = { total: 0, correct: 0 };
      chStats[info.chapter].total++;
      if (r.is_correct) chStats[info.chapter].correct++;
    }

    if (info.category) {
      if (!catStats[info.category]) catStats[info.category] = { total: 0, correct: 0 };
      catStats[info.category].total++;
      if (r.is_correct) catStats[info.category].correct++;
    }
  }

  const THRESHOLD = 60;

  const weakChapters = Object.entries(chStats)
    .map(([ch, v]) => ({ chapter: Number(ch), accuracy: Math.round((v.correct / v.total) * 100), total: v.total }))
    .filter(c => c.accuracy < THRESHOLD)
    .sort((a, b) => a.accuracy - b.accuracy);

  const weakCategories = Object.entries(catStats)
    .map(([cat, v]) => ({ category: cat, accuracy: Math.round((v.correct / v.total) * 100), total: v.total }))
    .filter(c => c.accuracy < THRESHOLD)
    .sort((a, b) => a.accuracy - b.accuracy);

  return { weakChapters, weakCategories };
};

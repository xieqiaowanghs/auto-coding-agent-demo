const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const COLLECTIONS = [
  "questions",
  "user_records",
  "user_favorites",
  "user_mistakes",
  "mock_exams",
  "flashcards",
  "daily_stats",
];

exports.main = async () => {
  const results = [];

  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name);
      results.push({ collection: name, status: "created" });
    } catch (err) {
      // 集合已存在时会抛错，属于正常情况
      results.push({ collection: name, status: "already_exists" });
    }
  }

  return { message: "数据库集合初始化完成", results };
};

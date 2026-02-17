const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION = "questions";
const BATCH_SIZE = 20; // 云开发单次批量写入上限

exports.main = async (event) => {
  const { questions } = event;
  if (!questions || !Array.isArray(questions)) {
    return { error: "questions array is required" };
  }

  let added = 0;
  let skipped = 0;

  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batch = questions.slice(i, i + BATCH_SIZE);

    for (const q of batch) {
      try {
        // 去重：按 chapter + stem 前50字符查重
        const stemKey = (q.stem || "").slice(0, 50);
        const existing = await db.collection(COLLECTION)
          .where({ chapter: q.chapter, stem: db.RegExp({ regexp: "^" + escapeRegex(stemKey) }) })
          .limit(1)
          .get();

        if (existing.data.length > 0) {
          skipped++;
          continue;
        }

        await db.collection(COLLECTION).add({
          data: {
            chapter: q.chapter,
            category: q.category || "",
            type: q.type || "single",
            stem: q.stem || "",
            options: q.options || [],
            answer: q.answer || "",
            explanation: q.explanation || "",
            difficulty: q.difficulty || "medium",
            created_at: db.serverDate(),
          },
        });
        added++;
      } catch (err) {
        console.error(`Failed to add question: ${err.message}`);
      }
    }
  }

  return { message: "题目导入完成", added, skipped, total: questions.length };
};

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

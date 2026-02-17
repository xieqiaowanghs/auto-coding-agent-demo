const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const COLLECTION = "flashcards";

exports.main = async (event) => {
  const { flashcards } = event;
  if (!flashcards || !Array.isArray(flashcards)) {
    return { error: "flashcards array is required" };
  }

  let added = 0;
  let skipped = 0;

  for (const card of flashcards) {
    try {
      // 去重：按 term 查重
      const existing = await db.collection(COLLECTION)
        .where({ term: card.term })
        .limit(1)
        .get();

      if (existing.data.length > 0) {
        skipped++;
        continue;
      }

      await db.collection(COLLECTION).add({
        data: {
          term: card.term || "",
          definition: card.definition || "",
          familiarity_level: "unknown",
          next_review_at: db.serverDate(),
        },
      });
      added++;
    } catch (err) {
      console.error(`Failed to add flashcard: ${err.message}`);
    }
  }

  return { message: "术语卡片导入完成", added, skipped, total: flashcards.length };
};

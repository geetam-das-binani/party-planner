import { redis } from "../config/redis.js";

export async function cacheConversation(sessionId, messages) {
  await redis.set(
    `conversation:${sessionId}`,

    JSON.stringify(messages),

    "EX",

    60 * 60,
  );
}

export async function getCachedConversation(sessionId) {
  const result = await redis.get(`conversation:${sessionId}`);

  if (!result) {
    return null;
  }

  return JSON.parse(result);
}

export async function invalidateConversationCache(sessionId) {
  await redis.del(`conversation:${sessionId}`);
}

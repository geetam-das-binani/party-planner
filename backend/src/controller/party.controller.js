import {
  getConversation,
  getPreferences,
  saveMessage,
  updatePreferences,
} from "../memory/memoryService.js";

import { extractMemory } from "../memory/extractMemory.js";
import { partyGraph } from "../graph/party.graph.js";

import {
  getCachedConversation,
  cacheConversation,
  invalidateConversationCache,
} from "../memory/redisMemory.js";

import { subscribeToAgentEvents } from "../events/eventBus.js";

export async function partyChat(req, res) {
  const { userId, sessionId, message, party } = req.body;

  if (!userId || !sessionId || !message) {
    return res.status(400).json({
      message: "userId, sessionId and message are required",
    });
  }

  // --------------------------------
  // SSE headers
  // --------------------------------
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let clientClosed = false;
  req.on("close", () => {
    clientClosed = true;
  });

  const sendEvent = (event) => {
    if (clientClosed || res.writableEnded) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  let unsubscribe = null;

  try {
    // --------------------------------
    // Subscribe to Redis agent events
    // (inside try so a failure here is reported and cleaned up)
    // --------------------------------
    unsubscribe = await subscribeToAgentEvents(sessionId, (event) => {
      sendEvent(event);
    });

    sendEvent({ type: "started", message: "Party planning started" });

    // --------------------------------
    // Get conversation (cache first, then DB)
    // No cache write here: it is refreshed after the assistant reply
    // --------------------------------
    let history = await getCachedConversation(sessionId);

    if (!history) {
      history = await getConversation(userId, sessionId);
    }

    // --------------------------------
    // Save user message, then invalidate cache so it can never be stale,
    // even if something fails later in this request
    // --------------------------------
    await saveMessage({
      userId,
      sessionId,
      role: "user",
      content: message,
    });

    await invalidateConversationCache(sessionId);

    // --------------------------------
    // Extract long-term memory
    // --------------------------------
    sendEvent({ type: "memory", message: "Checking user preferences..." });

    const extracted = await extractMemory(message);
    await updatePreferences(userId, extracted);

    const preferences = await getPreferences(userId);

    sendEvent({ type: "memory_updated", preferences });

    // --------------------------------
    // Party request
    // --------------------------------
    const request = {
      ...(party || {}),
      message,
    };

    // --------------------------------
    // Run graph
    // (history = previous turns only; current message is passed separately)
    // --------------------------------
    const result = await partyGraph.invoke({
      userId,
      sessionId,
      message,
      request,
      preferences,
      history,
    });

    // --------------------------------
    // Save assistant message
    // --------------------------------
    await saveMessage({
      userId,
      sessionId,
      role: "assistant",
      content: result.finalPlan,
    });

    // --------------------------------
    // Refresh Redis cache (best effort: the reply is already saved,
    // so a cache failure must not turn into a user-facing error)
    // --------------------------------
    try {
      const newHistory = await getConversation(userId, sessionId);
      await cacheConversation(sessionId, newHistory);
    } catch (cacheError) {
      console.error("Cache refresh failed:", cacheError);
      // cache was invalidated earlier, so the next request reads from DB
    }

    // --------------------------------
    // Final response
    // --------------------------------
    sendEvent({ type: "completed", plan: result.finalPlan });
  } catch (error) {
    console.error(error);

    sendEvent({
      type: "error",
      message: "Something went wrong while planning your party.",
    });
  } finally {
    try {
      if (unsubscribe) await unsubscribe();
    } catch (e) {
      console.error("Unsubscribe failed:", e);
    }

    if (!res.writableEnded) res.end();
  }
}



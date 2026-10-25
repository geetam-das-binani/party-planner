import Redis from "ioredis";
import { redis } from "../config/redis.js";

const publisher = redis;
const subscriber = new Redis(process.env.REDIS_URL);

subscriber.on("error", (err) => {
  console.error("Redis subscriber error:", err);
});

// channel -> Set of callbacks
const listeners = new Map();

// One shared handler for all channels
subscriber.on("message", (channel, message) => {
  const callbacks = listeners.get(channel);
  if (!callbacks) return;

  let event;
  try {
    event = JSON.parse(message);
  } catch (err) {
    console.error(`Bad pub/sub message on ${channel}:`, err);
    return;
  }

  for (const cb of callbacks) {
    try {
      cb(event);
    } catch (err) {
      console.error(`Subscriber callback failed on ${channel}:`, err);
    }
  }
});

export async function publishAgentEvent(sessionId, event) {
  await publisher.publish(`party:${sessionId}`, JSON.stringify(event));
}

export async function subscribeToAgentEvents(sessionId, callback) {
  const channel = `party:${sessionId}`;

  let callbacks = listeners.get(channel);
  if (!callbacks) {
    callbacks = new Set();
    listeners.set(channel, callbacks);
    await subscriber.subscribe(channel); // only subscribe on first listener
  }
  callbacks.add(callback);

  return async () => {
    const set = listeners.get(channel);
    if (!set) return;

    set.delete(callback);

    if (set.size === 0) {
      listeners.delete(channel);
      await subscriber.unsubscribe(channel); // only unsubscribe when last one leaves
    }
  };
}
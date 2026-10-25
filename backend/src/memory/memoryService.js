import { Message, UserPreference } from "./model.js";

export async function saveMessage({ userId, sessionId, role, content }) {
  return Message.create({
    userId,
    sessionId,
    role,
    content,
  });
}

export async function getConversation(userId, sessionId) {
  return Message.find({
    userId,
    sessionId,
  })
    .sort({
      createdAt: 1,
    })
    .limit(20)
    .lean();
}

export async function getPreferences(userId) {
  const result = await UserPreference.findOne({
    userId,
  }).lean();

  return result?.preferences || {};
}

export async function updatePreferences(userId, extracted) {
  const current = await getPreferences(userId);

  const merged = {
    ...current,
  };

  for (const [key, value] of Object.entries(extracted)) {
    if (value !== null && value !== undefined) {
      if (Array.isArray(value)) {
        merged[key] = [...(merged[key] || []), ...value];
      } else {
        merged[key] = value;
      }
    }
  }

  return UserPreference.findOneAndUpdate(
    {
      userId,
    },

    {
      $set: {
        preferences: merged,
      },
    },

    {
      upsert: true,
      new: true,
    },
  );
}

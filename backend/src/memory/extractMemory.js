import { memoryAgent } from "../agents/memory.agent.js";

export async function extractMemory(message) {
  const result = await memoryAgent.invoke({
    messages: [
      {
        role: "user",

        content: message,
      },
    ],
  });

  return result?.structuredResponse;
}

import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";

if (!process.env.GROQ_API_KEY) {
  throw new Error("GROQ_API_KEY is missing from backend/.env");
}

export const llm = new ChatOpenAI({
  model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
  apiKey: process.env.GROQ_API_KEY,
  temperature: 0.2,
  maxTokens: 800,
  configuration: {
    baseURL: "https://api.groq.com/openai/v1",
  },
});


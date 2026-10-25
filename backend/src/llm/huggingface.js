import { InferenceClient } from "@huggingface/inference";

const hf = new InferenceClient(process.env.HF_TOKEN);

export async function chatWithLLM(messages) {
  const response = await hf.chatCompletion({
    model: process.env.HF_MODEL,

    messages,

    temperature: 0.2,

    max_tokens: 2000,
  });

  return response.choices[0]?.message?.content || "";
}

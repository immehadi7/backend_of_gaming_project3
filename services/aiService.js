import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;

const client = apiKey
  ? new OpenAI({ apiKey })
  : null;

export const handleAIResponse = async (message) => {
  const input = typeof message === "string" ? message.trim() : "";

  if (!input) {
    return "Please send a message first.";
  }

  if (!client) {
    return "AI service is not configured yet.";
  }

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input,
    });

    return response.output_text?.trim() || "No response generated.";
  } catch (error) {
    console.error("OpenAI request failed:", error);
    return "AI service is temporarily unavailable.";
  }
};

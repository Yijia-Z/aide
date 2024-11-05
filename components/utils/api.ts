import { Thread, Model } from "../types";
import { findAllParentMessages } from "./helpers";

const apiBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

export async function generateAIResponse(
  prompt: string,
  role: string,
  model: Model,
  threads: Thread[],
  currentThread: string | null,
  replyingTo: string | null
) {
  const requestPayload = {
    messages: [
      { role: "system", content: model.systemPrompt },
      ...findAllParentMessages(threads, currentThread, replyingTo).map(
        (msg) => ({
          role: msg.publisher === "user" ? "user" : "assistant",
          content: msg.content,
        })
      ),
      { role: role === "user" ? "user" : "assistant", content: prompt },
    ],
    configuration: {
      model: model.baseModel,
      ...model.parameters,
    },
  };

  console.log("Request payload:", JSON.stringify(requestPayload, null, 2));

  const response = await fetch(
    // apiBaseUrl ? `${apiBaseUrl}/api/chat` : "/api/chat",
    "/api/chat",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload),
    }
  );
  console.log(response);
  if (!response.ok) {
    throw new Error("Failed to generate AI response");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Failed to get response reader");
  }

  return reader;
}

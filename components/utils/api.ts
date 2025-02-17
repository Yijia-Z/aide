import { Thread, Model, Tool } from "../types";
import { findAllParentMessages } from "./helpers";

export async function generateAIResponse(
  prompt: string,
  role: string,
  model: Model,
  threads: Thread[],
  currentThread: string | null,
  replyingTo: string | null,
  tools: Tool[],
  onData: (chunk: string) => void,
  userKey?: string, 
  abortController?: AbortController
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
      tools,
    },
    userKey
  };

  // console.log("Request payload:", JSON.stringify(requestPayload, null, 2));
  // console.log(`Fetching API at: /api/chat`);

  const response = await fetch(
    "/api/chat",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload),
      signal: abortController?.signal
    }
  );
 
  if (!response.ok) {
    throw new Error("Failed to generate AI response");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Failed to get response reader");
  }
  const decoder = new TextDecoder("utf-8");
  let doneReading = false;
  while (!doneReading) {
    const { value, done } = await reader.read();
    doneReading = done;
    if (value) {
      const chunkValue = decoder.decode(value, { stream: true });
      onData(chunkValue); // 使用回调处理每个数据块
    }
  }

  return reader;
}

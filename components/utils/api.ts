import { Thread, Model } from "../types";
import { findAllParentMessages } from "./helpers";



export async function generateAIResponse(
  prompt: string,
  role: string,
  model: Model,
  threads: Thread[],
  currentThread: string | null,
  replyingTo: string | null,
  tools: any[], 
  onData: (chunk: string) => void

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
  };

  console.log("Request payload:", JSON.stringify(requestPayload, null, 2));
  const apiUrl = "http://localhost:3000/api/chat";
  console.log(`Fetching API at: ${apiUrl}`);

  const response = await fetch(
    apiUrl,
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

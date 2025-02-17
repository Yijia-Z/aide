// handleSelectMessage.ts
import { updateMessageInThread } from "./updateMessageInThread";
import { fetchMessageLatest } from "../../lib/frontapi/messageApi";
import type { Thread, Message } from "../types";

interface HandleSelectMessageArgs {
  message: Message;
  setSelectedMessages: React.Dispatch<
    React.SetStateAction<{ [threadId: string]: string | null }>
  >;
  currentThread: string;
  setThreads: React.Dispatch<React.SetStateAction<Thread[]>>;
  // 如果你还需要别的参数，如 setClipboardMessage、 setEditingMessage 等
  // 都可以加进来
}

export async function handleSelectMessage({
  message,
  setSelectedMessages,
  currentThread,
  setThreads,
}: HandleSelectMessageArgs) {
  // 先选中
  setSelectedMessages((prev) => ({ ...prev, [currentThread]: message.id }));
  console.trace("[handleSelectMessage] triggered");

  // 如果 publisher !== "ai"，想更新最新状态
  if (message.publisher !== "ai") {
    try {

      const freshMsg = await fetchMessageLatest(message.id);
      // 拿到 freshMsg 后，更新 threads
      console.log("[handleSelectMessage] => freshMsg =", freshMsg);
      setThreads((prevThreads) =>
        updateMessageInThread(prevThreads, currentThread, freshMsg)
      );
    } catch (err) {
      console.error("Failed to fetch latest msg =>", err);
    }
  }
}

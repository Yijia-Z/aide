import { Message, Thread } from "../types";

export function findMessageAndParents(
    messages: Message[],
    targetId: string,
    parents: Message[] = []
    ): [Message | null, Message[]] {
    for (const message of messages) {
      if (message.id === targetId) {
        return [message, parents];
      }
      const [found, foundParents] = findMessageAndParents(message.replies, targetId, [...parents, message]);
      if (found) return [found, foundParents];
    }
    return [null, []];
  }
  
export function getSiblings(messages: Message[], messageId: string): Message[] {
    const [_, parents] = findMessageAndParents(messages, messageId);
    if (parents.length === 0) return messages;
    return parents[parents.length - 1].replies;
}
  
  // Recursive function to find all parent messages for a given message
export function findAllParentMessages(
    threads: Thread[],
    currentThreadId: string | null,
    replyingToId: string | null
    ): Message[] {
    if (!currentThreadId || !replyingToId) return [];
  
    const currentThread = threads.find((thread) => thread.id === currentThreadId);
    if (!currentThread) return [];
  
    const [_, parentMessages] = findMessageAndParents(currentThread.messages, replyingToId);
    return parentMessages;
}
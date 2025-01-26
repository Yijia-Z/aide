import { Message, Thread } from "../types";

/**
 * 在 allThreads 中找到指定 threadId 的线程，
 * 然后在该线程的 messages 中递归寻找与 newMsg.id 相同的消息并更新。
 * 若找不到则保持原样。
 * 
 * 会在控制台输出调试信息，告诉你是否在此线程里找到了对应的 message。
 */
export function updateMessageInThread(
  allThreads: Thread[],
  threadId: string | null,
  newMsg: Message
): Thread[] {
  if (!threadId) return allThreads;

  // 用一个外部变量来记录：是否在递归过程中找到了目标消息
  let foundMessage = false;

  /**
   * 内部函数：在 messages 中寻找 newMsg.id，并返回新数组
   */
  function replaceMessage(messages: Message[]): Message[] {
    return messages.map((m) => {
      if (m.id === newMsg.id) {
        foundMessage = true;
        // 用不可变方式合并新数据
        return { ...m, ...newMsg };
      }
      if (m.replies.length > 0) {
        // 若没匹配到，则递归处理它的子 replies
        const newReplies = replaceMessage(m.replies);
        // 若子 replies 替换了，就返回一个新的 message
        if (newReplies !== m.replies) {
          return { ...m, replies: newReplies };
        }
      }
      // 否则保持原对象不变
      return m;
    });
  }

  return allThreads.map((th) => {
    if (th.id !== threadId) {
      return th;
    }

    // 对匹配到的 thread 执行替换
    const newMessages = replaceMessage(th.messages);

    if (foundMessage) {
      console.log(
        `[updateMessageInThread] Replaced message "${newMsg.id}" in thread "${threadId}"`
      );
    } else {
      console.warn(
        `[updateMessageInThread] DID NOT FIND message "${newMsg.id}" in thread "${threadId}"`
      );
    }

    // 返回新线程
    return {
      ...th,
      messages: newMessages,
    };
  });
}

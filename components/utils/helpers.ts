import { Message, Thread } from "../types";
import { useCallback } from "react";

/**
 * Check if content is likely HTML by looking for common HTML tags
 * @param content String to check
 * @returns boolean indicating if content appears to be HTML
 */
export function isContentHTML(content: string): boolean {
  if (!content || typeof content !== 'string') return false;
  
  // Check for complete HTML documents (with <!DOCTYPE> or <html>...</html>)
  const hasCompleteHtmlDocument = /<!DOCTYPE[\s\S]*?>[\s\S]*?<html[\s\S]*?>|<html[\s\S]*?>[\s\S]*?<\/html>/i.test(content);
  
  // If we have a complete HTML document, consider it HTML
  if (hasCompleteHtmlDocument) {
    return true;
  }
  
  // For more complex heuristics, look for combinations of HTML structural tags
  const htmlTags = [
    '<script', '</script>',
    '<style', '</style>',
    '<div', '</div>',
    '<body', '</body>',
    '<head', '</head>',
    '<table', '</table>',
    '<form', '</form>'
  ];
  
  // Count matches for common HTML tags
  const tagCount = htmlTags.filter(tag => content.includes(tag)).length;
  
  // If we have multiple HTML tag matches, it's likely HTML content
  if (tagCount >= 3) {
    return true;
  }
  
  return false;
}

export function findMessageAndParents(
  messages: Message[],
  targetId: string,
  parents: Message[] = []
): [Message | null, Message[]] {
  for (const message of messages) {
    if (message.id === targetId) {
      return [message, parents];
    }
    const [found, foundParents] = findMessageAndParents(
      message.replies,
      targetId,
      [...parents, message]
    );
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

  const [_, parentMessages] = findMessageAndParents(
    currentThread.messages,
    replyingToId
  );
  return parentMessages;
}

// export // Helper methods
// const getModelDetails = (modelId: string | undefined) => {
//   if (!modelId) return null;
//   const model = models.find(m => m.id === modelId);
//   if (!model) return null;
//   return {
//     name: model.name,
//     baseModel: model.baseModel.split('/').pop(),
//     temperature: model.parameters.temperature,
//     maxTokens: model.parameters.max_tokens,
//     systemPrompt: model.systemPrompt,
//   };
// };

// // Confirm editing a message
// const confirmEditingMessage = useCallback(
//   (threadId: string, messageId: string) => {
//     setThreads((prev: Thread[]) =>
//       prev.map((thread) => {
//         if (thread.id !== threadId) return thread;
//         const editMessage = (messages: Message[]): Message[] => {
//           return messages.map((message) => {
//             if (message.id === messageId) {
//               return { ...message, content: editingContent };
//             }
//             return { ...message, replies: editMessage(message.replies) };
//           });
//         };
//         return { ...thread, messages: editMessage(thread.messages) };
//       })
//     );
//     setEditingMessage(null);
//     setEditingContent("");
//   },
//   [editingContent]
// );

// const fetchAvailableModels = useCallback(async () => {
//   try {
//     // Check if models are already cached in localStorage
//     const cachedModels = localStorage.getItem('availableModels');
//     const lastFetchTime = localStorage.getItem('lastFetchTime');
//     const currentTime = Date.now();

//     // If cached models exist and were fetched less than an hour ago, use them
//     if (cachedModels && lastFetchTime && currentTime - parseInt(lastFetchTime) < 3600000) {
//       const modelData = JSON.parse(cachedModels);
//       setAvailableModels(modelData);
//       return modelData;
//     }

//     // Fetch from API if no valid cache is found
//     const response = await fetch("https://openrouter.ai/api/v1/models", {
//       method: "GET",
//       headers: {
//         Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENROUTER_API_KEY}`,
//         "Content-Type": "application/json",
//       },
//     });

//     if (!response.ok) {
//       const errorText = await response.text();
//       console.error("Failed to fetch available models from OpenRouter:", errorText);
//       throw new Error("Failed to fetch available models from OpenRouter");
//     }

//     const data = await response.json();
//     console.log("Received data from OpenRouter:", data);

//     if (!data.data) {
//       console.error('Response data does not contain "data" key.');
//       throw new Error("Invalid response format from OpenRouter");
//     }

//     const modelData = data.data.map((model: any) => {
//       const maxOutput = model.top_provider?.max_completion_tokens ?? model.context_length ?? 9999;
//       return {
//         id: model.id,
//         name: model.name,
//         baseModel: model.id,
//         systemPrompt: "",
//         parameters: {
//           top_p: 1,
//           temperature: 0.7,
//           frequency_penalty: 0,
//           presence_penalty: 0,
//           top_k: 0,
//           max_tokens: maxOutput, // Set initial max_tokens to maxOutput
//           max_output: maxOutput, // Include max_output in the parameters
//         },
//       };
//     });

//     // Cache the fetched models and update the fetch time
//     localStorage.setItem('availableModels', JSON.stringify(modelData));
//     localStorage.setItem('lastFetchTime', currentTime.toString());

//     setAvailableModels(modelData);
//     return modelData;
//   } catch (error) {
//     console.error("Error fetching available models:", error);
//     return [];
//   }
// }, []);

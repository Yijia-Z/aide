import { useState, useCallback, useEffect } from "react";
import { Message } from "../../components/types";

export function useMessages() {
  const [selectedMessages, setSelectedMessages] = useState<{ [key: string]: string | null }>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [clipboardMessage, setClipboardMessage] = useState<{
    message: Message;
    operation: "copy" | "cut";
    sourceThreadId: string | null;
    originalMessageId: string | null;
  } | null>(null);
  const [glowingMessageIds, setGlowingMessageIds] = useState<string[]>([]);
  const [lastGenerateCount, setLastGenerateCount] = useState<number>(3);

  const addGlowingMessage = useCallback((id: string) => {
    setGlowingMessageIds((prev) => Array.from(new Set([...prev, id])));
  }, []);

  const removeGlowingMessage = useCallback((id: string) => {
    setGlowingMessageIds((prev) => prev.filter((messageId) =>
      messageId !== id || (clipboardMessage?.originalMessageId === id)
    ));
  }, [clipboardMessage]);

  const clearGlowingMessages = useCallback(() => {
    setGlowingMessageIds([]);
  }, []);

  return {
    selectedMessages,
    setSelectedMessages,
    replyingTo,
    setReplyingTo,
    editingMessage,
    setEditingMessage,
    editingContent,
    setEditingContent,
    clipboardMessage,
    setClipboardMessage,
    glowingMessageIds,
    setGlowingMessageIds,
    addGlowingMessage,
    removeGlowingMessage,
    clearGlowingMessages,
    lastGenerateCount,
    setLastGenerateCount,
  };
}

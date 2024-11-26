import { useState, useCallback, useEffect } from "react";
import { Message } from "../types";

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
  const [glowingMessageId, setGlowingMessageId] = useState<string | null>(null);

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
    glowingMessageId,
    setGlowingMessageId,
  };
}

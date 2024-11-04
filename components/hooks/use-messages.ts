import { useState, useCallback, useEffect } from 'react';
import { Message } from '../types';

export function useMessages() {
    const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
    const [editingMessage, setEditingMessage] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState("");
    const [clipboardMessage, setClipboardMessage] = useState<{
        message: Message;
        operation: "copy" | "cut";
        sourceThreadId: string | null;
        originalMessageId: string | null;
    } | null>(null);

    return {
        selectedMessage,
        setSelectedMessage,
        editingMessage,
        setEditingMessage,
        editingContent,
        setEditingContent,
        clipboardMessage,
        setClipboardMessage
    };
}
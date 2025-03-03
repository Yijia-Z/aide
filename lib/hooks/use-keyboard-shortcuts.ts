import { useCallback, useEffect } from 'react';
import { Message, Thread } from '@/components/types';

interface UseKeyboardShortcutsProps {
    selectedMessages: { [key: string]: string | null };
    editingMessage: string | null;
    currentThread: string | null;
    editingThreadTitle: string | null;
    cancelEditThreadTitle: () => void;
    threads: Thread[];
    editingModel: any | null;
    generateAIReply: (threadId: string, messageId: string, count?: number) => Promise<void>;
    addEmptyReply: (threadId: string, parentId: string | null, publisher?: "user" | "ai") => Promise<void>;
    startEditingMessage: (message: Message) => void;
    handleDeleteMessage: (threadId: string, messageId: string, deleteOption: boolean | 'clear') => Promise<void>;
    findMessageById: (messages: Message[], id: string) => Message | null;
    confirmEditingMessage: (threadId: string, messageId: string) => Promise<void>;
    cancelEditingMessage: () => void;
    saveModelChanges: () => Promise<void>;
    clipboardMessage: any;
    copyOrCutMessage: (threadId: string, messageId: string, operation: "copy" | "cut") => Promise<void>;
    findMessageAndParents: (messages: Message[], targetId: string, parents?: Message[]) => [Message | null, Message[]];
    getSiblings: (messages: Message[], messageId: string) => Message[];
    handlePasteMessage: (threadId: string, parentId: string | null) => Promise<void>;
    setClipboardMessage: (value: any) => void;
    setEditingModel: (value: any) => void;
    setEditingThreadTitle: (value: string) => void;
    setSelectedMessages: (value: any) => void;
    clearGlowingMessages: () => void;
    toggleCollapse: (threadId: string, messageId: string) => void;
    lastGenerateCount: number;
}

export function useKeyboardShortcuts({
    selectedMessages,
    editingMessage,
    currentThread,
    editingThreadTitle,
    cancelEditThreadTitle,
    threads,
    editingModel,
    generateAIReply,
    addEmptyReply,
    startEditingMessage,
    handleDeleteMessage,
    findMessageById,
    confirmEditingMessage,
    cancelEditingMessage,
    saveModelChanges,
    clipboardMessage,
    copyOrCutMessage,
    findMessageAndParents,
    getSiblings,
    handlePasteMessage,
    setClipboardMessage,
    setEditingModel,
    setEditingThreadTitle,
    setSelectedMessages,
    clearGlowingMessages,
    toggleCollapse,
    lastGenerateCount
}: UseKeyboardShortcutsProps) {

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        const activeElement = document.activeElement;
        const isInputFocused = activeElement instanceof HTMLInputElement ||
            activeElement instanceof HTMLTextAreaElement;

        // Handle special input cases first
        if (isInputFocused) {
            // Thread title editing
            if (editingThreadTitle && activeElement.id === `thread-title-${editingThreadTitle}`) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    setEditingThreadTitle('');
                }
                else if (event.key === 'Escape') {
                    event.preventDefault();
                    cancelEditThreadTitle();
                }
                return;
            }

            // Message editing
            if (editingMessage && activeElement.id === `message-edit-${editingMessage}`) {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                    event.preventDefault();
                    if (currentThread) {
                        confirmEditingMessage(currentThread, editingMessage);
                    }
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    cancelEditingMessage();
                }
                return;
            }

            // Model editing
            if (editingModel && (activeElement.id === `model-textarea-${editingModel.id}` || activeElement.id === `model-title-${editingModel.id}`)) {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                    event.preventDefault();
                    saveModelChanges();
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    setEditingModel(null);
                }
                return;
            }
            return;
        }

        // Handle thread-level operations
        if (currentThread) {
            const key = event.key.toLowerCase();
            const selectedMessage = selectedMessages[currentThread];

            // Copy/Cut/Paste operations
            if ((event.metaKey || event.ctrlKey)) {
                if (selectedMessage && key === 'c') {
                    event.preventDefault();
                    copyOrCutMessage(currentThread, selectedMessage, "copy");
                    return;
                }
                if (selectedMessage && key === 'x') {
                    event.preventDefault();
                    copyOrCutMessage(currentThread, selectedMessage, "cut");
                    return;
                }
                if (key === 'v') {
                    event.preventDefault();
                    handlePasteMessage(currentThread, selectedMessage || null);
                    return;
                }
            }

            // New message at root level
            if (key === 'n') {
                event.preventDefault();
                addEmptyReply(currentThread, null);
                return;
            }
        }

        // Handle message-level operations
        if (currentThread && selectedMessages[currentThread] && !isInputFocused) {
            const selectedMessage = selectedMessages[currentThread]
            const currentThreadData = threads.find((t) => t.id === currentThread);
            if (!currentThreadData) return;

            const [currentMessage, parentMessages] = findMessageAndParents(currentThreadData.messages, selectedMessage);
            if (!currentMessage) return;

            const parentMessage = parentMessages.length > 0 ? parentMessages[parentMessages.length - 1] : null;
            const siblings = getSiblings(currentThreadData.messages, selectedMessage);
            const currentIndex = siblings.findIndex((m) => m.id === currentMessage.id);
            const message = findMessageById(currentThreadData.messages, selectedMessage);

            // Navigation keys
            switch (event.key) {
                case "ArrowLeft":
                    if (parentMessage) {
                        event.preventDefault();
                        setSelectedMessages((prev: any) => ({ ...prev, [String(currentThread)]: parentMessage.id }));
                    }
                    break;
                case "ArrowRight":
                    if (currentMessage.replies.length > 0) {
                        event.preventDefault();
                        setSelectedMessages((prev: any) => ({ ...prev, [String(currentThread)]: currentMessage.replies[0].id }));
                        if (currentMessage.isCollapsed) {
                            toggleCollapse(currentThread, currentMessage.id);
                        }
                    }
                    break;
                case "ArrowUp":
                    if (currentIndex > 0) {
                        event.preventDefault();
                        setSelectedMessages((prev: any) => ({ ...prev, [String(currentThread)]: siblings[currentIndex - 1].id }));
                    }
                    break;
                case "ArrowDown":
                    if (currentIndex < siblings.length - 1) {
                        event.preventDefault();
                        setSelectedMessages((prev: any) => ({ ...prev, [String(currentThread)]: siblings[currentIndex + 1].id }));
                    }
                    break;

                // Action keys  
                case "r":
                    event.preventDefault();
                    if (message && message.isCollapsed) {
                        toggleCollapse(currentThread, selectedMessage);
                    }
                    addEmptyReply(currentThread, selectedMessage);
                    break;
                case "Enter":
                    if (event.ctrlKey || event.metaKey) {
                        event.preventDefault();
                        if (message && message.isCollapsed) {
                            toggleCollapse(currentThread, selectedMessage);
                        }
                        generateAIReply(currentThread, selectedMessage, lastGenerateCount);
                    } else {
                        event.preventDefault();
                        if (message && message.isCollapsed) {
                            toggleCollapse(currentThread, selectedMessage);
                        }
                        generateAIReply(currentThread, selectedMessage);
                    }
                    break;
                case "c":
                    event.preventDefault();
                    toggleCollapse(currentThread, selectedMessage);
                    break;
                case "e":
                    if (!editingMessage || editingMessage !== selectedMessage) {
                        event.preventDefault();
                        const message = findMessageById(currentThreadData.messages, selectedMessage);
                        if (message) {
                            startEditingMessage(message);
                        }
                    }
                    break;
                case "Escape":
                    if (clipboardMessage) {
                        clearGlowingMessages();
                        setClipboardMessage(null);
                    }
                    else setSelectedMessages((prev: any) => ({ ...prev, [String(currentThread)]: null }))
                    break;
                case "Delete":
                case "Backspace":
                    event.preventDefault();
                    if (event.ctrlKey || event.metaKey) {
                        handleDeleteMessage(currentThread, selectedMessage, true);
                    } else if (event.altKey) {
                        handleDeleteMessage(currentThread, selectedMessage, 'clear');
                    } else {
                        handleDeleteMessage(currentThread, selectedMessage, false);
                    }
                    break;
                case "Tab":
                    event.preventDefault();
                    break;
            }
        }
    }, [
        selectedMessages,
        editingMessage,
        currentThread,
        editingThreadTitle,
        cancelEditThreadTitle,
        threads,
        editingModel,
        generateAIReply,
        addEmptyReply,
        startEditingMessage,
        handleDeleteMessage,
        findMessageById,
        confirmEditingMessage,
        cancelEditingMessage,
        saveModelChanges,
        clipboardMessage,
        copyOrCutMessage,
        findMessageAndParents,
        getSiblings,
        handlePasteMessage,
        setClipboardMessage,
        setEditingModel,
        setEditingThreadTitle,
        setSelectedMessages,
        clearGlowingMessages,
        toggleCollapse,
        lastGenerateCount
    ]);

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [handleKeyDown]);

    return { handleKeyDown };
} 
import { useCallback } from 'react';
import { Thread, Message } from '@/components/types';
import { storage } from '@/components/store';
import { v4 as uuidv4 } from 'uuid';

interface UseThreadDataProps {
    setThreads: (value: Thread[] | ((prev: Thread[]) => Thread[])) => void;
    setCurrentThread: (value: string | null) => void;
    isSignedIn: boolean;
}

export function useThreadData({
    setThreads,
    setCurrentThread,
    isSignedIn
}: UseThreadDataProps) {
    // Fetch a single thread
    const fetchSingleThread = useCallback(async (threadId: string) => {
        try {
            console.log("[fetchSingleThread] actually fetching => threadId =", threadId);

            // 1) Get messages
            const resMessages = await fetch(`/api/messages?threadId=${threadId}`);
            if (!resMessages.ok) {
                throw new Error("Failed to fetch messages for thread");
            }
            const dataMessages = await resMessages.json();
            console.log("[fetchSingleThread] dataMessages=", dataMessages);

            function initCollapse(messages: any[]): Message[] {
                return messages.map((msg) => {
                    msg.isCollapsed = false;
                    msg.userCollapsed = false;
                    if (Array.isArray(msg.replies) && msg.replies.length > 0) {
                        msg.replies = initCollapse(msg.replies);
                    }
                    return msg;
                });
            }

            const initMessages = Array.isArray(dataMessages.messages)
                ? initCollapse(dataMessages.messages)
                : [];

            // 2) Get thread basic info (including updatedAt)
            const resThreadInfo = await fetch(`/api/threads/${threadId}`);
            if (!resThreadInfo.ok) {
                throw new Error("Failed to fetch thread info");
            }
            const dataThread = await resThreadInfo.json();
            const serverThread = dataThread.thread; // { id, updatedAt, isPinned, etc.}

            // 3) Merge into frontend state
            setThreads((prevThreads) => {
                const newThreads = prevThreads.map((th) => {
                    if (th.id !== threadId) return th;
                    return {
                        ...th,
                        // Update with backend data
                        updatedAt: serverThread.updatedAt,
                        isPinned: serverThread.isPinned ?? th.isPinned,
                        messages: initMessages,
                        hasFetchedMessages: true,
                    };
                });
                // 4) Write to localStorage
                storage.set("threads", newThreads);
                return newThreads;
            });
        } catch (err) {
            console.error("[fetchSingleThread] error =>", err);
        }
    }, [setThreads]);

    // Create a welcome thread
    const createWelcomeThread = useCallback((): Thread => {
        const threadId = uuidv4();
        const messageId = uuidv4();
        const childMessageId = uuidv4();

        return {
            id: threadId,
            title: "Welcome to AIDE",
            isPinned: false,
            role: "OWNER",
            updatedAt: new Date().toISOString(),
            messages: [
                {
                    id: messageId,
                    content: [
                        {
                            type: "text",
                            text: `# 👋 Welcome to AIDE!

Core concepts (click to expand):

- **Create new threads** in the Threads tab
- **Reply to messages** under each thread
- **Generate AI responses** using Enter key (Ctrl/Cmd+Enter for multi-runs)
- **Configure Model Parameters and Tools** in the Models/Tools tab
- **Use keyboard shortcuts** (press '?' to view all)

Feel free to delete this thread and create your own!`}
                    ],
                    publisher: "ai",
                    replies: [
                        {
                            id: childMessageId,
                            content: [
                                {
                                    type: "text",
                                    text: "This is a child message. You can navigate to parent messages using the 'Left' arrow key and to child messages using the 'Right' arrow key."
                                }
                            ],
                            publisher: "ai",
                            replies: [],
                            isCollapsed: false,
                            userCollapsed: false
                        }
                    ],
                    isCollapsed: false,
                    userCollapsed: false
                }
            ]
        };
    }, []);

    // Sync welcome thread to backend
    const syncWelcomeThreadToBackend = useCallback(async (thread: Thread) => {
        const res = await fetch("/api/threads/welcome", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ thread }),
        });
        if (!res.ok) {
            throw new Error(`syncWelcomeThread failed => status = ${res.status}`);
        }
        const data = await res.json();
        return data;
    }, []);

    // Load threads
    const loadThreads = useCallback(async () => {
        try {
            const response = await fetch(`/api/threads`, {
                method: "GET",
            });

            if (response.ok) {
                const data = await response.json();

                if (data.threads?.length > 0) {
                    setThreads(data.threads);
                    storage.set("threads", data.threads);
                } else {
                    const localThreads = storage.get("threads") || [];

                    if (localThreads.length > 0) {
                        // Use local threads if available
                        setThreads(localThreads);
                        setCurrentThread(localThreads[0].id);
                    } else {
                        // Create welcome thread if no threads exist
                        const welcomeThread = createWelcomeThread();
                        setThreads([welcomeThread]);
                        storage.set("threads", [welcomeThread]);
                        setCurrentThread(welcomeThread.id);

                        if (isSignedIn) {
                            try {
                                // Sync welcome thread to backend
                                await syncWelcomeThreadToBackend(welcomeThread);
                                console.log("Welcome thread successfully synced to backend!");
                            } catch (err) {
                                console.error("Failed to sync welcome thread =>", err);
                            }
                        }
                    }
                }
            } else {
                // API error - create welcome thread locally
                const welcomeThread = createWelcomeThread();
                setThreads([welcomeThread]);
                setCurrentThread(welcomeThread.id);
            }
        } catch (error) {
            console.error("Load failed:", error);
            // Network/other error - create welcome thread locally
            const welcomeThread = createWelcomeThread();
            setThreads([welcomeThread]);
            setCurrentThread(welcomeThread.id);
            storage.set("threads", [welcomeThread]);
        }
    }, [setThreads, setCurrentThread, createWelcomeThread, syncWelcomeThreadToBackend, isSignedIn]);

    return {
        fetchSingleThread,
        createWelcomeThread,
        syncWelcomeThreadToBackend,
        loadThreads
    };
}
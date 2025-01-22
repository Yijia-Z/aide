import { useState, useCallback, useEffect } from "react";
import { Thread } from "../types";
import { storage } from "../store";

export function useThreads() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentThread, setCurrentThread] = useState<string | null>(null);
  const [editingThreadTitle, setEditingThreadTitle] = useState<string | null>(null);
  const [originalThreadTitle, setOriginalThreadTitle] = useState<string>("");
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null);
  const [newThreadId, setNewThreadId] = useState<string | null>(null);

  // Save currentThread to localStorage whenever it changes
  useEffect(() => {
    if (currentThread) {
      storage.set('currentThread', currentThread);
    } else {
      storage.remove('currentThread');
    }
  }, [currentThread]);
  return {
    threads,
    setThreads,
    currentThread,
    setCurrentThread,
    editingThreadTitle,
    setEditingThreadTitle,
    originalThreadTitle,
    setOriginalThreadTitle,
    threadToDelete,
    setThreadToDelete,
    newThreadId,
    setNewThreadId,
  };
}
import { useState, useCallback, useEffect } from "react";
import { Thread } from "../types";

export function useThreads() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentThread, setCurrentThread] = useState<string | null>(null);
  const [editingThreadTitle, setEditingThreadTitle] = useState<string | null>(
    null
  );
  const [originalThreadTitle, setOriginalThreadTitle] = useState<string>("");
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null);

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
    setThreadToDelete
  };
}

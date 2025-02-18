import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ListPlus, Check, X, Pin, PinOff, Trash, Share } from "lucide-react";
import { Thread } from "@/components/types";
import React, { useState } from "react";
import { InviteModal } from "./InviteModal";
import { useThreadsQuery } from "@/components/hooks/use-threads-query";
import { Skeleton } from "@/components/ui/skeleton";
import { v4 as uuidv4 } from "uuid";

interface ThreadListProps {
  currentThread: string | null;
  editingThreadTitle: string | null;
  setCurrentThread: (id: string | null) => void;
  setSelectedMessages: React.Dispatch<React.SetStateAction<{ [key: string]: string | null }>>;
  cancelEditThreadTitle: () => void;
  confirmEditThreadTitle: (id: string, title: string) => void;
  startEditingThreadTitle: (id: string, title: string) => void;
  toggleThreadPin: (id: string) => void;
  deleteThread: (id: string) => void;
  threadToDelete: string | null;
  setThreadToDelete: React.Dispatch<React.SetStateAction<string | null>>;
  newThreadId: string | null;
  setNewThreadId: React.Dispatch<React.SetStateAction<string | null>>;
}

const ThreadList: React.FC<ThreadListProps> = ({
  currentThread,
  editingThreadTitle,
  setCurrentThread,
  setSelectedMessages,
  cancelEditThreadTitle,
  confirmEditThreadTitle,
  startEditingThreadTitle,
  toggleThreadPin,
  threadToDelete,
  setThreadToDelete,
  deleteThread,
  newThreadId,
  setNewThreadId,
}) => {
  const [inviteThreadId, setInviteThreadId] = useState<string | null>(null);
  const {
    data: threads = [],
    isLoading,
    updateThread,
    togglePin,
    deleteThread: deleteThreadMutation,
    addThread: addThreadMutation
  } = useThreadsQuery();

  // Sort threads with pinned threads first, then by id in descending order
  const sortedThreads = threads.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    const aTime = new Date(a.updatedAt ?? 0).getTime();
    const bTime = new Date(b.updatedAt ?? 0).getTime();
    return bTime - aTime;
  });

  const handleTogglePin = async (threadId: string) => {
    try {
      await togglePin.mutateAsync(threadId);
      // Call parent's toggleThreadPin for any additional side effects
      toggleThreadPin(threadId);
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  };

  const handleDeleteThread = async (threadId: string) => {
    try {
      // First call the mutation to handle optimistic updates and server sync
      await deleteThreadMutation.mutateAsync(threadId);

      // Then handle UI state updates
      setThreadToDelete(null);
      if (currentThread === threadId) {
        setCurrentThread(null);
      }

      // Call parent's deleteThread for any additional side effects
      deleteThread(threadId);
    } catch (error) {
      console.error('Failed to delete thread:', error);
    }
  };

  const handleUpdateTitle = async (threadId: string, title: string) => {
    try {
      await updateThread.mutateAsync({
        threadId,
        updates: { title }
      });
      confirmEditThreadTitle(threadId, title);
      if (threadId === newThreadId) {
        setNewThreadId(null);
      }
    } catch (error) {
      console.error('Failed to update thread title:', error);
    }
  };

  const handleAddThread = async () => {
    try {
      const newId = uuidv4();
      const result = await addThreadMutation.mutateAsync({
        id: newId,
        title: "Unnamed Thread"
      });

      if (result?.thread) {
        setSelectedMessages((prev) => ({ ...prev, [String(currentThread)]: null }));
        startEditingThreadTitle(result.thread.id, result.thread.title);
        setNewThreadId(result.thread.id);
        setCurrentThread(result.thread.id);
      }
    } catch (error) {
      console.error('Failed to add thread:', error);
    }
  };

  return (
    <div className="flex flex-col relative h-[calc(97vh)]">
      <div
        className="top-bar bg-gradient-to-b from-background/100 to-background/00 select-none"
        style={{
          mask: "linear-gradient(black, black, transparent)",
          backdropFilter: "blur(1px)",
        }}
      >
        <h2 className="text-4xl font-serif font-bold pl-2">Threads</h2>
        <Button
          className="bg-background hover:bg-secondary custom-shadow transition-scale-zoom text-primary border border-border absolute right-0"
          size="default"
          onClick={handleAddThread}
        >
          <ListPlus className="h-4 w-4" />
          <span className="ml-2 hidden lg:inline">New Thread</span>
        </Button>
      </div>
      <ScrollArea
        className="flex-auto"
        onClick={() => {
          setCurrentThread(null);
          if (editingThreadTitle) {
            cancelEditThreadTitle();
          }
        }}
      >
        <AnimatePresence>
          <motion.div className="my-2">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="mb-2 pl-2">
                  <Skeleton
                    className="h-10 w-full rounded-lg"
                    style={{
                      opacity: 1 - (index * 0.125)
                    }}
                  />
                </div>
              ))
            ) : (
              sortedThreads.map((thread) => (
                <motion.div
                  key={thread.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  whileHover={{
                    y: -2,
                  }}
                  className={`
                    select-none
                    font-serif
                    cursor-pointer
                    rounded-lg
                    mb-2
                    md:hover:shadow-[inset_0_0_10px_10px_rgba(128,128,128,0.2)]
                    active:shadow-[inset_0px_0px_10px_rgba(0,0,0,0.7)]
                    ${currentThread === thread.id
                      ? "bg-background custom-shadow"
                      : "bg-transparent text-muted-foreground"
                    }
                  `}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentThread(thread.id);
                  }}
                >
                  <div className="flex-grow group">
                    {editingThreadTitle === thread.id ? (
                      <div className="flex items-center pl-1 gap-1 justify-between">
                        <Input
                          id={`thread-title-${thread.id}`}
                          autoFocus
                          value={thread.title}
                          placeholder="Input title..."
                          onChange={(e) =>
                            updateThread.mutate({
                              threadId: thread.id,
                              updates: { title: e.target.value }
                            })
                          }
                          className="min-font-size flex-grow h-8 p-1 my-1"
                          onClick={(e) => e.stopPropagation()}
                          maxLength={64}
                        />
                        <div className="flex items-center">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateTitle(thread.id, thread.title);
                            }}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (thread.id === newThreadId) {
                                handleDeleteThread(newThreadId);
                              }
                              cancelEditThreadTitle();
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="flex items-center justify-between"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          startEditingThreadTitle(thread.id, thread.title);
                        }}
                      >
                        <div className="flex items-center flex-grow">
                          <div className="group/pin">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTogglePin(thread.id);
                              }}
                            >
                              {thread.isPinned ? (
                                <>
                                  <Pin className="h-4 w-4 hidden md:block md:group-hover/pin:hidden" />
                                  <PinOff className="h-4 w-4 md:hidden md:group-hover/pin:block" />
                                </>
                              ) : (
                                <Pin className="h-4 w-4 md:opacity-0 md:group-hover:opacity-100 transition-opacity" />
                              )}
                            </Button>
                          </div>
                          <span className="pl-1 flex-grow">{thread.title || <span className="text-muted-foreground">Unnamed Thread</span>}</span>
                        </div>

                        <div className="flex items-center">
                          {thread.role === "OWNER" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInviteThreadId(thread.id);
                              }}
                            >
                              <Share className="h-4 w-4 md:opacity-0 md:group-hover:opacity-100" />
                            </Button>
                          )}

                          <div className="md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            {threadToDelete === thread.id ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteThread(thread.id);
                                  }}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setThreadToDelete(null);
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setThreadToDelete(thread.id);
                                }}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        </AnimatePresence>
      </ScrollArea>
      {inviteThreadId && (
        <InviteModal
          threadId={inviteThreadId}
          onClose={() => setInviteThreadId(null)}
        />
      )}
    </div>
  );
};

export default ThreadList;

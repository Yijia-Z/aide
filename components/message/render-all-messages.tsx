import React from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { CheckCheck, Clipboard, ClipboardPaste, ClipboardType, ClipboardX, Diff, Pencil, MessageSquareOff, MessageSquarePlus, MessageSquareReply, MoveHorizontal, MoveVertical, Trash, Trash2, WandSparkles, X } from "lucide-react";
import RenderMessage from './render-message';
import { Thread, Message } from '@/components/types';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";

interface RenderMessagesProps {
  threads: Thread[];
  currentThread: string | null;
  selectedMessages: { [key: string]: string | null };
  editingMessage: string | null;
  editingContent: string;
  glowingMessageIds: string[];
  addGlowingMessage: (id: string) => void;
  removeGlowingMessage: (id: string) => void;
  clearGlowingMessages: () => void;
  copiedStates: { [key: string]: boolean };
  clipboardMessage: { message: Message; operation: "copy" | "cut"; sourceThreadId: string | null; originalMessageId: string | null; } | null;
  isGenerating: { [key: string]: boolean };
  setSelectedMessages: React.Dispatch<React.SetStateAction<{ [key: string]: string | null }>>;
  toggleCollapse: (threadId: string, messageId: string) => void;
  setEditingContent: (content: string) => void;
  confirmEditingMessage: (threadId: string, messageId: string) => void;
  cancelEditingMessage: () => void;
  startEditingMessage: (message: Message) => void;
  addEmptyReply: (threadId: string, parentId: string | null) => void;
  generateAIReply: (threadId: string, messageId: string, count: number) => void;
  copyOrCutMessage: (threadId: string, messageId: string, operation: "copy" | "cut") => void;
  pasteMessage: (threadId: string, parentId: string | null) => void;
  deleteMessage: (threadId: string, messageId: string, deleteChildren: boolean | "clear") => void;
  findMessageById: (messages: Message[], id: string) => Message | null;
  findMessageAndParents: (messages: Message[], targetId: string, parents?: Message[]) => [Message | null, Message[]];
  getSiblings: (messages: Message[], messageId: string) => Message[];
  getModelDetails: (modelId: string | undefined) => any;
  setCopiedStates: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  setThreads: React.Dispatch<React.SetStateAction<Thread[]>>;
  setClipboardMessage: React.Dispatch<React.SetStateAction<{ message: Message; operation: "copy" | "cut"; sourceThreadId: string | null; originalMessageId: string | null; } | null>>;
  lastGenerateCount: number;
  setLastGenerateCount: React.Dispatch<React.SetStateAction<number>>;
}

const RenderMessages: React.FC<RenderMessagesProps> = ({
  threads,
  currentThread,
  selectedMessages,
  editingMessage,
  editingContent,
  glowingMessageIds,
  addGlowingMessage,
  removeGlowingMessage,
  clearGlowingMessages,
  copiedStates,
  clipboardMessage,
  isGenerating,
  setSelectedMessages,
  toggleCollapse,
  setEditingContent,
  confirmEditingMessage,
  cancelEditingMessage,
  startEditingMessage,
  addEmptyReply,
  generateAIReply,
  copyOrCutMessage,
  pasteMessage,
  deleteMessage,
  findMessageById,
  findMessageAndParents,
  getSiblings,
  getModelDetails,
  setCopiedStates,
  setThreads,
  setClipboardMessage,
  lastGenerateCount,
  setLastGenerateCount,
}) => {
  const currentThreadData = threads.find((t) => t.id === currentThread);

  return currentThread ? (
    <div
      className={`flex flex-col relative sm:h-full h-[calc(97vh)] hide-scrollbar bg-[radial-gradient(hsl(var(--muted))_1px,transparent_1px)] [background-size:16px_16px] [background-position:9px_0]`}
    >
      <div
        className="top-bar md:pr-2 bg-gradient-to-b from-background/100 to-background/00"
        style={{
          mask: "linear-gradient(black, black, transparent)",
          backdropFilter: "blur(1px)",
        }}
      >
        <h1 className="text-2xl font-serif font-bold pl-2 overflow-hidden">
          <span className="block truncate text-2xl sm:text-sm md:text-base lg:text-xl xl:text-2xl">
            {currentThreadData?.title}
          </span>
        </h1>
        {currentThread && (
          <Menubar className="p-0 border-none bg-transparent">
            <MenubarMenu>
              <MenubarTrigger asChild>
                <Button
                  className="px-4 bg-transparent hover:bg-secondary custom-shadow transition-scale-zoom text-primary border border-border"
                  size="default"
                >
                  <MessageSquarePlus className="h-4 w-4" />
                  <span className="ml-2 hidden md:inline">New Message</span>
                </Button>
              </MenubarTrigger>
              <MenubarContent className="custom-shadow">
                <MenubarItem
                  onClick={(e) => {
                    e.stopPropagation();
                    cancelEditingMessage();
                    addEmptyReply(currentThread, null);
                  }}
                >
                  <MessageSquarePlus className="mr-2 h-4 w-4" />
                  New Message
                  <MenubarShortcut className="hidden md:inline">N</MenubarShortcut>
                </MenubarItem>
                <MenubarItem
                  onClick={() => {
                    pasteMessage(currentThread, null)
                  }}
                >
                  {clipboardMessage ? (
                    <ClipboardPaste className="mr-2 h-4 w-4" />
                  ) : (
                    <ClipboardType className="mr-2 h-4 w-4" />
                  )}
                  <span>{clipboardMessage ? "Paste Message" : "Paste Clipboard"}</span>
                  <MenubarShortcut className="hidden ml-2 md:inline">⌘ V</MenubarShortcut>
                </MenubarItem>
                {clipboardMessage && (
                  <MenubarItem
                    onClick={() => {
                      setClipboardMessage(null);
                      clearGlowingMessages();
                    }}
                  >
                    <ClipboardX className="mr-2 h-4 w-4" />
                    <span>Clear {clipboardMessage?.operation === "cut" ? "Cut" : "Copied"}</span>
                    <MenubarShortcut className="hidden md:inline">Esc</MenubarShortcut>
                  </MenubarItem>
                )}
              </MenubarContent>
            </MenubarMenu>
          </Menubar>
        )}
      </div>
      <ScrollArea className="flex-gro md:pr-2" onClick={() => setSelectedMessages((prev) => ({ ...prev, [String(currentThread)]: null }))}>
        <div onClick={(e) => e.stopPropagation()}>
          {currentThreadData?.messages.map((message: Message) => (
            <RenderMessage
              key={message.id}
              message={message}
              threadId={currentThread}
              threads={threads}
              currentThread={currentThread}
              selectedMessages={selectedMessages}
              editingMessage={editingMessage}
              editingContent={editingContent}
              glowingMessageIds={glowingMessageIds}
              addGlowingMessage={addGlowingMessage}
              removeGlowingMessage={removeGlowingMessage}
              clearGlowingMessages={clearGlowingMessages}
              copiedStates={copiedStates}
              clipboardMessage={clipboardMessage}
              isGenerating={isGenerating}
              setSelectedMessages={setSelectedMessages}
              toggleCollapse={toggleCollapse}
              setEditingContent={setEditingContent}
              confirmEditingMessage={confirmEditingMessage}
              cancelEditingMessage={cancelEditingMessage}
              startEditingMessage={startEditingMessage}
              addEmptyReply={addEmptyReply}
              generateAIReply={generateAIReply}
              copyOrCutMessage={copyOrCutMessage}
              pasteMessage={pasteMessage}
              deleteMessage={deleteMessage}
              findMessageById={findMessageById}
              findMessageAndParents={findMessageAndParents}
              getSiblings={getSiblings}
              getModelDetails={getModelDetails}
              setCopiedStates={setCopiedStates}
              setThreads={setThreads}
              setClipboardMessage={setClipboardMessage}
              lastGenerateCount={lastGenerateCount}
              setLastGenerateCount={setLastGenerateCount}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  ) : (
    <div className="flex items-center justify-center h-full select-none">
      <div className="hidden sm:block">
        <p className="text-sm text-muted-foreground whitespace-pre pl-16">
          <span> <Diff className="inline-block mr-1 w-3 h-3" /> C                    ┃ Toggle Collapse</span><br />
          <span> <MoveHorizontal className="inline-block mr-1 w-3 h-3" /> ←/→                  ┃ Navigate Parent/Child</span><br />
          <span> <MoveVertical className="inline-block mr-1 w-3 h-3" /> ↑/↓                  ┃ Navigate Siblings</span><br /><br />
          <span> <MessageSquarePlus className="inline-block mr-1 w-3 h-3" /> N                    ┃ New Message</span><br />
          <span> <MessageSquareReply className="inline-block mr-1 w-3 h-3" /> R                    ┃ Reply</span><br />
          <span> <Pencil className="inline-block mr-1 w-3 h-3" /> E/Double-click       ┃ Edit</span><br />
          <span> <WandSparkles className="inline-block mr-1 w-3 h-3" /> Enter                ┃ Generate Single Reply</span><br />
          <span> <CheckCheck className="inline-block mr-1 w-3 h-3" /> Ctrl/Cmd + Enter     ┃ Confirm Edit | Multi-Generate</span><br />
          <span> <X className="inline-block mr-1 w-3 h-3" /> Escape               ┃ Cancel Edit | Select | Clipboard</span><br />
          <span> <Clipboard className="inline-block mr-1 w-3 h-3" /> Ctrl/Cmd + C | X | V ┃ Copy | Cut | Paste</span><br /><br />
          <span> <Trash className="inline-block mr-1 w-3 h-3" /> Delete/Backspace     ┃ Delete Single Message</span><br />
          <span> <Trash2 className="inline-block mr-1 w-3 h-3" /> Ctrl/Cmd + Delete    ┃ Delete with Replies</span><br />
          <span> <MessageSquareOff className="inline-block mr-1 w-3 h-3" /> Alt/Option + Delete  ┃ Delete only Replies</span>
        </p>
        <div className="mt-4 text-center text-sm text-muted-foreground font-serif">
          <span>Select a thread to view messages.</span>
          <br />
          <a
            href="https://github.com/yijia-z/aide"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline pl-1"
          >
            GitHub
          </a>
          <span className="mx-2">|</span>
          <a href="mailto:z@zy-j.com" className="hover:underline">
            Contact
          </a>
        </div>
      </div>
      <div className="sm:hidden fixed bottom-20 left-0 right-0 p-4 text-center text-sm text-muted-foreground bg-background font-serif">
        <span>Select a thread to view messages.</span>
        <br />
        <a
          href="https://github.com/yijia-z/aide"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline pl-3"
        >
          GitHub
        </a>
        <span className="mx-2">|</span>
        <a href="mailto:z@zy-j.com" className="hover:underline">
          Contact
        </a>
      </div>
    </div>
  );
};

export default RenderMessages;
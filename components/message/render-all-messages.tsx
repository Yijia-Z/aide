import React from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ClipboardPaste, ClipboardType, ClipboardX, MessageSquarePlus } from "lucide-react";
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
  glowingMessageId: string | null;
  copiedStates: { [key: string]: boolean };
  clipboardMessage: { message: Message; operation: "copy" | "cut"; sourceThreadId: string | null; originalMessageId: string | null; } | null;
  isGenerating: { [key: string]: boolean };
  setSelectedMessages: React.Dispatch<React.SetStateAction<{ [key: string]: string | null }>>;
  toggleCollapse: (threadId: string, messageId: string) => void;
  setGlowingMessageId: (id: string | null) => void;
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
}

const RenderMessages: React.FC<RenderMessagesProps> = ({
  threads,
  currentThread,
  selectedMessages,
  editingMessage,
  editingContent,
  glowingMessageId,
  copiedStates,
  clipboardMessage,
  isGenerating,
  setSelectedMessages,
  toggleCollapse,
  setGlowingMessageId,
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
}) => {
  const currentThreadData = threads.find((t) => t.id === currentThread);

  return currentThread ? (
    <div
      className={`flex flex-col relative sm:h-full h-[calc(97vh)] hide-scrollbar bg-[radial-gradient(hsl(var(--muted))_1px,transparent_1px)] [background-size:16px_16px]`}
    >
      <div
        className="top-bar bg-gradient-to-b from-background/100 to-background/00"
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
                    setGlowingMessageId(null);
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
                      setGlowingMessageId(null);
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
      <ScrollArea className="flex-grow" onClick={() => setSelectedMessages((prev) => ({ ...prev, [String(currentThread)]: null }))}>
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
              glowingMessageId={glowingMessageId}
              copiedStates={copiedStates}
              clipboardMessage={clipboardMessage}
              isGenerating={isGenerating}
              setSelectedMessages={setSelectedMessages}
              toggleCollapse={toggleCollapse}
              setGlowingMessageId={setGlowingMessageId}
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
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  ) : (
    <div className="flex items-center justify-center h-full select-none">
      <div className="hidden sm:block">
        <p className="text-sm text-muted-foreground whitespace-pre">
          <span> C                    ┃ Toggle collapse</span><br />
          <span> ←/→                  ┃ Navigate parent/child</span><br />
          <span> ↑/↓                  ┃ Navigate siblings</span><br /><br />
          <span> R                    ┃ Reply</span><br />
          <span> E/Double-click       ┃ Edit</span><br />
          <span> Enter                ┃ Generate | Confirm</span><br />
          <span> Escape               ┃ Cancel edit/copy</span><br />
          <span> Ctrl/Cmd + C | X | V ┃ Copy | Cut | Paste</span><br /><br />
          <span> Delete/Backspace     ┃ Delete single message</span><br />
          <span> Shift + Delete       ┃ Delete with replies</span><br />
          <span> Alt/Option + Delete  ┃ Delete only replies</span>
        </p>
        <div className="mt-4 text-center text-sm text-muted-foreground font-serif">
          <span>Select a thread to view messages.</span>
          <br />
          <a
            href="https://github.com/yijia-z/aide"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline pl-2"
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
          className="hover:underline"
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
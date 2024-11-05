import React from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus } from "lucide-react";
import RenderMessage from './render-message';
import { Thread, Message } from '@/components/types';

interface RenderMessagesProps {
  threads: Thread[];
  currentThread: string | null;
  selectedMessage: string | null;
  editingMessage: string | null;
  editingContent: string;
  glowingMessageId: string | null;
  copiedStates: { [key: string]: boolean };
  clipboardMessage: { message: Message; operation: "copy" | "cut"; sourceThreadId: string | null; originalMessageId: string | null; } | null;
  isGenerating: boolean;
  setSelectedMessage: (id: string | null) => void;
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
  deleteMessage: (threadId: string, messageId: string, deleteChildren: boolean) => void;
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
  selectedMessage,
  editingMessage,
  editingContent,
  glowingMessageId,
  copiedStates,
  clipboardMessage,
  isGenerating,
  setSelectedMessage,
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
        className={`flex flex-col relative sm:h-full h-[calc(97vh)] hide-scrollbar`}
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
            <Button
              className="bg-background hover:bg-secondary custom-shadow transition-scale-zoom text-primary border border-border select-none"
              size="default"
              onClick={(e) => {
                e.stopPropagation();
                cancelEditingMessage();
                addEmptyReply(currentThread, null);
              }}
            >
              <MessageSquarePlus className="h-4 w-4" />
              <span className="ml-2 hidden md:inline">New Message</span>
            </Button>
          )}
        </div>
        <ScrollArea className="flex-grow" onClick={() => setSelectedMessage(null)}>
          <div className="mb-4" onClick={(e) => e.stopPropagation()}>
            {currentThreadData?.messages.map((message: Message) => (
							<RenderMessage
								key={message.id}
								message={message}
								threadId={currentThread}
								threads={threads}
								currentThread={currentThread}
								selectedMessage={selectedMessage}
								editingMessage={editingMessage}
								editingContent={editingContent}
								glowingMessageId={glowingMessageId}
								copiedStates={copiedStates}
								clipboardMessage={clipboardMessage}
								isGenerating={isGenerating}
								setSelectedMessage={setSelectedMessage}
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
            <span>  ←/→ Arrow keys        ┃ Navigate parent/children</span><br />
            <span>  ↑/↓ Arrow keys        ┃ Navigate on same level</span><br />
            <span>  R                     ┃ Reply</span><br />
            <span>  G                     ┃ Generate AI reply</span><br />
            <span>  E/Double-click        ┃ Edit message</span><br />
            <span>  Enter                 ┃ Confirm edit</span><br />
            <span>  Escape                ┃ Cancel edit</span><br />
            <span>  Delete                ┃ Delete message</span><br />
            <span>  Shift+Delete          ┃ Delete with replies</span>
          </p>
          <div className="mt-4 text-center text-sm text-muted-foreground font-serif">
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
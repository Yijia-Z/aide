import React from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus } from "lucide-react";

interface Message {
  id: string;
  content: string;
  publisher: "user" | "ai";
  replies: Message[];
}

interface Thread {
  id: string;
  title: string;
  messages: Message[];
}

interface MessageViewProps {
  threads: Thread[];
  currentThread: string | null;
  selectedMessage: string | null;
  setSelectedMessage: (messageId: string | null) => void;
  cancelEditingMessage: () => void;
  addEmptyReply: (threadId: string, parentId: string | null) => void;
  renderMessage: (message: Message, threadId: string) => React.ReactNode;
}

const MessageView: React.FC<MessageViewProps> = ({
  threads,
  currentThread,
  selectedMessage,
  setSelectedMessage,
  cancelEditingMessage,
  addEmptyReply,
  renderMessage
}) => {
  const currentThreadData = threads.find((t) => t.id === currentThread);

  if (!currentThread) {
    return (
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
  }

  return (
    <div className={`flex flex-col relative sm:h-full h-[calc(97vh)] hide-scrollbar`}>
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
      </div>
      <ScrollArea className="flex-grow" onClick={() => setSelectedMessage(null)}>
        <div className="mb-4" onClick={(e) => e.stopPropagation()}>
          {currentThreadData?.messages.map((message: Message) =>
            renderMessage(message, currentThread)
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default MessageView;
import React from "react";
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
  selectedMessages: { [key: string]: string | null };
  setSelectedMessages: React.Dispatch<React.SetStateAction<{ [key: string]: string | null }>>;
  cancelEditingMessage: () => void;
  addEmptyReply: (threadId: string, parentId: string | null) => void;
  renderMessage: (message: Message, threadId: string) => React.ReactNode;
}

const MessageView: React.FC<MessageViewProps> = ({
  threads,
  currentThread,
  selectedMessages,
  setSelectedMessages,
  cancelEditingMessage,
  addEmptyReply,
  renderMessage,
}) => {
  const currentThreadData = threads.find((t) => t.id === currentThread);

  return (
    <div
      className={`flex flex-col relative sm:h-full h-[calc(97vh)] hide-scrollbar`}
    >
      <div
        className="top-bar bg-linear-to-b from-background/100 to-background/00"
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
            currentThread && addEmptyReply(currentThread, null);
          }}
        >
          <MessageSquarePlus className="h-4 w-4" />
          <span className="ml-2 hidden md:inline">New Message</span>
        </Button>
      </div>
      <ScrollArea
        className="grow"
        onClick={() => setSelectedMessages((prev) => ({ ...prev, [String(currentThread)]: null }))}
      >
        <div className="mb-4" onClick={(e) => e.stopPropagation()}>
          {currentThreadData?.messages.map((message: Message) =>
            currentThread && renderMessage(message, currentThread)
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default MessageView;

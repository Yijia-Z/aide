import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import Message from './message';
import { Message as MessageType } from '../types';

interface MessageListProps {
  messages: MessageType[];
  selectedMessage: string | null;
  onSelectMessage: (id: string) => void;
  onReplyToMessage: (id: string) => void;
  onEditMessage: (id: string) => void;
  onDeleteMessage: (id: string) => void;
  onCopyMessage: (id: string) => void;
  onCutMessage: (id: string) => void;
  onToggleMessageCollapse: (id: string) => void;
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  selectedMessage,
  onSelectMessage,
  onReplyToMessage,
  onEditMessage,
  onDeleteMessage,
  onCopyMessage,
  onCutMessage,
  onToggleMessageCollapse,
}) => {
  const renderMessages = (msgs: MessageType[], depth = 0) => {
    return msgs.map((message) => (
      <div key={message.id} style={{ marginLeft: `${depth * 20}px` }}>
        <Message
          message={message}
          isSelected={selectedMessage === message.id}
          onSelect={onSelectMessage}
          onReply={onReplyToMessage}
          onEdit={onEditMessage}
          onDelete={onDeleteMessage}
          onCopy={onCopyMessage}
          onCut={onCutMessage}
          onToggleCollapse={onToggleMessageCollapse}
        />
        {message.replies.length > 0 && renderMessages(message.replies, depth + 1)}
      </div>
    ));
  };

  return (
    <ScrollArea className="h-[calc(100vh-200px)] pr-4">
      {renderMessages(messages)}
    </ScrollArea>
  );
};

export default MessageList;
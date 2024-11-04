import React from 'react';
import { Thread as ThreadType, Message } from '../types';
import ThreadTitle from './thread-title';
import MessageList from '../message/message-list';

interface ThreadProps {
  thread: ThreadType;
  onEditTitle?: (threadId: string, newTitle: string) => void;
  selectedMessage: string | null;
  onSelectMessage: (id: string) => void;
  onReplyToMessage: (id: string) => void;
  onEditMessage: (id: string) => void;
  onDeleteMessage: (id: string) => void;
  onCopyMessage: (id: string) => void;
  onCutMessage: (id: string) => void;
  onToggleMessageCollapse: (id: string) => void;
}

const Thread: React.FC<ThreadProps> = ({ 
  thread, 
  onEditTitle,
  selectedMessage,
  onSelectMessage,
  onReplyToMessage,
  onEditMessage,
  onDeleteMessage,
  onCopyMessage,
  onCutMessage,
  onToggleMessageCollapse
}) => {
  const [isEditing, setIsEditing] = React.useState(false);

  const handleEditTitle = (newTitle: string) => {
    if (onEditTitle) {
      onEditTitle(thread.id, newTitle);
    }
    setIsEditing(false);
  };

  return (
    <div>
      <ThreadTitle 
        title={thread.title} 
        onEdit={handleEditTitle}
        isEditing={isEditing}
      />
      <button onClick={() => setIsEditing(!isEditing)}>
        {isEditing ? 'Cancel' : 'Edit Title'}
      </button>
      <MessageList 
        messages={thread.messages}
        selectedMessage={selectedMessage}
        onSelectMessage={onSelectMessage}
        onReplyToMessage={onReplyToMessage}
        onEditMessage={onEditMessage}
        onDeleteMessage={onDeleteMessage}
        onCopyMessage={onCopyMessage}
        onCutMessage={onCutMessage}
        onToggleMessageCollapse={onToggleMessageCollapse}
      />
    </div>
  );
};

export default Thread;
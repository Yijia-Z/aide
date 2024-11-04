import React from 'react';
import { Thread } from '../types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pin, PinOff, Edit, Trash2 } from 'lucide-react';

interface ThreadListProps {
  threads: Thread[];
  currentThread: string | null;
  onAddThread: () => void;
  onSelectThread: (threadId: string) => void;
  onPinThread: (threadId: string) => void;
  onDeleteThread: (threadId: string) => void;
  onEditThreadTitle: (threadId: string, currentTitle: string) => void;
}

const ThreadList: React.FC<ThreadListProps> = ({
  threads,
  currentThread,
  onAddThread,
  onSelectThread,
  onPinThread,
  onDeleteThread,
  onEditThreadTitle,
}) => {
  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center p-4">
        <h2 className="text-xl font-bold">Threads</h2>
        <Button onClick={onAddThread}>New Thread</Button>
      </div>
      <ScrollArea className="flex-grow">
        {threads.map((thread) => (
          <div
            key={thread.id}
            className={`flex items-center justify-between p-2 cursor-pointer hover:bg-gray-100 ${
              thread.id === currentThread ? 'bg-blue-100' : ''
            }`}
            onClick={() => onSelectThread(thread.id)}
          >
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onPinThread(thread.id);
                }}
              >
                {thread.isPinned ? <PinOff size={16} /> : <Pin size={16} />}
              </Button>
              <span className="truncate">{thread.title}</span>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditThreadTitle(thread.id, thread.title);
                }}
              >
                <Edit size={16} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteThread(thread.id);
                }}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
};

export default ThreadList;
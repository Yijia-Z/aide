import React from 'react';
import { motion } from 'framer-motion';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { gruvboxDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/lib/utils';
import { MessageSquare, Edit, Trash2, Copy, Scissors, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Message as MessageType } from '../types';

interface MessageProps {
  message: MessageType;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onReply: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onCopy: (id: string) => void;
  onCut: (id: string) => void;
  onToggleCollapse: (id: string) => void;
}

const Message: React.FC<MessageProps> = ({
  message,
  isSelected,
  onSelect,
  onReply,
  onEdit,
  onDelete,
  onCopy,
  onCut,
  onToggleCollapse,
}) => {
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={cn(
            'p-4 rounded-lg mb-2',
            isSelected ? 'bg-blue-100' : message.publisher === 'user' ? 'bg-gray-100' : 'bg-green-100'
          )}
          onClick={() => onSelect(message.id)}
        >
          <div className="flex justify-between items-start mb-2">
            <span className="font-bold">{message.publisher === 'user' ? 'You' : 'AI'}</span>
            <div className="flex space-x-2">
              <Button variant="ghost" size="icon" onClick={() => onReply(message.id)}>
                <MessageSquare size={16} />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onEdit(message.id)}>
                <Edit size={16} />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onDelete(message.id)}>
                <Trash2 size={16} />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onToggleCollapse(message.id)}>
                <ChevronRight size={16} className={cn('transform transition-transform', message.isCollapsed ? '' : 'rotate-90')} />
              </Button>
            </div>
          </div>
          {!message.isCollapsed && (
            <Markdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                        <SyntaxHighlighter
                        style={gruvboxDark as any} // Add 'as any' to bypass type checking for style
                        language={match[1]}
                        PreTag="div"
                        {...props}
                        >
                        {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                    ) : (
                        <code className={className} {...props}>
                        {children}
                        </code>
                    );
                },
              }}
            >
              {message.content}
            </Markdown>
          )}
        </motion.div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => onCopy(message.id)}>
          <Copy className="mr-2 h-4 w-4" />
          <span>Copy</span>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onCut(message.id)}>
          <Scissors className="mr-2 h-4 w-4" />
          <span>Cut</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default Message;
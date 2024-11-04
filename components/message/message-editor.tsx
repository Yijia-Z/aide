import React, { useState, useEffect, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface MessageEditorProps {
  initialContent: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}

const MessageEditor: React.FC<MessageEditorProps> = ({
  initialContent,
  onSave,
  onCancel,
}) => {
  const [content, setContent] = useState(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      );
    }
  }, []);

  const handleSave = () => {
    onSave(content);
  };

  return (
    <div className="space-y-2">
      <Textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="min-h-[100px]"
      />
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave}>Save</Button>
      </div>
    </div>
  );
};

export default MessageEditor;
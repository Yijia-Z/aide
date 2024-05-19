"use client";

import { FC, useState } from 'react';
import initialThread, { Post, Comment as CommentType } from './thread';
import PostComponent from '../components/Post';
import Comment from '../components/Comment';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { DragDropContext, Draggable, Droppable, DropResult } from 'react-beautiful-dnd';
import { saveAs } from 'file-saver';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerFooter } from '@/components/ui/drawer';
import BotMode from '../components/BotMode';

const Thread: FC = () => {
  const [thread, setThread] = useState<Post>(initialThread);
  const [isBotMode, setIsBotMode] = useState(false);

  const addComment = (parentId: string, text: string) => {
    const newComment: CommentType = {
      id: new Date().toISOString(),
      author: "User",
      text,
      timestamp: new Date().toISOString(),
      replies: []
    };

    const addCommentRecursively = (comments: CommentType[]): CommentType[] => {
      return comments.map((comment) => {
        if (comment.id === parentId) {
          return { ...comment, replies: [...comment.replies, newComment] };
        }
        return { ...comment, replies: addCommentRecursively(comment.replies) };
      });
    };

    const updatedThread = { ...thread, replies: addCommentRecursively(thread.replies) };
    setThread(updatedThread);
  };

  const onDragEnd = (result: DropResult) => {
    // Result object structure: { source, destination, draggableId, type }
    const { source, destination } = result;

    // If dropped outside the list
    if (!destination) return;

    const newReplies = Array.from(thread.replies);
    const [moved] = newReplies.splice(source.index, 1);
    newReplies.splice(destination.index, 0, moved);

    setThread({ ...thread, replies: newReplies });
  };
  const saveToFile = () => {
    const file = new Blob([JSON.stringify(thread)], { type: 'application/json' });
    saveAs(file, 'thread.json');
  };

  const loadFromFile = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = JSON.parse((e.target?.result as string) ?? '{}');
        setThread(data);
      };
      reader.readAsText(file);
    }
  };
  return (
    <div>
      <Drawer>
        <DrawerTrigger>
          <Button variant="outline" onClick={() => setIsBotMode(!isBotMode)}>
            {isBotMode ? "Switch to Edit Mode" : "Switch to Bot Mode"}
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerFooter>
              <Button variant="outline" onClick={() => setIsBotMode(!isBotMode)}>
                {isBotMode ? "Switch to Edit Mode" : "Switch to Bot Mode"}
              </Button>
            </DrawerFooter>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>

      <input type="file" accept=".json" onChange={loadFromFile} />
      <Button onClick={saveToFile}>Save</Button>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="thread">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              <Accordion type="single" collapsible>
                <AccordionItem value="item-1">
                  <AccordionTrigger>{thread.author}&apos;s Post</AccordionTrigger>
                  <AccordionContent>
                    <PostComponent post={thread} />
                    {thread.replies.map((comment, index) => (
                      <Draggable key={comment.id} draggableId={comment.id} index={index}>
                        {(provided) => (
                          <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                            <Comment comment={comment} />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}
        </Droppable>
      </DragDropContext>
      {isBotMode && <BotMode thread={thread} setThread={setThread} />}
    </div>
  );
};

export default Thread;
/**
 * Component to render all messages within a selected thread.
 *
 * @component
 * @param {RenderMessagesProps} props - The properties for the RenderMessages component.
 * @param {Thread[]} props.threads - Array of thread objects.
 * @param {string | null} props.currentThread - ID of the currently selected thread.
 * @param {{ [key: string]: string | null }} props.selectedMessages - Object containing selected messages.
 * @param {string | null} props.editingMessage - ID of the message currently being edited.
 * @param {string} props.editingContent - Content of the message currently being edited.
 * @param {string[]} props.glowingMessageIds - Array of message IDs that should have a glowing effect.
 * @param {(id: string) => void} props.addGlowingMessage - Function to add a glowing effect to a message.
 * @param {(id: string) => void} props.removeGlowingMessage - Function to remove the glowing effect from a message.
 * @param {() => void} props.clearGlowingMessages - Function to clear all glowing messages.
 * @param {{ [key: string]: boolean }} props.copiedStates - Object containing the copied states of messages.
 * @param {{ message: Message; operation: "copy" | "cut"; sourceThreadId: string | null; originalMessageId: string | null; } | null} props.clipboardMessage - Object containing the clipboard message details.
 * @param {{ [key: string]: boolean }} props.isGenerating - Object containing the generating states of messages.
 * @param {React.Dispatch<React.SetStateAction<{ [key: string]: string | null }>>} props.setSelectedMessages - Function to set the selected messages.
 * @param {(threadId: string, messageId: string) => void} props.toggleCollapse - Function to toggle the collapse state of a message.
 * @param {(content: string) => void} props.setEditingContent - Function to set the content of the message being edited.
 * @param {(threadId: string, messageId: string) => void} props.confirmEditingMessage - Function to confirm the editing of a message.
 * @param {() => void} props.cancelEditingMessage - Function to cancel the editing of a message.
 * @param {(message: Message) => void} props.startEditingMessage - Function to start editing a message.
 * @param {(threadId: string, parentId: string | null) => void} props.addEmptyReply - Function to add an empty reply to a message.
 * @param {(threadId: string, messageId: string, count: number) => void} props.generateAIReply - Function to generate an AI reply to a message.
 * @param {(threadId: string, messageId: string, operation: "copy" | "cut") => void} props.copyOrCutMessage - Function to copy or cut a message.
 * @param {(threadId: string, parentId: string | null) => void} props.pasteMessage - Function to paste a message.
 * @param {(threadId: string, messageId: string, deleteChildren: boolean | "clear") => void} props.deleteMessage - Function to delete a message.
 * @param {(messages: Message[], id: string) => Message | null} props.findMessageById - Function to find a message by its ID.
 * @param {(messages: Message[], targetId: string, parents?: Message[]) => [Message | null, Message[]]} props.findMessageAndParents - Function to find a message and its parents.
 * @param {(messages: Message[], messageId: string) => Message[]} props.getSiblings - Function to get the siblings of a message.
 * @param {(modelId: string | undefined) => any} props.getModelDetails - Function to get the details of a model.
 * @param {React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>} props.setCopiedStates - Function to set the copied states of messages.
 * @param {React.Dispatch<React.SetStateAction<Thread[]>>} props.setThreads - Function to set the threads.
 * @param {React.Dispatch<React.SetStateAction<{ message: Message; operation: "copy" | "cut"; sourceThreadId: string | null; originalMessageId: string | null; } | null>>} props.setClipboardMessage - Function to set the clipboard message.
 * @param {number} props.lastGenerateCount - The last generate count.
 * @param {React.Dispatch<React.SetStateAction<number>>} props.setLastGenerateCount - Function to set the last generate count.
 * @returns {JSX.Element} The rendered component.
 */

import React from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { CheckCheck, Clipboard, ClipboardPaste, ClipboardType, ClipboardX, Diff, Pencil, MessageSquareOff, MessageSquarePlus, MessageSquareReply, MoveHorizontal, MoveVertical, Trash, Trash2, WandSparkles, X, HelpCircle, Command, Keyboard, CircleHelp } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface RenderMessagesProps {
  threads: Thread[];
  currentThread: string | null;
  selectedMessages: { [key: string]: string | null };
  editingMessage: string | null;
  editingContent: string;
  glowingMessageIds: string[];
  addGlowingMessage: (id: string) => void;
  removeGlowingMessage: (id: string) => void;
  clearGlowingMessages: () => void;
  copiedStates: { [key: string]: boolean };
  clipboardMessage: { message: Message; operation: "copy" | "cut"; sourceThreadId: string | null; originalMessageId: string | null; } | null;
  isGenerating: { [key: string]: boolean };
  setSelectedMessages: React.Dispatch<React.SetStateAction<{ [key: string]: string | null }>>;
  toggleCollapse: (threadId: string, messageId: string) => void;
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
  lastGenerateCount: number;
  setLastGenerateCount: React.Dispatch<React.SetStateAction<number>>;
}

const RenderMessages: React.FC<RenderMessagesProps> = ({
  threads,
  currentThread,
  selectedMessages,
  editingMessage,
  editingContent,
  glowingMessageIds,
  addGlowingMessage,
  removeGlowingMessage,
  clearGlowingMessages,
  copiedStates,
  clipboardMessage,
  isGenerating,
  setSelectedMessages,
  toggleCollapse,
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
  lastGenerateCount,
  setLastGenerateCount,
}) => {
  const currentThreadData = threads.find((t) => t.id === currentThread);
  const [showHelpDialog, setShowHelpDialog] = React.useState(false);
  React.useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Check if the pressed key is "?" and no input element is focused
      if (
        event.key === "?" &&
        !(document.activeElement instanceof HTMLInputElement ||
          document.activeElement instanceof HTMLTextAreaElement)
      ) {
        event.preventDefault();
        setShowHelpDialog(true);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  return (
    <div
      className={`flex flex-col relative sm:h-full h-[calc(97vh)] hide-scrollbar bg-[radial-gradient(hsl(var(--muted))_1px,transparent_1px)] [background-size:16px_16px] [background-position:9px_0]`}
    >
      {currentThread ? (
        <>
          <div
            className="top-bar md:pr-2 bg-gradient-to-b from-background/100 to-background/00"
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
            <Menubar className="p-0 border-none bg-transparent">
              <MenubarMenu>
                <MenubarTrigger asChild>
                  <Button
                    className="rounded-md px-4 bg-transparent hover:bg-secondary custom-shadow transition-scale-zoom text-primary border border-border"
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
                      pasteMessage(currentThread, null);
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
                        clearGlowingMessages();
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
          </div>
          <ScrollArea className="flex-gro md:pr-2" onClick={() => setSelectedMessages((prev) => ({ ...prev, [String(currentThread)]: null }))}>
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
                  glowingMessageIds={glowingMessageIds}
                  addGlowingMessage={addGlowingMessage}
                  removeGlowingMessage={removeGlowingMessage}
                  clearGlowingMessages={clearGlowingMessages}
                  copiedStates={copiedStates}
                  clipboardMessage={clipboardMessage}
                  isGenerating={isGenerating}
                  setSelectedMessages={setSelectedMessages}
                  toggleCollapse={toggleCollapse}
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
                  lastGenerateCount={lastGenerateCount}
                  setLastGenerateCount={setLastGenerateCount}
                />
              ))}
            </div>
          </ScrollArea>
        </>
      ) : (
        <div className="flex font-serif items-center justify-center h-full select-none">
          <span>Select a thread to view messages.</span>
        </div>
      )}
      <div className="absolute bottom-0 right-0 hidden sm:block">
        <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
          <DialogTrigger asChild>
            <div className="flex flex-row-reverse pr-4 pb-4">
              <Button
                className="bg-transparent hover:bg-secondary custom-shadow transition-scale-zoom text-primary border"
                size="icon"
              >
                <Command className="h-4 w-4" />
              </Button>
            </div>
          </DialogTrigger>
          <DialogContent className="custom-shadow bg-background/80 select-none">
            <DialogHeader className='font-serif'>
              <DialogTitle>Keyboard Shortcuts</DialogTitle>
              <DialogDescription>
                A list of keyboard shortcuts for navigating and interacting with messages
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center h-full w-full">
              <div className="w-full">
                <table className="text-sm text-foreground whitespace-pre-wrap w-full">
                  <tbody>
                    <tr>
                      <td><Keyboard className="inline-block mr-1 w-4 h-4" /> <kbd>?</kbd></td>
                      <td className="text-right">Open Help Dialog</td>
                    </tr>
                    <tr>
                      <td><Diff className="inline-block mr-1 w-4 h-4" /> <kbd>C</kbd></td>
                      <td className="text-right">Toggle Collapse</td>
                    </tr>
                    <tr>
                      <td><MoveHorizontal className="inline-block mr-1 w-4 h-4" /> <kbd>←</kbd>/<kbd>→</kbd></td>
                      <td className="text-right">Navigate Parent/Child</td>
                    </tr>
                    <tr>
                      <td><MoveVertical className="inline-block mr-1 w-4 h-4" /> <kbd>↑</kbd>/<kbd>↓</kbd></td>
                      <td className="text-right">Navigate Siblings</td>
                    </tr>
                    <tr>
                      <td><MessageSquarePlus className="inline-block mr-1 w-4 h-4" /> <kbd>N</kbd></td>
                      <td className="text-right">Add Message at Root</td>
                    </tr>
                    <tr>
                      <td><MessageSquareReply className="inline-block mr-1 w-4 h-4" /> <kbd>R</kbd></td>
                      <td className="text-right">Reply</td>
                    </tr>
                    <tr>
                      <td><Pencil className="inline-block mr-1 w-4 h-4" /> <kbd>E</kbd>/Double-click</td>
                      <td className="text-right">Edit</td>
                    </tr>
                    <tr>
                      <td><WandSparkles className="inline-block mr-1 w-4 h-4" /> <kbd>Enter</kbd></td>
                      <td className="text-right">Generate Once</td>
                    </tr>
                    <tr className="border-t border-b border-muted-foreground">
                      <td>
                        <CheckCheck className="inline-block mr-3 w-4 h-4" />
                        <kbd>⌃</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd>
                      </td>
                      <td className="text-right">
                        Confirm Edit
                        <br />
                        Multi-Generate
                      </td>
                    </tr>
                    <tr className="border-t border-b border-muted-foreground">
                      <td>
                        <X className="inline-block mr-3 w-4 h-4" />
                        <kbd>Escape</kbd>
                      </td>
                      <td className="text-right">
                        Cancel Edit
                        <br />
                        Cancel Select
                        <br />
                        Clear Clipboard
                      </td>
                    </tr>
                    <tr className="border-t border-b border-muted-foreground">
                      <td>
                        <Clipboard className="inline-block mr-3 w-4 h-4" />
                        <kbd>⌃</kbd>/<kbd>⌘</kbd> + <kbd>C</kbd>, <kbd>X</kbd>, <kbd>V</kbd>
                      </td>
                      <td className="text-right">
                        Copy
                        <br />
                        Cut
                        <br />
                        Paste
                      </td>
                    </tr>
                    <tr>
                      <td><Trash className="inline-block mr-1 w-4 h-4" /> <kbd>Delete</kbd>/<kbd>Backspace</kbd></td>
                      <td className="text-right">Delete Single Message</td>
                    </tr>
                    <tr>
                      <td><Trash2 className="inline-block mr-1 w-4 h-4" /> <kbd>⌃</kbd>/<kbd>⌘</kbd> + <kbd>Delete</kbd></td>
                      <td className="text-right">Delete with Replies</td>
                    </tr>
                    <tr>
                      <td><MessageSquareOff className="inline-block mr-1 w-4 h-4" /> <kbd>⌥</kbd> + <kbd>Delete</kbd></td>
                      <td className="text-right">Delete only Replies</td>
                    </tr>
                  </tbody>
                </table>
                <DialogFooter className="text-sm text-muted-foreground font-serif">
                  <a href="mailto:z@zy-j.com" className="hover:glow">
                    <span className="underline">Send us feedback</span>
                  </a>
                  <a href="https://github.com/yijia-z/aide/issues" className="hover:glow">
                    <span className="underline">Submit a GitHub Issue</span>
                  </a>
                </DialogFooter>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default RenderMessages;
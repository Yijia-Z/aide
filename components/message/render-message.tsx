// components/RenderMessage.tsx

import React from 'react';
import { motion, AnimatePresence } from "framer-motion";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { gruvboxDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ChevronRight, Edit, Trash, Trash2, MessageSquare, X, Check, Sparkle, Copy, Scissors, ClipboardPaste } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarShortcut, MenubarTrigger } from "@/components/ui/menubar";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Message, Thread } from "@/components/types";

interface RenderMessageProps {
  message: Message;
  threadId: string;
  depth?: number;
  parentId?: string | null;
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

const RenderMessage: React.FC<RenderMessageProps> = ({
  message,
  threadId,
  depth = 0,
  parentId = null,
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
	// Message selection and hierarchy
	const isSelected = selectedMessage === message.id;
	const isParentOfSelected = selectedMessage !== null &&
			findMessageById(message.replies, selectedMessage) !== null;
	const isSelectedOrParent = isSelected || isParentOfSelected || parentId === message.id;

	// Indentation
	const indent = depth === 0 ? 0 : (isSelectedOrParent ? -16 : 0);

	// Helper functions
	const getTotalReplies = (msg: Message): number => {
			return msg.replies.reduce((total, reply) => total + 1 + getTotalReplies(reply), 0);
	};

	const handleCopy = (codeString: string, codeBlockId: string) => {
			navigator.clipboard.writeText(codeString);
			setCopiedStates(prev => ({ ...prev, [codeBlockId]: true }));
			setTimeout(() => {
					setCopiedStates(prev => ({ ...prev, [codeBlockId]: false }));
			}, 2000);
	};

	const updateMessageModelConfig = (messages: Message[], targetId: string, newModelName: string): Message[] => {
			return messages.map((message) => {
					if (message.id === targetId) {
							return { ...message, modelConfig: { ...message.modelConfig, name: newModelName } };
					}
					if (message.replies.length > 0) {
							return { ...message, replies: updateMessageModelConfig(message.replies, targetId, newModelName) };
					}
					return message;
			});
	};

	// Thread and message data
	const currentThreadData = threads.find((t) => t.id === currentThread);
	if (!currentThreadData) return null;

	const [currentMessage, parentMessages] = findMessageAndParents(currentThreadData.messages, message.id);
	const parentMessage = parentMessages.length > 0 ? parentMessages[parentMessages.length - 1] : null;
	const siblings = getSiblings(currentThreadData.messages, message.id);
	const currentIndex = siblings.findIndex((m) => m.id === message.id);

	// Additional data
	const totalReplies = getTotalReplies(message);
	const modelDetails = message.modelConfig;
	const modelName = getModelDetails(message.modelId)?.name;
	if (modelName && modelDetails && modelName !== modelDetails.name) {
			// Update the original message's modelConfig name only
			setThreads((prevThreads) =>
					prevThreads.map((thread) => ({
							...thread,
							messages: updateMessageModelConfig(thread.messages, message.id, modelName)
					}))
			);
	}

	return (
			<motion.div
					key={message.id}
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: 20 }}
					transition={{
							duration: 0.3,
							ease: "easeInOut"
					}}
					className={"mt-2"}
					style={{ marginLeft: `${indent}px` }}
					layout={"preserve-aspect"} // Add this prop to enable layout animations
					id={`message-${message.id}`}
			>
					<div
							className={`flex 
					items-start 
					space-x-1 
					p-1 
					rounded-md
					${isSelectedOrParent ? "custom-shadow" : "text-muted-foreground"}
					${glowingMessageId === message.id ? "glow-effect" : ""}
			`}
							onClick={() => {
									setSelectedMessage(message.id);
									if (message.isCollapsed) {
											toggleCollapse(threadId, message.id);
									}
							}}
					>
							<div className="flex-grow p-0 overflow-hidden">
									<div className="flex flex-col">
											<div className="flex items-center justify-between">
													<div className="flex items-center space-x-1">
															<Button
																	variant="ghost"
																	size="sm"
																	className="w-6 h-6 p-0 rounded-md hover:bg-secondary bg-background border border-border"
																	onClick={(e) => {
																			e.stopPropagation();
																			toggleCollapse(threadId, message.id);
																	}}
															>
																	{message.isCollapsed ? (
																			message.userCollapsed ? (
																					<ChevronRight className="h-4 m-0 transition-transform" />
																			) : (
																					<ChevronRight className="h-4 m-0 transition-transform text-muted-foreground" />
																			)
																	) : (
																			<ChevronRight className="h-4 m-0 transition-transform rotate-90" />
																	)}
															</Button>                  <span
																	className={`font-bold truncate ${message.publisher === "ai"
																			? "text-blue-500"
																			: "text-green-600"
																			}`}
															>
																	{parentId === null ||
																			message.publisher !==
																			findMessageById(
																					threads.find((t) => t.id === currentThread)?.messages ||
																					[],
																					parentId
																			)?.publisher
																			? message.publisher === "ai"
																					? modelDetails?.name || "AI"
																					: "User"
																			: null}
															</span>
															{modelDetails && (
																	<div className="flex items-center space-x-1">
																			<Badge variant="secondary">
																					{modelDetails.baseModel?.split('/').pop()?.split('-')[0]}
																			</Badge>
																	</div>
															)}
													</div>
													<div
															className={`flex space-x-1 ${isSelectedOrParent || isSelected
																	? "opacity-100"
																	: "opacity-0 hover:opacity-100"
																	} transition-opacity duration-200`}
													>
															{parentMessage && (
																	<Button
																			variant="ghost"
																			size="sm"
																			className="w-6 h-6 p-0"
																			onClick={(e) => {
																					e.stopPropagation();
																					setSelectedMessage(parentMessage.id);
																			}}
																			onMouseEnter={() => setGlowingMessageId(parentMessage.id)}
																			onMouseLeave={() => setGlowingMessageId(null)}
																	>
																			<ArrowLeft className="h-4 w-4" />
																	</Button>
															)}
															{currentMessage?.replies && currentMessage.replies.length > 0 && (
																	<Button
																			variant="ghost"
																			size="sm"
																			className="w-6 h-6 p-0"
																			onClick={(e) => {
																					e.stopPropagation();
																					setSelectedMessage(currentMessage.replies[0].id);
																			}}
																			onMouseEnter={() => setGlowingMessageId(currentMessage.replies[0].id)}
																			onMouseLeave={() => setGlowingMessageId(null)}
																	>
																			<ArrowRight className="h-4 w-4" />
																	</Button>
															)}
															{siblings[currentIndex - 1] && (
																	<Button
																			variant="ghost"
																			size="sm"
																			className="w-6 h-6 p-0"
																			onClick={(e) => {
																					e.stopPropagation();
																					setSelectedMessage(siblings[currentIndex - 1].id);
																			}}
																			onMouseEnter={() => setGlowingMessageId(siblings[currentIndex - 1].id)}
																			onMouseLeave={() => setGlowingMessageId(null)}
																	>
																			<ArrowUp className="h-4 w-4" />
																	</Button>
															)}
															{siblings[currentIndex + 1] && (
																	<Button
																			variant="ghost"
																			size="sm"
																			className="w-6 h-6 p-0"
																			onClick={(e) => {
																					e.stopPropagation();
																					setSelectedMessage(siblings[currentIndex + 1].id);
																			}}
																			onMouseEnter={() => setGlowingMessageId(siblings[currentIndex + 1].id)}
																			onMouseLeave={() => setGlowingMessageId(null)}
																	>
																			<ArrowDown className="h-4 w-4" />
																	</Button>
															)}
													</div>
											</div>
											{editingMessage === message.id ? (
													<Textarea
															value={editingContent}
															onChange={(e) => setEditingContent(e.target.value)}
															className="min-font-size font-serif flex-grow w-auto m-1 p-0 bg-inherit"
															style={{
																	minHeight: Math.min(
																			Math.max(
																					20,
																					editingContent.split("\n").length * (
																							window.innerWidth < 480 ? 35 :
																									window.innerWidth < 640 ? 30 :
																											window.innerWidth < 1024 ? 25 :
																													20
																					),
																					editingContent.length * (
																							window.innerWidth < 480 ? 0.6 :
																									window.innerWidth < 640 ? 0.5 :
																											window.innerWidth < 1024 ? 0.35 :
																													0.25
																					)
																			),
																			window.innerHeight * 0.5
																	),
																	maxHeight: "50vh",
															}}
															autoFocus
															onKeyDown={(e) => {
																	if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
																			confirmEditingMessage(threadId, message.id);
																	} else if (e.key === "Escape") {
																			cancelEditingMessage();
																	}
															}}
													/>
											) : (
													<ContextMenu>
															<ContextMenuTrigger onContextMenu={() => setSelectedMessage(message.id)}>
																	<div
																			className="whitespace-normal break-words markdown-content font-serif overflow-hidden pt-0.5 px-1 "
																			onDoubleClick={() => {
																					cancelEditingMessage();
																					startEditingMessage(message);
																			}}
																	>
																			{message.isCollapsed ? (
																					<div className="flex flex-col">
																							<div>
																									{`${message.content.split("\n")[0].slice(0, 50)}
																					${message.content.length > 50 ? "..." : ""}`}
																							</div>
																							{totalReplies > 0 && (
																									<div className="self-end">
																											<span className="text-yellow-600">
																													{`(${totalReplies} ${totalReplies === 1 ? "reply" : "replies"})`}
																											</span>
																									</div>
																							)}
																					</div>
																			) : (
																					<div className="markdown-content">
																							<Markdown
																									remarkPlugins={[remarkGfm]}
																									rehypePlugins={[rehypeRaw]}
																									components={{
																											code({
																													node,
																													inline,
																													className,
																													children,
																													...props
																											}: any) {
																													const match = /language-(\w+)/.exec(className || "");
																													const codeString = String(children).replace(/\n$/, "");
																													// Create a unique ID for each code block within the message
																													const codeBlockId = `${message.id}-${match?.[1] || 'unknown'}-${codeString.slice(0, 32)}`;
																													return !inline && match ? (
																															<div className="relative">
																																	<div className="absolute -top-4 w-full text-muted-foreground flex justify-between items-center p-1 pb-0 pl-3 rounded-sm text-xs bg-[#1D2021]">
																																			<span>{match[1]}</span>
																																			<Button
																																					className="w-6 h-6 p-0"
																																					variant="ghost"
																																					size="sm"
																																					onClick={() => handleCopy(codeString, codeBlockId)}
																																			>
																																					{copiedStates[codeBlockId] ? (
																																							<Check className="h-4 w-4" />
																																					) : (
																																							<Copy className="h-4 w-4" />
																																					)}
																																			</Button>
																																	</div>
																																	<SyntaxHighlighter
																																			className="text-xs"
																																			PreTag={"pre"}
																																			style={gruvboxDark}
																																			language={match[1]}
																																			// showLineNumbers
																																			wrapLines
																																			{...props}
																																	>
																																			{codeString}
																																	</SyntaxHighlighter>
																															</div>
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
																					</div>
																			)}
																	</div>
															</ContextMenuTrigger>
															<ContextMenuContent className="custom-shadow bg-transparent">
																	<ContextMenuItem onClick={() => addEmptyReply(threadId, message.id)}>
																			<MessageSquare className="h-4 w-4 mr-2" />
																			Reply
																			<ContextMenuShortcut>R</ContextMenuShortcut>
																	</ContextMenuItem>
																	<ContextMenuItem onClick={() => generateAIReply(threadId, message.id, 1)}>
																			<Sparkle className="h-4 w-4 mr-2" />
																			Generate AI Reply
																			<ContextMenuShortcut>G</ContextMenuShortcut>
																	</ContextMenuItem>
																	<ContextMenuItem onClick={() => {
																			cancelEditingMessage();
																			startEditingMessage(message);
																	}}>
																			<Edit className="h-4 w-4 mr-2" />
																			Edit
																			<ContextMenuShortcut>E</ContextMenuShortcut>
																	</ContextMenuItem>
																	<ContextMenuSeparator />
																	<ContextMenuItem onClick={() => copyOrCutMessage(threadId, message.id, "copy")}>
																			<Copy className="h-4 w-4 mr-2" />
																			Copy
																			<ContextMenuShortcut>⌘ C</ContextMenuShortcut>
																	</ContextMenuItem>
																	<ContextMenuItem onClick={() => copyOrCutMessage(threadId, message.id, "cut")}>
																			<Scissors className="h-4 w-4 mr-2" />
																			Cut
																			<ContextMenuShortcut>⌘ X</ContextMenuShortcut>
																	</ContextMenuItem>
																	{clipboardMessage && (
																			<ContextMenuItem onClick={() => pasteMessage(threadId, message.id)}>
																					<ClipboardPaste className="h-4 w-4 mr-2" />
																					Paste
																					<ContextMenuShortcut>⌘ V</ContextMenuShortcut>
																			</ContextMenuItem>
																	)}
																	<ContextMenuSeparator />
																	<ContextMenuItem
																			className="text-red-500"
																			onClick={() => deleteMessage(threadId, message.id, false)}
																	>
																			<Trash className="h-4 w-4 mr-2" />
																			Delete
																			<ContextMenuShortcut>⌫</ContextMenuShortcut>
																	</ContextMenuItem>
																	<ContextMenuItem
																			className="text-red-500"
																			onClick={() => deleteMessage(threadId, message.id, true)}
																	>
																			<Trash2 className="h-4 w-4 mr-2" />
																			Delete with Replies
																			<ContextMenuShortcut className="ml-2">⇧ ⌫</ContextMenuShortcut>
																	</ContextMenuItem>
															</ContextMenuContent>
													</ContextMenu>
											)}
									</div>
									{selectedMessage === message.id && (
											<div className="space-x-1 mt-1 flex flex-wrap items-center select-none">
													{editingMessage === message.id ? (
															<>
																	<Button
																			className="hover:bg-background space-x-2 transition-scale-zoom"
																			size="sm"
																			variant="ghost"
																			onClick={() =>
																					confirmEditingMessage(threadId, message.id)
																			}
																	>
																			<Check className="h-4 w-4" />
																			<span className="hidden md:inline ml-auto">
																					<MenubarShortcut>⌘ ↩</MenubarShortcut>
																			</span>
																	</Button>
																	<Button
																			className="hover:bg-background space-x-2 transition-scale-zoom"
																			size="sm"
																			variant="ghost"
																			onClick={cancelEditingMessage}
																	>
																			<X className="h-4 w-4" />
																			<span className="hidden md:inline ml-auto">
																					<MenubarShortcut>Esc</MenubarShortcut>
																			</span>
																	</Button>
															</>
													) : (
															<>
																	<Button
																			className="h-10 hover:bg-background transition-scale-zoom"
																			size="sm"
																			variant="ghost"
																			onClick={() => {
																					cancelEditingMessage();
																					setSelectedMessage(null);
																					addEmptyReply(threadId, message.id);
																			}}
																	>
																			<MessageSquare className="h-4 w-4" />
																			<span className="hidden md:inline ml-2">Reply</span>
																	</Button>
																	<Menubar className="p-0 border-none bg-transparent">
																			<MenubarMenu>
																					<MenubarTrigger
																							className={cn(
																									"h-10 rounded-lg hover:bg-blue-900 transition-scale-zoom",
																									isGenerating &&
																									"animate-pulse bg-blue-200 dark:bg-blue-900 duration-1000"
																							)}
																					>
																							<Sparkle className="h-4 w-4" />
																							<span className="hidden md:inline ml-2">
																									Generate
																							</span>
																					</MenubarTrigger>
																					<MenubarContent className="custom-shadow">
																							<MenubarItem
																									onClick={() =>
																											generateAIReply(threadId, message.id, 1)
																									}
																							>
																									Once
																									<MenubarShortcut className="ml-auto">
																											⎇ G
																									</MenubarShortcut>
																							</MenubarItem>
																							<MenubarItem
																									onClick={() =>
																											generateAIReply(threadId, message.id, 3)
																									}
																							>
																									Thrice
																							</MenubarItem>
																							<MenubarItem
																									onClick={() => {
																											const times = prompt(
																													"How many times do you want to generate?",
																													"5"
																											);
																											const numTimes = parseInt(times || "0", 10);
																											if (
																													!isNaN(numTimes) &&
																													numTimes > 0 &&
																													numTimes <= 10
																											) {
																													generateAIReply(threadId, message.id, numTimes);
																											} else if (numTimes > 10) {
																													generateAIReply(threadId, message.id, 10);
																											}
																									}}
																							>
																									Custom
																							</MenubarItem>
																					</MenubarContent>
																			</MenubarMenu>
																	</Menubar>
																	<Button
																			className="h-10 hover:bg-background transition-scale-zoom"
																			size="sm"
																			variant="ghost"
																			onClick={() => {
																					cancelEditingMessage();
																					startEditingMessage(message);
																			}}
																	>
																			<Edit className="h-4 w-4" />
																			<span className="hidden md:inline ml-2">Edit</span>
																	</Button>
																	<Menubar className="p-0 border-none bg-transparent">
																			<MenubarMenu>
																					<MenubarTrigger className="h-10 hover:bg-background transition-scale-zoom">
																							{clipboardMessage ? (
																									<ClipboardPaste className="h-4 w-4" />
																							) : (
																									<Copy className="h-4 w-4" />
																							)}
																							<span className="hidden md:inline ml-2">
																									{clipboardMessage ? "Paste" : "Copy"}
																							</span>
																					</MenubarTrigger>
																					<MenubarContent className="custom-shadow">
																							{clipboardMessage ? (
																									<>
																											<MenubarItem onClick={() => pasteMessage(threadId, message.id)}>
																													Paste Here
																													<span className="hidden md:inline ml-auto">
																															<MenubarShortcut>⌘ V</MenubarShortcut>
																													</span>
																											</MenubarItem>
																											<MenubarItem onClick={() => setClipboardMessage(null)}>
																													Clear Clipboard
																													<span className="hidden md:inline ml-auto">
																															<MenubarShortcut>Esc</MenubarShortcut>
																													</span>
																											</MenubarItem>
																									</>
																							) : (
																									<>
																											<MenubarItem onClick={() => copyOrCutMessage(threadId, message.id, "copy")}>
																													Copy
																													<span className="hidden md:inline ml-auto">
																															<MenubarShortcut>⌘ C</MenubarShortcut>
																													</span>
																											</MenubarItem>
																											<MenubarItem onClick={() => copyOrCutMessage(threadId, message.id, "cut")}>
																													Cut
																													<span className="hidden md:inline ml-auto">
																															<MenubarShortcut>⌘ X</MenubarShortcut>
																													</span>
																											</MenubarItem>
																									</>
																							)}
																					</MenubarContent>
																			</MenubarMenu>
																	</Menubar>
																	<Menubar className="p-0 border-none bg-transparent">
																			<MenubarMenu>
																					<MenubarTrigger className="h-10 hover:bg-destructive transition-scale-zoom">
																							<Trash className="h-4 w-4" />
																							<span className="hidden md:inline ml-2">Delete</span>
																					</MenubarTrigger>
																					<MenubarContent className="custom-shadow">
																							<MenubarItem
																									onClick={() =>
																											deleteMessage(threadId, message.id, false)
																									}
																							>
																									Keep Replies
																									<span className="hidden md:inline ml-auto">
																											<MenubarShortcut>⌫</MenubarShortcut>
																									</span>
																							</MenubarItem>
																							<MenubarItem
																									onClick={() =>
																											deleteMessage(threadId, message.id, true)
																									}
																							>
																									With Replies
																									<span className="hidden md:inline ml-auto">
																											<MenubarShortcut>⇧ ⌫</MenubarShortcut>
																									</span>
																							</MenubarItem>
																					</MenubarContent>
																			</MenubarMenu>
																	</Menubar>
															</>
													)}
											</div>
									)}
							</div>
					</div>
					<AnimatePresence>
							{!message.isCollapsed && message.replies.map((reply) => (
									<RenderMessage
											key={reply.id}
											message={reply}
											threadId={threadId}
											depth={depth + 1}
											parentId={message.id}
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
							))};
					</AnimatePresence>
			</motion.div>
	);
};

export default RenderMessage;
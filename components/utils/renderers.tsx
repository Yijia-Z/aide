import React from 'react';

// Imported components
import { motion, AnimatePresence } from "framer-motion";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { gruvboxDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ChevronRight, Edit, Trash, Trash2, ListPlus, MessageSquare, X, Plus, Check, MessageSquarePlus, Pin, PinOff, Sparkle, Copy, Scissors, ClipboardPaste } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SelectBaseModel } from "@/components/model/model-selector";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarShortcut, MenubarTrigger } from "@/components/ui/menubar";
import { ContextMenu, ContextMenuCheckboxItem, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuRadioGroup, ContextMenuRadioItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Model, Message, Thread } from "../types";
import { findAllParentMessages, getSiblings, findMessageAndParents } from "./helpers";


// Imported functions
import { generateAIResponse } from '../utils/api';
import { 
  addThread, 
  deleteThread, 
  toggleThreadPin, 
  addEmptyReply, 
  generateAIReply, 
  startEditingMessage, 
  cancelEditingMessage, 
  confirmEditingMessage, 
  deleteMessage, 
  copyOrCutMessage, 
  pasteMessage,
  toggleCollapse,
  updateMessageContent,
  setSelectedMessage,
  setEditingThreadTitle,
  confirmEditThreadTitle,
  cancelEditThreadTitle as cancelEditThreadTitle,
  setClipboardMessage,
  setGlowingMessageId
} from '../threaded-document';

export interface RendererProps {
	threads: Thread[];
  currentThread: string | null;
  selectedMessage: string | null;
  editingThreadTitle: string | null;
  editingMessage: string | null;
  editingContent: string;
  models: Model[];
  selectedModel: string | null;
	findMessageById: (messages: Message[], id: string) => Message | null;
}

export const Renderer: React.FC<RendererProps> = ({
	threads,
	currentThread,
	selectedMessage,
	editingThreadTitle,
	editingMessage,
	editingContent,
	models,
	selectedModel,
	findMessageById
}) => {

// Render a single message
const renderMessage = (
	message: Message,
	threadId: string,
	depth = 0,
	parentId: string | null = null
) => {
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
				{!message.isCollapsed && (
					<motion.div
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						exit={{ opacity: 0, height: 0 }}
						transition={{ duration: 0.1 }}
					>
						{message.replies.map((reply) => (
							<div
								key={reply.id}
								className={`${isSelected ? "border-l-2 border-b-2 rounded-bl-lg border-border ml-4" : "ml-4"}`}
							>
								{renderMessage(reply, threadId, depth + 1, message.id)}
							</div>
						))}
					</motion.div>
				)}
			</AnimatePresence>
		</motion.div>
	);
}

// Render the list of threads
const renderThreadsList = () => {
	// Sort threads with newer threads (higher id) at the top, and pinned threads taking precedence
	const sortedThreads = threads.sort((a, b) => {
		if (a.isPinned && !b.isPinned) return -1;
		if (!a.isPinned && b.isPinned) return 1;
		return parseInt(b.id) - parseInt(a.id); // Assuming id is a string representation of a number
	});

	return (
		<div className="flex flex-col relative h-[calc(97vh)]">
			<div
				className="top-bar bg-gradient-to-b from-background/100 to-background/00 select-none"
				style={{
					mask: "linear-gradient(black, black, transparent)",
					backdropFilter: "blur(1px)",
				}}
			>
				<h2 className="text-2xl font-serif font-bold pl-2">Threads</h2>
				<Button
					className="bg-background hover:bg-secondary custom-shadow transition-scale-zoom text-primary border border-border"
					size="default"
					onClick={() => {
						addThread();
						setSelectedMessage(null);
					}}
				>
					<ListPlus className="h-4 w-4" />
					<span className="ml-2 hidden md:inline">New Thread</span>
				</Button>
			</div>
			<ScrollArea
				className="flex-auto"
				onClick={() => {
					setCurrentThread(null);
					if (editingThreadTitle) {
						cancelEditThreadTitle();
					}
				}}
			>
				<AnimatePresence>
					<motion.div className="my-2">
						{sortedThreads.map((thread) => (
							<motion.div
								key={thread.id}
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -20 }}
								transition={{ duration: 0.1 }}
								whileHover={{
									borderRadius: '8px',
									y: -2,
									transition: { duration: 0.2 }
								}}
								className={`
									font-serif
									pl-1
									cursor-pointer
									rounded-md
									mb-2
									hover:shadow-[inset_0_0_10px_10px_rgba(128,128,128,0.2)]
									active:shadow-[inset_0px_0px_10px_rgba(0,0,0,0.7)]
									${currentThread === thread.id
										? "bg-background custom-shadow"
										: "bg-transparent text-muted-foreground"
									}
								`}
								onClick={(e) => {
									e.stopPropagation();
									setCurrentThread(thread.id);
								}}
							>
								<div className="flex-grow">
									{editingThreadTitle === thread.id ? (
										<div className="flex items-center justify-between">
											<Input
												ref={threadTitleInputRef}
												value={thread.title}
												onChange={(e) =>
													setThreads((prev: Thread[]) =>
														prev.map((t) =>
															t.id === thread.id ? { ...t, title: e.target.value } : t
														)
													)
												}
												className="min-font-size flex-grow h-8 p-1 my-1"
												onClick={(e) => e.stopPropagation()}
												maxLength={64}
												onKeyDown={(e) => {
													if (e.key === "Enter") {
														e.preventDefault();
														confirmEditThreadTitle(thread.id, thread.title);
													} else if (e.key === "Escape") {
														e.preventDefault();
														cancelEditThreadTitle();
													}
												}}
											/>
											<Button
												size="sm"
												variant="ghost"
												onClick={(e) => {
													e.stopPropagation();
													confirmEditThreadTitle(thread.id, thread.title);
												}}
											>
												<Check className="h-4 w-4" />
											</Button>
											<Button
												size="sm"
												variant="ghost"
												onClick={(e) => {
													e.stopPropagation();
													cancelEditThreadTitle();
												}}
											>
												<X className="h-4 w-4" />
											</Button>
										</div>
									) : (
										<div
											className="flex items-center justify-between"
											onDoubleClick={(e) => {
												e.stopPropagation();
												startEditingThreadTitle(thread.id, thread.title);
											}}
										>
											<span className="pl-1 flex-grow">{thread.title}</span>
											<div className="flex items-center">
												<Button
													variant="ghost"
													size="icon"
													onClick={(e) => {
														e.stopPropagation();
														toggleThreadPin(thread.id);
													}}
												>
													{thread.isPinned ? (
														<PinOff className="h-4 w-4" />
													) : (
														<Pin className="h-4 w-4" />
													)}
												</Button>
												<Button
													variant="ghost"
													size="icon"
													onClick={(e) => {
														e.stopPropagation();
														deleteThread(thread.id);
													}}
												>
													<Trash className="h-4 w-4" />
												</Button>
											</div>
										</div>
									)}
								</div>
							</motion.div>
						))}
					</motion.div>
				</AnimatePresence>
			</ScrollArea>
		</div>
	);
}

// Render messages for the current thread
const renderMessages = () =>{
	const currentThreadData = threads.find((t) => t.id === currentThread);
	return currentThread ? (
		<div
			className={`flex flex-col relative sm:h-full h-[calc(97vh)] hide-scrollbar`}
		>
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
				{currentThread && (
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
				)}
			</div>
			<ScrollArea className="flex-grow" onClick={() => setSelectedMessage(null)}>
				<div className="mb-4" onClick={(e) => e.stopPropagation()}>
					{currentThreadData?.messages.map((message: any) =>
						renderMessage(message, currentThread)
					)}
				</div>
			</ScrollArea>
		</div>
	) : (
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

const renderModelConfig = () => {
	return (
		<div className="flex flex-col relative h-[calc(97vh)] overflow-clip select-none">
			<div
				className="top-bar bg-gradient-to-b from-background/100 to-background/00"
				style={{
					mask: "linear-gradient(black, black, transparent)",
					backdropFilter: "blur(1px)",
				}}
			>
				<Select value={selectedModel ?? models[0]?.id} onValueChange={setSelectedModel}>
					<SelectTrigger className="custom-shadow transition-scale-zoom">
						<SelectValue placeholder="Select a model" />
					</SelectTrigger>
					<SelectContent className="custom-shadow">
						{models.map((model) => (
							<SelectItem key={model.id} value={model.id}>
								{model.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Button
					className="bg-transparent hover:bg-secondary custom-shadow transition-scale-zoom text-primary border border-border"
					size="default"
					onClick={addNewModel}
				>
					<Plus className="h-4 w-4" />
					<span className="ml-2 hidden md:inline">New Model</span>
				</Button>
			</div>
			<ScrollArea className="flex-grow">
				<AnimatePresence>
					<motion.div className="flex-grow overflow-y-visible mt-2">
						{models.map((model) => (
							<motion.div
								key={model.id}
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -20 }}
								transition={{ duration: 0.1 }}
								whileHover={{
									boxShadow: 'inset 0px 0px 10px rgba(128, 128, 128, 0.2)',
									borderRadius: '8px',
									transition: { duration: 0.2 }
								}}
								className="p-2 border rounded-md mb-2 custom-shadow"                >
								<div onDoubleClick={() => setEditingModel(model)}>
									<div className="flex justify-between items-center mb-2">
										<h3 className="font-bold">{model.name}</h3>
									</div>
									{editingModel?.id === model.id ? (
										<div className="space-y-2 text-muted-foreground">
											<Label>Name</Label>
											<Input
												className="min-font-size text-foreground"
												value={editingModel?.name}
												onChange={(e) =>
													handleModelChange("name", e.target.value)
												}
											/>
											<Label>Base Model</Label>
											<SelectBaseModel
												value={editingModel.baseModel}
												onValueChange={(value, parameters) => {
													handleModelChange("baseModel", value);
													handleModelChange("parameters", parameters as Partial<ModelParameters>);
												}}
												fetchAvailableModels={fetchAvailableModels}
												fetchModelParameters={fetchModelParameters}
												existingParameters={editingModel.parameters}
											/>
											<Label>System Prompt</Label>
											<Textarea
												className="min-font-size text-foreground"
												value={editingModel?.systemPrompt}
												onChange={(e) =>
													handleModelChange("systemPrompt", e.target.value)
												}
											/>
											<div className="flex justify-between items-center mt-2">
												<div className="space-x-2 text-foreground">
													<Button size="sm" variant="outline" onClick={saveModelChanges}>
														<Check className="h-4 w-4" />
													</Button>
													<Button
														variant="outline"
														size="sm"
														onClick={() => setEditingModel(null)}
													>
														<X className="h-4 w-4" />
													</Button>
												</div>
												<Button
													variant="destructive"
													size="sm"
													onClick={() => deleteModel(model.id)}
													disabled={models.length === 1}
												>
													<Trash className="h-4 w-4" />
												</Button>
											</div>
										</div>
									) : (
										<div className="text-sm cursor-pointer">
											<p><span className="text-muted-foreground">Base Model:</span> {model.baseModel.split('/').pop()}</p>
											<p><span className="text-muted-foreground">Temperature:</span> {model.parameters.temperature}</p>
											<p><span className="text-muted-foreground">Max Tokens:</span> {model.parameters.max_tokens}</p>
										</div>
									)}
								</div>
							</motion.div>
						))}
					</motion.div>
				</AnimatePresence>
			</ScrollArea>
		</div>
	);
}};
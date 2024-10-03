'use client';

import React, { useState } from 'react';
import '../globals.css';

const suggestions = [
    "Suggestion 1",
    "Suggestion 2",
    "Suggestion 3"
]

const conversations = [
    ["Conversation 1", "Model 1"],
    ["Conversation 2", "Model 2"],
    ["Conversation 3", "Model 3"],
    ["Conversation 4", "Model 4"],
    ["Conversation 5", "Model 5"],
]

export default function Page() {
    const [isConversationMenuOpen, setIsConversationMenuOpen] = useState(false);

    const toggleConversationMenu = () => {
        setIsConversationMenuOpen(!isConversationMenuOpen);
    }

    return (
        <div>
            <title>Design</title>
            <div className="absolute bg-gradient-to-br from-red-500 to-purple-500 h-screen w-screen overflow-hidden py-10">
                <div className="flex flex-col h-full justify-between">
                    <div className="flex flex-row mx-auto w-full justify-between px-10">
                        <div 
                            onClick={toggleConversationMenu}  
                            className="z-10 rounded-full bg-black w-10 h-10">
                        </div>
                        <div 
                            onClick={toggleConversationMenu}  
                            className="z-10 rounded-full bg-white w-10 h-10">
                        </div>
                    </div>
                    <div className="flex flex-col items-center justify-end">
                        <div className="flex items-center bg-[#D9D9D9] w-1/2 h-16 rounded-full drop-shadow-lg">
                            <div className="text-lg laptop:text-2xl ml-8">
                                Start Chatting with Current Model Selected
                            </div>
                            <div className="text-xs text-end">
                                {/* add button here */}
                            </div>
                        </div>
                        <div className="bg-[#C4C4C4] w-[45%] h-48 rounded-b-xl p-4">
                            <div className="text-lg ">Suggestions</div>
                            <div className="mt-2 gap-x-4 flex flex-row text-center items-stretch h-full">
                                {suggestions.map((suggestion, index) => (
                                    <div key={index} className="bg-[#D9D9D9] text-lg grow drop-shadow-lg rounded-lg items-center justify-center">
                                        {suggestion}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {isConversationMenuOpen && (
                <div className="z-5 absolute flex bg-white flex-row h-screen w-1/3 rounded-r-xl p-4">
                    <div className="flex flex-col w-full pt-12 px-8">
                        <div className="text-lg py-8">Conversations</div>
                        <div className="flex flex-col gap-y-4 w-full">
                            <button className="bg-gradient-to-br from-red-500 to-purple-500 shadow-lg text-xl text-white rounded-lg px-4 py-6">
                                New Conversation
                            </button>
                            {conversations.map((conversation, index) => (
                                <div key={index} className="bg-white shadow-lg rounded-lg px-4 py-6">
                                    <div className="text-xl">{conversation[0]}</div>
                                    <div className="text-sm">{conversation[1]}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
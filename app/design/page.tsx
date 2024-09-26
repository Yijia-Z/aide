import React from 'react';
import '../globals.css';

const suggestions = [
    "Suggestion 1",
    "Suggestion 2",
    "Suggestion 3"
]

export default function Page() {
    return (
        <div>
            <title>Design</title>
            <div className="absolute bg-gradient-to-br from-red-500 to-purple-500 h-screen w-screen overflow-hidden px-16 py-10">
                <div className="flex flex-col h-full justify-between">
                    <div className="flex flex-row mx-auto w-full justify-between">
                        <div className="rounded-full bg-white w-10 h-10"></div>
                        <div className="rounded-full bg-white w-10 h-10"></div>
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
                        <div className="bg-[#C4C4C4] w-[45%] h-48 rounded-b-xl p-4 border-2 border-black">
                            <div className="text-lg border-2 border-black">Suggestions</div>
                            <div className="mt-2 gap-x-4 flex flex-row text-center border-2 border-black items-stretch h-full">
                                {suggestions.map((suggestion) => (
                                    <div className="bg-[#D9D9D9] text-lg grow drop-shadow-lg rounded-lg items-center justify-center">
                                        {suggestion}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
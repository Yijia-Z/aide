import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { messages, configuration } = body;

        const params: OpenAI.Chat.ChatCompletionCreateParams = {
            messages,
            model: configuration.model,
            temperature: configuration.temperature,
            max_tokens: configuration.max_tokens,
        };

        const chatCompletion: OpenAI.Chat.ChatCompletion = await openai.chat.completions.create(params);
        return NextResponse.json(chatCompletion);
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
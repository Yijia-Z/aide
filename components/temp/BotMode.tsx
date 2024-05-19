// components/BotMode.tsx
import { FC, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Post } from '../../app/thread';

interface BotModeProps {
    thread: Post;
    setThread: React.Dispatch<React.SetStateAction<Post>>;
}

const BotMode: FC<BotModeProps> = ({ thread, setThread }) => {
    const [botSettings, setBotSettings] = useState({ temperature: 0.7, systemPrompt: 'You are a helpful assistant.' });

    const handleBotResponse = async (input: string) => {
        const response = await fetch('/api/openai/gpt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input, ...botSettings }),
        });
        const responseData = await response.json();

        // Add bot response to the thread
        setThread((prevThread) => ({
            ...prevThread,
            replies: [...prevThread.replies, { id: new Date().toISOString(), text: responseData, author: 'Bot', timestamp: new Date().toISOString(), replies: [] }],
        }));
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Bot Mode</CardTitle>
            </CardHeader>
            <CardContent>
                <Input
                    value={botSettings.systemPrompt}
                    onChange={(e) => setBotSettings({ ...botSettings, systemPrompt: e.target.value })}
                />
                <Slider
                    value={[botSettings.temperature]}
                    max={1}
                    step={0.01}
                    onValueChange={([value]) => setBotSettings({ ...botSettings, temperature: value })}
                />
                <Button onClick={() => handleBotResponse(thread.text)}>Run Bot</Button>
            </CardContent>
        </Card>
    );
};

export default BotMode;
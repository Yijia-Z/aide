"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SignIn, useUser } from "@clerk/nextjs";
import Image from "next/image";

export default function LoginPage() {
    const { isSignedIn } = useUser();
    const router = useRouter();

    useEffect(() => {
        if (isSignedIn) {
            router.push("/");
        }
    }, [isSignedIn, router]);

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
            <div className="w-full max-w-5xl flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="hidden md:block text-center md:w-1/2">
                    <h1 className="text-4xl font-serif mb-4">Sign In to Access:</h1>
                    <div className="text-xl space-y-4 mb-8 font-serif text-muted-foreground">
                        <p>Set your custom API keys</p>
                        <p>Sync settings across devices</p>
                        <p>Access premium models</p>
                        <p>Save chat history</p>
                    </div>
                    <Image
                        src="/app.jpg"
                        alt="App Preview"
                        width={800}
                        height={600}
                        className="w-full rounded-lg shadow-lg"
                        priority
                    />
                </div>
                <div className="md:w-1/2">
                    <SignIn routing="hash" />
                </div>
            </div>
        </main>
    );
}
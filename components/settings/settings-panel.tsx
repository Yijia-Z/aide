"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { SignIn } from "@clerk/nextjs";
import { ModeToggle } from "./mode-toggle";
import { motion } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Check, Edit, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { storage } from "@/components/store";

/**
 * The `SettingsPanel` component renders a settings interface for the user.
 * It displays account settings if the user is signed in (Clerk), otherwise shows a login form.
 *
 * @component
 * @example
 * <SettingsPanel />
 *
 * @returns {JSX.Element} The rendered settings panel component.
 *
 * @remarks
 * This component uses Clerk's `useUser()` hook to get the current user.
 * It also includes a logout button that calls `clerk.signOut()` from `useClerk()`.
 */
export function SettingsPanel() {
  const { user, isSignedIn } = useUser();
  // const { signOut } = useClerk();
  const [apiKey, setApiKey] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const savedKey = storage.get("openrouter_api_key");
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setApiKey(newKey);
    storage.set("openrouter_api_key", newKey);
  };

  return (
    <div className="flex flex-col relative h-[calc(97vh)]">
      <div
        className="top-bar bg-gradient-to-b from-background/100 to-background/00"
        style={{
          mask: "linear-gradient(black, black, transparent)",
          backdropFilter: "blur(1px)",
        }}
      >
        <h2 className="text-4xl font-serif font-bold pl-2">Settings</h2>
        <ModeToggle />
      </div>
      <ScrollArea className="flex-grow select-none">
        <motion.div
          className="space-y-2 mt-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <motion.div
            className="group p-2 rounded-lg custom-shadow"
          >
            {!isSignedIn ? (
              <div className="flex justify-center">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="default" className="transition-scale-zoom">Sign In</Button>
                  </DialogTrigger>
                  <DialogContent className="flex flex-row items-center justify-between min-w-full min-h-full p-0 bg-background/80 custom-shadow">
                    <div className="text-center hidden md:block flex-1">
                      <DialogTitle className="text-3xl mb-4 font-serif">Sign In to Access:</DialogTitle>
                      <DialogDescription className="text-xl space-y-4 mb-4 font-serif">
                        Set your custom API keys<br />
                        Sync settings across devices<br />
                        Access premium models<br />
                        Save chat history
                      </DialogDescription>
                      <img src="/app.png" alt="App Preview" className="w-3/4 mx-auto rounded-lg shadow-lg" />
                    </div>
                    <div className="flex-1 flex justify-center select-none">
                      <SignIn routing="hash" />
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <UserButton />
                <p>{user?.fullName}</p>
              </div>
            )}
          </motion.div>

          <motion.div
            key="api-settings"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            whileHover={{ y: -2 }}
            className="group p-2 rounded-lg md:hover:shadow-[inset_0_0_10px_10px_rgba(128,128,128,0.2)]"
            onDoubleClick={() => isSignedIn && setIsEditing(!isEditing)}
          >
            <div className="flex justify-between items-start">
              {isSignedIn && (
                <Button
                  variant="ghost"
                  className="transition-scale-zoom md:opacity-0 md:group-hover:opacity-100 transition-opacity absolute right-2"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? <Check className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                </Button>
              )}
              <div>
                <h3 className="font-bold">API Settings</h3>
                <div className="space-y-1">
                  <label htmlFor="api-key" className="text-sm text-muted-foreground font-medium">
                    OpenRouter API Key
                  </label>
                  {isSignedIn ? (
                    isEditing ? (
                      <div>
                        <Input
                          id="api-key"
                          type="password"
                          value={apiKey}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (!value || value.startsWith('sk-')) {
                              handleApiKeyChange(e);
                            }
                          }}
                          placeholder="sk-••••••••"
                          className="w-full mb-1"
                        />
                        <p className="text-xs text-muted-foreground">
                          Get your API key from{" "}
                          <a
                            href="https://openrouter.ai/keys"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-primary"
                          >
                            OpenRouter
                          </a>
                        </p>
                      </div>
                    ) : (
                      <div className="text-sm">
                        {apiKey ? "••••••••" : "none"}
                      </div>
                    )
                  ) : (
                    <div className="text-muted-foreground flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Sign in to set custom keys
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </ScrollArea>
    </div>
  );
}

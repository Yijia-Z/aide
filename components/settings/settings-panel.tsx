"use client";

import React, { useState, useEffect } from "react";
import { useUser, UserButton, SignIn } from "@clerk/nextjs";
import { ModeToggle } from "./mode-toggle";
import { motion } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Check, Edit, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { storage } from "@/components/store";
import { useUserProfile } from "../hooks/use-userprofile";
import Image from "next/image";

/**
 * The `SettingsPanel` component renders a settings interface for the user.
 * It displays account settings if the user is signed in (Clerk), otherwise shows a login form.
 */
export function SettingsPanel() {
  const { user, isSignedIn } = useUser();

  // --- (A) State for the "custom username" from our own DB (via /api/user/profile).
  const { username, saveUsername } = useUserProfile();

  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [userNameLocal, setUserNameLocal] = useState<string | null>("user");
  // --- (B) State for the "OpenRouter API Key" (unchanged).
  const [apiKey, setApiKey] = useState("");
  const [isEditingApiKey, setIsEditingApiKey] = useState(false);

  // 读取本地存的 API key
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

  React.useEffect(() => {
    setUserNameLocal(username);
  }, [username]);

  // 保存时，调用 saveUsername(...) 更新后端 + Hook state
  const handleSaveUsername = async () => {
    if (userNameLocal) {
      await saveUsername(userNameLocal);
    }
    setIsEditingUsername(false);
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
          {/* 登录块 / 用户信息块 */}
          <motion.div className="group p-2 rounded-lg custom-shadow">
            {!isSignedIn ? (
              <div className="flex justify-center">
                <Button
                  variant="default"
                  className="transition-scale-zoom"
                  onClick={() => window.location.href = '/login'}
                >
                  Sign In
                </Button>
              </div>
            ) : (
              // 已登录时
              <div className="flex items-center gap-4">
                <UserButton />

                {/* 取代 user?.fullName：显示 + 编辑 我们自己的 username */}
                <div className="flex flex-col flex-grow">
                  {/* 如果不在编辑状态，就只显示 username；否则显示一个可编辑输入框 */}
                  {!isEditingUsername ? (
                    <div className="flex items-center justify-between">
                      <p className="text-lg">
                        {userNameLocal || "🤔..."}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="transition-scale-zoom"
                        onClick={() => setIsEditingUsername(true)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <Input
                        className="flex-grow"
                        value={userNameLocal || ""}
                        onChange={(e) => setUserNameLocal(e.target.value.slice(0, 50))}
                        maxLength={20}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSaveUsername}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>

          {/* ============ 下面是 API Key 块 ============ */}
          <motion.div
            key="api-settings"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            whileHover={isEditingApiKey ? undefined : { y: -2 }}
            className={`group p-2 rounded-lg mb-2 ${isEditingApiKey
              ? "custom-shadow"
              : "md:hover:shadow-[inset_0_0_10px_10px_rgba(128,128,128,0.2)] bg-background cursor-pointer"
              }`}
            onDoubleClick={() => {
              if (isSignedIn && !isEditingApiKey) {
                setIsEditingApiKey(true);
              }
            }}
          >
            <div className={`${!isEditingApiKey ? "flex-grow justify-between items-start" : ""}`}>
              <div>
                <div
                  className="flex cursor-pointer justify-between items-center"
                  onDoubleClick={() => {
                    if (isEditingApiKey) {
                      setIsEditingApiKey(false);
                    }
                  }}
                >
                  <h3 className="font-bold text-xl">API Settings <br /> (Coming Soon)</h3>
                  {isSignedIn && (
                    <Button
                      variant="ghost"
                      className="transition-scale-zoom md:opacity-0 md:group-hover:opacity-100 transition-opacity sticky"
                      size="sm"
                      onClick={() => setIsEditingApiKey(!isEditingApiKey)}
                    >
                      {isEditingApiKey ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Edit className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>

                {/* 如果登录了才显示 API Key */}
                {isSignedIn && (
                  <div className="text-muted-foreground">
                    {isEditingApiKey ? (
                      <div>
                        <div className="pb-1">
                          <Label>
                            OpenRouter{" "}
                            <a
                              href="https://openrouter.ai/keys"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:text-primary"
                            >
                              API Key
                            </a>
                          </Label>
                        </div>
                        <Input
                          id="api-key"
                          type="password"
                          value={apiKey}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (!value || value.startsWith("sk-")) {
                              handleApiKeyChange(e);
                            }
                          }}
                          placeholder="sk-••••••••"
                          className="min-font-size text-foreground"
                        />
                      </div>
                    ) : (
                      <div className="text-sm">
                        <Label>OpenRouter:</Label>
                        {apiKey ? " ••••••••" : " none"}
                      </div>
                    )}
                  </div>
                )}

                {/* 如果没登录，就提示 "Sign in to set custom keys" */}
                {!isSignedIn && (
                  <div className="text-muted-foreground flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Sign in to set custom keys
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </ScrollArea>
    </div>
  );
}

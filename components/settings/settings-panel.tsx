"use client";

import React, { useState, useEffect, useRef } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import { ModeToggle } from "./mode-toggle";
import { motion } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { KeyInfo } from "@/components/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { storage } from "@/components/store";
import { useUserProfile } from "../hooks/use-userprofile";
import { Check, Edit, Lock } from "lucide-react";

/**
 * 接口：SettingsPanel 需要从父组件接收：
 *   keyInfo: 父组件存的用量信息 (null 代表尚未拉取 / 出错)
 *   refreshUsage: 父组件提供的函数，用于请求 /auth/key 并 setKeyInfo
 */
interface SettingsPanelProps {
  keyInfo: KeyInfo | null;
  refreshUsage: (userKey: string) => void;
}

export function SettingsPanel({ keyInfo, refreshUsage }: SettingsPanelProps) {
  const { user, isSignedIn } = useUser();
  const { username, saveUsername, balance } = useUserProfile();

  // 本地 state: username + apiKey
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [userNameLocal, setUserNameLocal] = useState<string | null>("user");
  const [apiKey, setApiKey] = useState("");
  const [isEditingApiKey, setIsEditingApiKey] = useState(false);

  // 如果你有错误信息，也可放这里
  const [error, setError] = useState<string | null>(null);

  // 记住上一次 editingApiKey 的状态，用来判断何时从 true -> false
  const prevEditingApiKeyRef = useRef<boolean>(false);

  // ------------------ 各种 useEffect ------------------
  // 1) 组件挂载时，从 localStorage 读取 Key
  useEffect(() => {
    const savedKey = storage.get("openrouter_api_key");
    if (savedKey) {
      setApiKey(savedKey);
      // 父组件刷新 usage
      refreshUsage(savedKey);
    }
  }, [refreshUsage]);

  // 2) 如果 username hook 有更新，就同步给本地
  useEffect(() => {
    setUserNameLocal(username);
  }, [username]);

  // 3) 检测 “API Key 编辑状态” 何时从 true -> false
  useEffect(() => {
    if (prevEditingApiKeyRef.current && !isEditingApiKey) {
      // 说明刚从 "编辑" 切换到 "非编辑"
      if (apiKey) {
        refreshUsage(apiKey); // 父组件刷新 usage
      }
    }
    prevEditingApiKeyRef.current = isEditingApiKey;
  }, [isEditingApiKey, apiKey, refreshUsage]);

  // --------------- 事件处理 --------------
  // 保存自定义用户名
  const handleSaveUsername = async () => {
    if (userNameLocal) {
      await saveUsername(userNameLocal);
    }
    setIsEditingUsername(false);
  };

  // 当用户在输入框修改 API Key
  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setApiKey(newKey);
    storage.set("openrouter_api_key", newKey); // 存 localStorage
  };

  // --------------- UI渲染 ---------------
  return (
    <div className="flex flex-col relative h-[calc(97vh)]">
      <div
        className="top-bar bg-linear-to-b from-background/100 to-background/00"
        style={{
          mask: "linear-gradient(black, black, transparent)",
          backdropFilter: "blur(1px)",
        }}
      >
        <h2 className="text-4xl font-serif font-bold pl-2">Settings</h2>
        <ModeToggle />
      </div>

      <ScrollArea className="grow select-none p-2">
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
                <Button variant="default" onClick={() => (window.location.href = "/login")}>
                  Sign In
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <UserButton />
                <div className="flex flex-col grow">
                  {!isEditingUsername ? (
                    <div className="flex items-center justify-between">
                      <p className="text-lg">{userNameLocal || "🤔..."}</p>
                      <Button variant="ghost" size="sm" onClick={() => setIsEditingUsername(true)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <Input
                        className="grow"
                        value={userNameLocal || ""}
                        onChange={(e) => setUserNameLocal(e.target.value.slice(0, 50))}
                        maxLength={20}
                      />
                      <Button variant="ghost" size="sm" onClick={handleSaveUsername}>
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {/*//不想显示可以把balance注销。需要的时候解除即可。*/}
                  <p className="text-sm text-muted-foreground">
                    Balance: {balance}
                  </p>
                </div>
              </div>
            )}
          </motion.div>

          {/* API Key 块 */}
          <motion.div
            key="api-settings"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            whileHover={isEditingApiKey ? undefined : { y: -2 }}
            className={`group p-2 rounded-lg mb-2 ${isEditingApiKey ? "custom-shadow" : "md:hover:shadow-[inset_0_0_10px_10px_rgba(128,128,128,0.2)] bg-background cursor-pointer"
              }`}
            onDoubleClick={() => {
              if (isSignedIn) {
                setIsEditingApiKey((prev) => !prev);
              }
            }}
          >
            <div>
              <div className="flex cursor-pointer justify-between items-center">
                <h3 className="font-bold text-xl">API Settings</h3>
                {isSignedIn && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingApiKey(!isEditingApiKey)}
                  >
                    {isEditingApiKey ? <Check className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                  </Button>
                )}
              </div>

              {isSignedIn && (
                <div className="mt-2">
                  {isEditingApiKey ? (
                    <div className="space-y-2">
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
                        type="password"
                        value={apiKey}
                        onChange={handleApiKeyChange}
                        placeholder="sk-••••••••"
                      />
                      {error && <div className="text-red-500">{error}</div>}
                    </div>
                  ) : (
                    // 未在编辑状态，显示“已存 key” + usage info
                    <div className="text-sm">
                      <Label>OpenRouter:</Label>
                      {apiKey ? (
                        <>
                          <span className="ml-1">••••••••</span>
                          {/* 关键：用父组件传来的 keyInfo 展示余额 */}
                          {keyInfo ? (
                            <DashboardTable keyInfo={keyInfo} />
                          ) : (
                            <p className="text-muted-foreground">
                              (Key saved, usage unknown. Double-click or Edit to check.)
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="ml-1"> none</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!isSignedIn && (
                <div className="text-muted-foreground flex items-center gap-2 mt-2">
                  <Lock className="h-4 w-4" />
                  Sign in to set custom keys
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      </ScrollArea>
    </div>
  );
}

/** 用来显示余额 / 已用量的表格组件 */
function DashboardTable({ keyInfo }: { keyInfo: KeyInfo }) {
  // 你给的 KeyInfo => data.usage / data.limit / data.rate_limit ...
  const { usage, limit, is_free_tier, rate_limit } = keyInfo.data;

  // balance = limit - usage (if limit != null)
  let balance: number | null = limit === null ? null : limit - usage;

  return (
    <div className="mt-2 p-2 border rounded-lg text-sm text-foreground/80">
      <p className="font-bold mb-1">API Key Balance</p>
      <table className="w-full border-collapse text-left">
        <tbody>
          <tr>
            <td className="py-1 pr-2 text-muted-foreground">Balance:</td>
            <td>
              {balance === null
                ? "Unlimited"
                : `$${balance.toFixed(2)} remaining`}
            </td>
          </tr>
          <tr>
            <td className="py-1 pr-2 text-muted-foreground">Free Tier:</td>
            <td>{is_free_tier ? "Yes" : "No"}</td>
          </tr>
          <tr>
            <td className="py-1 pr-2 text-muted-foreground">Rate Limit:</td>
            <td>{rate_limit.requests} requests / {rate_limit.interval}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

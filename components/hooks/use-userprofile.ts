
import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";

/**
 * 自定义 Hook：useUserProfile
 *  - 从后端 /api/user/profile 获取当前用户的 username，并存到本地 state
 *  - 提供一个 saveUsername(...) 用于更新 /api/user/profile 并刷新 state
 */
export function useUserProfile() {
  const { user,isSignedIn } = useUser();
  const [username, setUsername] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>("0"); // 字符串存储
  const [error, setError] = useState<string | null>(null);
  // 每次 isSignedIn 为 true 时，去请求 /api/user/profile
  useEffect(() => {
    if (!isSignedIn) {
      setUsername(null);
      setBalance("0");
      return;
    }
   
   
    reloadUserProfile()
  }, [isSignedIn]);
  async function reloadUserProfile() {
    try {
      const res = await fetch("/api/user/profile");
      if (!res.ok) {
        console.warn("Failed to fetch user profile =>", res.status);
        return;
      }
      const data = await res.json();
      setUsername(data.username ?? null);
      setBalance(data.balance ?? "0");
    } catch (err) {
      console.error("Error reloading user profile:", err);
    }
  }
   /**
   * 保存（更新）用户名至后端 - 乐观更新版本
   * @param newName 要更新的用户名
   */
   async function saveUsername(newName: string) {
    // 1) 先记住旧值
    const oldName = username;
    // 2) 前端先行更新 (乐观更新)
    setUsername(newName);

    // 3) 发请求
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newName }),
      });

      if (!res.ok) {
        throw new Error(`Failed to update username => HTTP ${res.status}`);
      }

      const data = await res.json();
      // 4) 如果后端成功返回，有时可以再以后端返回为准
      setUsername(data.username ?? null);
    } catch (err) {
      console.error("Error updating username:", err);
      // 5) 若后端失败 => 回滚到原先的 username
      setUsername(oldName ?? null);
    }
  }

  return {
    username,
    setUsername,   // 如果你想手动改也可以用它
    saveUsername,  // 直接后端更新 (乐观更新)
    balance,
    reloadUserProfile, 
    error,
  };
}
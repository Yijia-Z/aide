
import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";

/**
 * 自定义 Hook：useUserProfile
 *  - 从后端 /api/user/profile 获取当前用户的 username，并存到本地 state
 *  - 提供一个 saveUsername(...) 用于更新 /api/user/profile 并刷新 state
 */
export function useUserProfile() {
  const { isSignedIn } = useUser();
  const [username, setUsername] = useState<string | null>(null);

  // 每次 isSignedIn 为 true 时，去请求 /api/user/profile
  useEffect(() => {
    if (!isSignedIn) {
      setUsername(null);
      return;
    }

    async function fetchUsername() {
      try {
        const res = await fetch("/api/user/profile");
        if (!res.ok) {
          console.warn("Failed to fetch username (user not found or not signed in)");
          return;
        }
        const data = await res.json();
        setUsername(data.username ?? null);
      } catch (err) {
        console.error("Error fetching username:", err);
      }
    }

    fetchUsername();
  }, [isSignedIn]);

  /**
   * 保存（更新）用户名至后端
   * @param newName 要更新的用户名
   */
  async function saveUsername(newName: string) {
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newName }),
      });
      if (res.ok) {
        const data = await res.json();
        // 后端成功返回后，也更新到本地 state
        setUsername(data.username ?? null);
      } else {
        console.error("Failed to update username");
      }
    } catch (err) {
      console.error("Error updating username:", err);
    }
  }

  return {
    username,
    setUsername,   // 如果你想手动改也可以用它
    saveUsername,  // 直接后端更新
  };
}

// app/lib/api/messageApi.ts

import { Message } from "@/components/types"; // 视你的类型路径而定

export async function fetchMessageLatest(messageId: string) {
  const res = await fetch(`/api/messages/${messageId}`, { 
    method: "GET" 
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch message. Status=${res.status}`);
  }
  const data = await res.json();
  return data.message; // 假设后端返回 { message: {...} }
}
export async function lockMessage(messageId: string) {
  const res = await fetch(`/api/messages/${messageId}/lock`, {
    method: "PATCH",
  });
  if (res.ok) {
    return true; // 成功锁定
  }
  if (res.status === 409) {
    // 冲突：被他人锁定
    return false;
  }
  throw new Error(`Lock request failed, status=${res.status}`);
}

// 解锁消息
export async function unlockMessage(messageId: string | null) {
  const res = await fetch(`/api/messages/${messageId}/unlock`, {
    method: "PATCH",
  });
  if (!res.ok) {
    throw new Error("Failed to unlock message");
  }
  console.log("Message unlocked in DB");
}

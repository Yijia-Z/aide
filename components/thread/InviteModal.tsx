import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// 可以按你自己的枚举定义改动
type ThreadRole = "VIEWER" | "PUBLISHER" | "EDITOR" | "OWNER";

interface InviteModalProps {
  threadId: string;     // 要邀请到的 Thread ID
  onClose: () => void;  // 关闭弹窗的回调
}

/**
 * 支持多条邀请的弹窗组件
 */
export function InviteModal({ threadId, onClose }: InviteModalProps) {
  // 用一个数组来存储多个邀请人，每个对象包含 email 和角色
  const [inviteList, setInviteList] = useState<
    { email: string; role: ThreadRole }[]
  >([
    { email: "", role: "VIEWER" }, // 初始先有一行
  ]);

  /** 增加一行邀请 */
  function handleAddRow() {
    setInviteList((prev) => [...prev, { email: "", role: "VIEWER" }]);
  }

  /** 删除指定行 */
  function handleRemoveRow(index: number) {
    // 如果只剩一行，也可以允许删到0行，按需求可自己决定
    if (inviteList.length === 1) {
      return;
    }
    setInviteList((prev) => prev.filter((_, i) => i !== index));
  }

  /** 修改某行的 email */
  function handleEmailChange(index: number, newEmail: string) {
    setInviteList((prev) =>
      prev.map((item, i) => (i === index ? { ...item, email: newEmail } : item))
    );
  }

  /** 修改某行的 role */
  function handleRoleChange(index: number, newRole: ThreadRole) {
    setInviteList((prev) =>
      prev.map((item, i) => (i === index ? { ...item, role: newRole } : item))
    );
  }

  /** 点击 OK => 一次性发送所有邀请 */
  async function handleConfirmInvites() {
    try {
        const hasEmptyEmail = inviteList.some((item) => !item.email.trim());
        if (hasEmptyEmail) {
          alert("empty email");
          return;
        }
      // 你可以把后端的 API 改成 /invite/bulk 或 /multi-invite 等
      const res = await fetch(`/api/threads/${threadId}/multi-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invites: inviteList }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert("Invite failed: " + err.error);
        return;
      }
      alert("Invite success!");
      onClose();
      // 这里也可以清空 inviteList，但通常关掉弹窗就够了
      // setInviteList([{ email: "", role: "VIEWER" }]);
    } catch (err) {
      console.error("Error inviting =>", err);
      alert("Server error");
    }
  }

  /** 点击 Cancel => 清空并关闭 */
  function handleCancel() {
    // 清空
    setInviteList([{ email: "", role: "VIEWER" }]);
    onClose();
  }

  return (
    <div
      className="
        fixed inset-0 flex items-center justify-center 
        bg-black/50 z-50
      "
      onClick={handleCancel}
    >
      <div
        className="bg-background p-4 rounded w-[400px] shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl mb-4">Invite users to thread</h2>

        {/* 多行输入区域 */}
        {inviteList.map((item, index) => (
          <div key={index} className="flex items-center gap-2 mb-2">
            <Input
              type="email"
              placeholder="Email"
              value={item.email}
              onChange={(e) => handleEmailChange(index, e.target.value)}
              className="flex-1"
            />
            <select
              value={item.role}
              onChange={(e) =>
                handleRoleChange(
                  index,
                  e.target.value as ThreadRole
                )
              }
              className="border p-1 rounded"
            >
              <option value="VIEWER">Viewer</option>
              <option value="PUBLISHER">Publisher</option>
              <option value="EDITOR">Editor</option>
              <option value="OWNER">Owner</option>
            </select>

            {/* “+”按钮：增加一行 */}
            <Button variant="outline" onClick={handleAddRow}>
              +
            </Button>
            {/* “-”按钮：删除当前行 */}
            <Button
              variant="outline"
              onClick={() => handleRemoveRow(index)}
              disabled={inviteList.length <= 1}
            >
              -
            </Button>
          </div>
        ))}

        {/* 底部按钮 */}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirmInvites}>OK</Button>
        </div>
      </div>
    </div>
  );
}

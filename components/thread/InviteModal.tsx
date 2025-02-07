import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Crown, Edit, Eye, Minus, Send, Plus } from "lucide-react";

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
  const { toast } = useToast();

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

  function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /** 点击 OK => 一次性发送所有邀请 */
  async function handleConfirmInvites() {
    try {
      // Check for empty or invalid emails
      const invalidEmails = inviteList.filter(
        item => !item.email.trim() || !isValidEmail(item.email.trim())
      );

      if (invalidEmails.length > 0) {
        toast({
          title: "Error",
          description: "Please enter valid email addresses",
          variant: "destructive"
        });
        return;
      }

      const res = await fetch(`/api/threads/${threadId}/multi-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invites: inviteList }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast({
          title: "Error",
          description: `Invite failed: ${err.error}`,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Success",
        description: "Invites sent successfully!"
      });
      onClose();
    } catch (err) {
      console.error("Error inviting =>", err);
      toast({
        title: "Error",
        description: "Server error occurred",
        variant: "destructive"
      });
    }
  }

  /** 点击 Cancel => 清空并关闭 */
  function handleCancel() {
    // 清空
    setInviteList([{ email: "", role: "VIEWER" }]);
    onClose();
  }

  return (
    <Dialog open={true} onOpenChange={() => handleCancel()}>
      <DialogContent className="sm:max-w-[425px] custom-shadow">
        <DialogHeader>
          <DialogTitle>Invite users to thread</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {inviteList.map((item, index) => (
            <div key={index} className="flex items-center gap-2 mb-2">
              <Input
                type="email"
                placeholder="Email"
                value={item.email}
                onChange={(e) => handleEmailChange(index, e.target.value)}
                className={`flex-1 ${item.email && !isValidEmail(item.email) ? "border-red-500" : ""
                  }`}
                required
                pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
              />
              <Select
                value={item.role}
                onValueChange={(value) => handleRoleChange(index, value as ThreadRole)}
              >
                <SelectTrigger className="w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIEWER">
                    <div className="flex items-center">
                      <Eye className="mr-2 h-4 w-4" />
                      Viewer
                    </div>
                  </SelectItem>
                  <SelectItem value="PUBLISHER">
                    <div className="flex items-center">
                      <Send className="mr-2 h-4 w-4" />
                      Publisher
                    </div>
                  </SelectItem>
                  <SelectItem value="EDITOR">
                    <div className="flex items-center">
                      <Edit className="mr-2 h-4 w-4" />
                      Editor
                    </div>
                  </SelectItem>
                  <SelectItem value="OWNER">
                    <div className="flex items-center">
                      <Crown className="mr-2 h-4 w-4" />
                      Owner
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleAddRow()}
              >
                <Plus />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveRow(index)}
                disabled={inviteList.length <= 1}
              >
                <Minus />
              </Button>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirmInvites}>Invite</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/use-toast"
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
import { Crown, Edit, Eye, Minus, Send, UserPlus, Check, X, UserMinus, Users, UserPen } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Types
type ThreadRole = "VIEWER" | "EDITOR" | "OWNER" | "CREATOR";

interface InvitedUser {
  email: string;
  userId: string;
  username: string;
  role: ThreadRole;
}

interface InviteEntry {
  email: string;
  role: ThreadRole;
}

interface InviteModalProps {
  threadId: string;
  onClose: () => void;
}

/**
 * Support for managing existing users and inviting new users
 */
export function InviteModal({ threadId, onClose }: InviteModalProps) {
  // State for existing invited users
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<ThreadRole | null>(null);

  // State for new invites
  const [inviteList, setInviteList] = useState<InviteEntry[]>([
    { email: "", role: "VIEWER" }
  ]);

  const { toast } = useToast();
  const { userId: currentUserId } = useAuth();
  const queryClient = useQueryClient();

  // Query for fetching invited users
  const { data: invitedUsers = [], isLoading } = useQuery({
    queryKey: ['invitedUsers', threadId],
    queryFn: async () => {
      const res = await fetch(`/api/threads/${threadId}/invited-users`);
      if (!res.ok) throw new Error('Failed to fetch invited users');
      const data = await res.json();
      return data.users.filter((user: InvitedUser) => user.role !== "CREATOR");
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep cache for 5 minutes
  });

  // Mutation for updating user role
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: ThreadRole }) => {
      const res = await fetch(`/api/threads/${threadId}/invited-users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });
      if (!res.ok) throw new Error('Failed to update user role');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitedUsers', threadId] });
      toast({
        title: "Success",
        description: "User role updated successfully"
      });
      setEditingUserId(null);
      setEditingRole(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive"
      });
    }
  });

  // Mutation for sending invites
  const sendInviteMutation = useMutation({
    mutationFn: async (invites: InviteEntry[]) => {
      const res = await fetch(`/api/threads/${threadId}/multi-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invites }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitedUsers', threadId] });
      toast({
        title: "Success",
        description: "Invites sent successfully!"
      });
      setInviteList([{ email: "", role: "VIEWER" }]);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send invites",
        variant: "destructive"
      });
    }
  });

  // Handlers for existing users
  async function handleEditUserRole(userId: string, currentRole: ThreadRole) {
    setEditingUserId(userId);
    setEditingRole(currentRole);
  }

  async function handleConfirmRoleChange(userId: string) {
    if (!editingRole) return;
    updateRoleMutation.mutate({ userId, role: editingRole });
  }

  function handleCancelRoleChange() {
    setEditingUserId(null);
    setEditingRole(null);
  }

  // Handlers for new invites
  function handleAddInviteRow() {
    setInviteList(prev => [...prev, { email: "", role: "VIEWER" }]);
  }

  function handleRemoveInviteRow(index: number) {
    setInviteList(prev => prev.filter((_, i) => i !== index));
  }

  function handleInviteEmailChange(index: number, email: string) {
    setInviteList(prev =>
      prev.map((item, i) => i === index ? { ...item, email } : item)
    );
  }

  function handleInviteRoleChange(index: number, role: ThreadRole) {
    setInviteList(prev =>
      prev.map((item, i) => i === index ? { ...item, role } : item)
    );
  }

  function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function handleSendInvite(index: number) {
    const invite = inviteList[index];
    if (!invite.email.trim() || !isValidEmail(invite.email.trim())) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive"
      });
      return;
    }
    sendInviteMutation.mutate([invite]);
  }

  async function handleConfirmAllInvites() {
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

    sendInviteMutation.mutate(inviteList);
  }

  function handleCancel() {
    setInviteList([{ email: "", role: "VIEWER" }]);
    onClose();
  }

  return (
    <Dialog open={true} onOpenChange={() => handleCancel()}>
      <DialogContent className="sm:max-w-[425px] custom-shadow select-none">
        <DialogHeader>
          <DialogTitle>Invite Collaborators</DialogTitle>
        </DialogHeader>

        <motion.div
          className="py-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {/* Existing Users Section */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <h3 className="text-lg font-semibold">Current Users</h3>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-8 w-full rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {invitedUsers.map((user: InvitedUser) => (
                <motion.div
                  key={user.userId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2 mb-2"
                >
                  {editingUserId === user.userId ? (
                    <div className="flex-1 flex items-center gap-4 rounded-md">
                      <div className="flex items-center gap-2">
                        <Select
                          value={editingRole || user.role}
                          onValueChange={(value) => setEditingRole(value as ThreadRole)}
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
                        <span>{user.username}</span>
                      </div>
                      <div className="flex items-center gap-2 ml-auto">
                        <Button variant="outline" size="icon" onClick={() => handleConfirmRoleChange(user.userId)}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={handleCancelRoleChange}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex custom-shadow items-center justify-between py-1 px-3 border rounded-md">
                      <div className="flex items-center gap-2">
                        {user.role === "VIEWER" && <Eye className="h-4 w-4" />}
                        {user.role === "EDITOR" && <Edit className="h-4 w-4" />}
                        {user.role === "OWNER" && <Crown className="h-4 w-4" />}
                        <span>{user.username}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{user.email}</span>
                        {user.userId === currentUserId ? (
                          <span className="text-sm">You</span>
                        ) : (
                          <UserPen
                            className="h-4 w-4 hover:text-background cursor-pointer"
                            onClick={() => handleEditUserRole(user.userId, user.role)}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {/* New Invites Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="flex items-center justify-between mt-6 mb-4"
          >
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              <h3 className="text-lg font-semibold">New Invites</h3>
            </div>
            <Button
              variant="outline"
              className="custom-shadow"
              onClick={handleAddInviteRow}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Invite
            </Button>
          </motion.div>

          <AnimatePresence mode="popLayout">
            {inviteList.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2 mb-2"
              >
                <Select
                  value={item.role}
                  onValueChange={(value) => handleInviteRoleChange(index, value as ThreadRole)}
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

                <Input
                  type="email"
                  placeholder="Email"
                  value={item.email}
                  onChange={(e) => handleInviteEmailChange(index, e.target.value)}
                  className={`flex-1 ${item.email && !isValidEmail(item.email) ? "border-red-500" : ""}`}
                  required
                  pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
                />

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleSendInvite(index)}
                >
                  <Send className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleRemoveInviteRow(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        <DialogFooter>
          <AnimatePresence>
            {inviteList.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="flex gap-2"
              >
                <Button onClick={handleConfirmAllInvites}>
                  <Check className="h-4 w-4 mr-2" />
                  Send All Invites
                </Button>
                <Button variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
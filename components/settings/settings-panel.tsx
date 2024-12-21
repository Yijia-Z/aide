"use client";

import { useUser, useClerk, UserProfile, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { SignIn } from "@clerk/nextjs";
import { ModeToggle } from "./mode-toggle";
import { motion } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";

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
  const { signOut } = useClerk();

  const handleLogout = () => {
    signOut();
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
        <h2 className="text-2xl font-serif font-bold pl-2">Settings</h2>
        <ModeToggle />
      </div>
      <ScrollArea className="flex-grow">
        <motion.div
          className="space-y-2 mt-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          {!isSignedIn ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Sign In</Button>
              </DialogTrigger>
              <DialogContent className="flex items-center justify-center">
                <SignIn routing="hash" />
              </DialogContent>
            </Dialog>
          ) : (
            <div className="p-4">
              <div className="flex items-center gap-4">
                <UserButton />
                <p>{user?.fullName}</p>
              </div>
            </div>
          )}
        </motion.div>
      </ScrollArea>
    </div>
  );
}

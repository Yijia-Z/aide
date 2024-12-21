"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { LoginForm } from "@/components/ui/login-form";
import { ModeToggle } from "./mode-toggle";
import { motion } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";

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
            <LoginForm />
          ) : (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Account Settings</h2>
              <div className="flex items-center justify-between">
                <span>
                  Logged in as: {user?.fullName ?? user?.primaryEmailAddress?.emailAddress}
                </span>
                <Button variant="destructive" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </ScrollArea>
    </div>
  );
}

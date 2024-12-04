"use client"

import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { LoginForm } from "@/components/ui/login-form"
import { ModeToggle } from "./mode-toggle"
import { motion } from 'framer-motion';
import { ScrollArea } from "@/components/ui/scroll-area";


/**
 * The `SettingsPanel` component renders a settings interface for the user.
 * It displays account settings if the user is logged in, otherwise it shows a login form.
 * 
 * @component
 * @example
 * // Usage example
 * <SettingsPanel />
 * 
 * @returns {JSX.Element} The rendered settings panel component.
 * 
 * @remarks
 * This component uses the `useSession` hook to get the current user session.
 * It also includes a logout button that calls the `signOut` function when clicked.
 * 
 * @dependencies
 * - `useSession` from `next-auth/react`
 * - `signOut` from `next-auth/react`
 * - `ModeToggle` component
 * - `ScrollArea` component
 * - `motion` from `framer-motion`
 * - `LoginForm` component
 * - `Button` component
 */

export function SettingsPanel() {
  const { data: session } = useSession()

  const handleLogout = () => {
    signOut()
  }

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
        <motion.div className="space-y-2 mt-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          {!session ? (
            <LoginForm />
          ) : (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Account Settings</h2>
              <div className="flex items-center justify-between">
                <span>Logged in as: {session?.user?.name}</span>
                <Button
                  variant="destructive"
                  onClick={handleLogout}
                >
                  Logout
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </ScrollArea>
    </div>
  )
}
"use client"

import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { LoginForm } from "@/components/login-form"
import { ModeToggle } from "./mode-toggle"
import { motion } from 'framer-motion';
import { ScrollArea } from "@/components/ui/scroll-area";


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
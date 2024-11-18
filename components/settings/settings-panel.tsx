"use client"

import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { LoginForm } from "@/components/login-form"
import { ModeToggle } from "./mode-toggle"
import { motion } from 'framer-motion';


export function SettingsPanel() {
  const { data: session } = useSession()

  const handleLogout = () => {
    signOut()
  }

  return (
    <div>
      <div className="flex items-center justify-center gap-2 pb-2">
        <span>Theme:</span>
        <ModeToggle />
      </div>
      <motion.div
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
    </div>
  )
}
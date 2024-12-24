/**
 * ModeToggle component provides a dropdown menu to toggle between light, dark, and system themes.
 * It uses the `useTheme` hook from `next-themes` to set the theme.
 *
 * @component
 * @example
 * // Usage example
 * <ModeToggle />
 *
 * @returns {JSX.Element} The rendered ModeToggle component.
 *
 * @remarks
 * This component uses the `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, and `DropdownMenuItem`
 * components from the `@/components/ui/dropdown-menu` module to create the dropdown menu.
 * It also uses the `Button` component from the `@/components/ui/button` module.
 *
 * The component displays a button with a sun icon for light mode and a moon icon for dark mode.
 * When the button is clicked, a dropdown menu appears with options to select light, dark, or system theme.
 *
 * @dependencies
 * - `react`
 * - `lucide-react`
 * - `next-themes`
 * - `@/components/ui/button`
 * - `@/components/ui/dropdown-menu`
 */
"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ModeToggle() {
    const { setTheme } = useTheme()

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild className="custom-shadow transition-scale-zoom">
                <Button variant="outline" className="bg-background hover:bg-secondary custom-shadow transition-scale-zoom text-primary border border-border absolute right-0">
                    <Sun className="h-4 w-4 dark:hidden" />
                    <Moon className="h-4 w-4 hidden dark:block" />
                    <span className="text-sm hidden lg:inline">
                        <span className="ml-2 dark:hidden">Light</span>
                        <span className="ml-2 hidden dark:inline">Dark</span>
                    </span>
                    <span className="sr-only">Toggle theme</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="custom-shadow">
                <DropdownMenuItem onClick={() => setTheme("light")}>
                    Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                    Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                    System
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
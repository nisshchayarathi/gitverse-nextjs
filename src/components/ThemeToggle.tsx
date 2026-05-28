"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui"

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light")

  useEffect(() => {
    // Load saved theme from localStorage
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.classList.add(savedTheme)
    } else {
      // Default to light
      setTheme("light")
      document.documentElement.classList.add("light")
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light"
    setTheme(newTheme)
    
    // Update document class
    document.documentElement.classList.remove("light", "dark")
    document.documentElement.classList.add(newTheme)
    
    // Save to localStorage
    localStorage.setItem("theme", newTheme)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 rounded-full relative overflow-hidden"
      onClick={toggleTheme}
      aria-label="Toggle theme"
    >
      {theme === "light" ? (
        <Moon className="h-[1.2rem] w-[1.2rem]" />
      ) : (
        <Sun className="h-[1.2rem] w-[1.2rem]" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}

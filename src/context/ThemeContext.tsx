'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('light')

  useEffect(() => {
    let activeTheme: Theme = 'light'
    try {
      const saved = localStorage.getItem('theme') as Theme | null
      if (saved === 'light' || saved === 'dark') {
        activeTheme = saved
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        activeTheme = prefersDark ? 'dark' : 'light'
      }
    } catch (e) {
      console.warn('Failed to access localStorage for theme:', e)
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      activeTheme = prefersDark ? 'dark' : 'light'
    }
    setThemeState(activeTheme)
    
    const root = document.documentElement
    if (activeTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    try {
      localStorage.setItem('theme', newTheme)
    } catch (e) {
      console.error('Failed to save theme to localStorage:', e)
    }
    const root = document.documentElement
    if (newTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}


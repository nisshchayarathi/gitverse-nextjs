"use client";
import React, { useState, useEffect } from 'react'

import Link from 'next/link'
import { GitBranch, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui'
import { ThemeToggle } from '@/components/ThemeToggle'

// Fix 1: Move navLinks outside the component to prevent dependency array issues
const navLinks = [
  { name: 'Features', href: '#features' },
  { name: 'How it Works', href: '#how-it-works' },
  { name: 'Pricing', href: '#pricing' },
]

export const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  // Fix 3: Set initial active state to the first item so there is a highlight on mount
  const [activeSection, setActiveSection] = useState<string>(navLinks[0].href)

  useEffect(() => {
    let observer: IntersectionObserver | null = null
    let elements: Element[] = []

    // Fix 2: Wrap in a short timeout to ensure late-loading or shifting DOM elements exist
    const timer = setTimeout(() => {
      elements = navLinks
        .map((link) => document.querySelector(link.href))
        .filter((el): el is Element => el !== null)

      if (elements.length === 0) return

      const observerOptions = {
        root: null,
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0,
      }

      const observerCallback = (entries: IntersectionObserverEntry[]) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(`#${entry.target.id}`)
          }
        })
      }

      observer = new IntersectionObserver(observerCallback, observerOptions)
      elements.forEach((el) => observer.observe(el))
    }, 100)

    return () => {
      clearTimeout(timer)
      if (observer) {
        elements.forEach((el) => observer?.unobserve(el))
        observer.disconnect()
      }
    }
  }, []) // Safe to leave empty now because navLinks is a static reference outside the component

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative">
              <GitBranch className="h-8 w-8 text-primary transition-transform group-hover:scale-110" />
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="text-xl font-heading font-bold text-foreground">
              Git<span className="text-gradient">Verse</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => {
              const isActive = activeSection === link.href
              return (
                <a
                  key={link.name}
                  href={link.href}
                  className={`transition-colors font-medium ${
                    isActive 
                      ? 'text-primary font-semibold' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {link.name}
                </a>
              )
            })}
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            <Button className="bg-gradient-primary hover:opacity-90 transition-opacity" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button className="bg-gradient-primary hover:opacity-90 transition-opacity" asChild>
              <Link href="/signup">Get Started</Link>
            </Button>
          </div> 

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Toggle menu"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-border/50">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => {
                const isActive = activeSection === link.href
                return (
                  <a
                    key={link.name}
                    href={link.href}
                    className={`transition-colors ${
                      isActive 
                        ? 'text-primary font-semibold' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setIsOpen(false)}
                  >
                    {link.name}
                  </a>
                )
              })}
              <div className="flex flex-col gap-3 pt-4 border-t border-border/50">
                <div className="flex justify-start"><ThemeToggle /></div>
                <Button className="bg-gradient-primary" asChild>
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button className="bg-gradient-primary" asChild>
                  <Link href="/signup">Get Started</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

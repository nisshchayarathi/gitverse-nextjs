'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  path: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  const pathname = usePathname()

  return (
    <nav className="flex items-center space-x-2 text-sm text-secondary">
      
    <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        const isActive = pathname === item.path

        return (
          <React.Fragment key={item.path}>
            {index > 0 && <ChevronRight size={16} className="text-secondary" />}
            {isLast || isActive ? (
              <span className="font-medium text-secondary">
            {/* CodeRabbit Fix: Changed text-secondary to text-muted-foreground for legible separator contrast */}
            {index > 0 && <ChevronRight size={16} className="text-muted-foreground" />}
            
            {isLast || isActive ? (
{isLast || isActive ? (
  <span className="font-medium text-foreground">
    {item.label}
  </span>
) : (
                {item.label}
              </span>
            ) : (
              <Link
                href={item.path}
                className="hover:text-primary dark:hover:text-primary-400 transition-colors"
              >
                {item.label}
              </Link>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}

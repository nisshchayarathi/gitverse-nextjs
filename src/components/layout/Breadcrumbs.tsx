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
  <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
    {items.map((item, index) => {
      const isLast = index === items.length - 1
      const isActive = pathname === item.path

      return (
        <div key={item.path} className="flex items-center space-x-2">
          <span>{item.label}</span>
        </div>
      )
    })}
  </nav>
)

}

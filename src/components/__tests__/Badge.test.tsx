import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Badge } from '../ui/Badge'

describe('Badge', () => {
  it('renders children correctly', () => {
    render(<Badge>New</Badge>)
    expect(screen.getByText('New')).toBeInTheDocument()
  })

  it('renders with default variant', () => {
    render(<Badge>Default</Badge>)
    const badge = screen.getByText('Default')
    expect(badge).toHaveClass('bg-primary/10')
  })

  it('renders with secondary variant', () => {
    render(<Badge variant="secondary">Secondary</Badge>)
    const badge = screen.getByText('Secondary')
    expect(badge).toHaveClass('bg-secondary')
  })

  it('renders with outline variant', () => {
    render(<Badge variant="outline">Outline</Badge>)
    const badge = screen.getByText('Outline')
    expect(badge).toHaveClass('border')
  })

  it('applies custom className', () => {
    render(<Badge className="my-class">Custom</Badge>)
    expect(screen.getByText('Custom')).toHaveClass('my-class')
  })

  it('renders as a span element', () => {
    render(<Badge>Span</Badge>)
    const badge = screen.getByText('Span')
    expect(badge.tagName.toLowerCase()).toBe('span')
  })
})
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Button } from '../ui/Button'

describe('Button', () => {
  it('renders with default variant', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })

  it('renders with destructive variant', () => {
    render(<Button variant="destructive">Delete</Button>)
    const btn = screen.getByRole('button', { name: /delete/i })
    expect(btn).toHaveClass('bg-destructive')
  })

  it('renders with outline variant', () => {
    render(<Button variant="outline">Outline</Button>)
    const btn = screen.getByRole('button', { name: /outline/i })
    expect(btn).toHaveClass('border')
  })

  it('renders with ghost variant', () => {
    render(<Button variant="ghost">Ghost</Button>)
    const btn = screen.getByRole('button', { name: /ghost/i })
    expect(btn).toBeInTheDocument()
  })

  it('renders with sm size', () => {
    render(<Button size="sm">Small</Button>)
    const btn = screen.getByRole('button', { name: /small/i })
    expect(btn).toHaveClass('h-9')
  })

  it('renders with lg size', () => {
    render(<Button size="lg">Large</Button>)
    const btn = screen.getByRole('button', { name: /large/i })
    expect(btn).toHaveClass('h-11')
  })

  it('calls onClick handler when clicked', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click</Button>)
    fireEvent.click(screen.getByRole('button', { name: /click/i }))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick when disabled', () => {
    const handleClick = jest.fn()
    render(<Button disabled onClick={handleClick}>Disabled</Button>)
    const btn = screen.getByRole('button', { name: /disabled/i })
    expect(btn).toBeDisabled()
    fireEvent.click(btn)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('applies custom className', () => {
    render(<Button className="custom-class">Custom</Button>)
    expect(screen.getByRole('button')).toHaveClass('custom-class')
  })

  it('renders as child element when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    )
    expect(screen.getByRole('link', { name: /link button/i })).toBeInTheDocument()
  })
})
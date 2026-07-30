import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { EmptyState } from '../ui/EmptyState'

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="No results" description="Try a different search" />)
    expect(screen.getByText('No results')).toBeInTheDocument()
    expect(screen.getByText('Try a different search')).toBeInTheDocument()
  })

  it('renders action button when actionLabel and onAction provided', () => {
    const onAction = jest.fn()
    render(
      <EmptyState
        title="Empty"
        description="Nothing here"
        actionLabel="Refresh"
        onAction={onAction}
      />
    )
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
  })

  it('calls onAction when button clicked', () => {
    const onAction = jest.fn()
    render(
      <EmptyState
        title="Empty"
        description="Nothing here"
        actionLabel="Retry"
        onAction={onAction}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('does not render button when actionLabel is missing', () => {
    render(<EmptyState title="Empty" description="Nothing here" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders suggestions list when provided', () => {
    render(
      <EmptyState
        title="Empty"
        description="Nothing here"
        suggestions={['Try again', 'Check filters']}
      />
    )
    expect(screen.getByText('Try again')).toBeInTheDocument()
    expect(screen.getByText('Check filters')).toBeInTheDocument()
  })

  it('does not render suggestions when not provided', () => {
    render(<EmptyState title="Empty" description="Nothing here" />)
    expect(screen.queryByText('Suggestions')).not.toBeInTheDocument()
  })

  it('has correct aria-label', () => {
    render(
      <EmptyState
        title="No repos"
        description="Nothing here"
        ariaLabel="custom aria label"
      />
    )
    expect(screen.getByRole('region', { name: /custom aria label/i })).toBeInTheDocument()
  })

  it('renders icon when provided as element', () => {
    render(
      <EmptyState
        title="Empty"
        description="Nothing here"
        icon={<span data-testid="test-icon">icon</span>}
      />
    )
    expect(screen.getByTestId('test-icon')).toBeInTheDocument()
  })
})
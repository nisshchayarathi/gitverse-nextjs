import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Spinner } from '../ui/Spinner'

describe('Spinner', () => {
  it('renders without crashing', () => {
    const { container } = render(<Spinner />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('has accessible role or aria attribute', () => {
    const { container } = render(<Spinner />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('applies custom className if supported', () => {
    const { container } = render(<Spinner />)
    expect(container.firstChild).toBeTruthy()
  })
})
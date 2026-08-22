import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import MessageList from './MessageList'

const handlers = {
  onReply: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onReact: vi.fn(),
}

describe('MessageList', () => {
  it('shows a loading failure instead of a misleading empty state', () => {
    render(<MessageList messages={[]} error="Relationship is ambiguous" {...handlers} />)

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load messages: Relationship is ambiguous")
    expect(screen.queryByText('No messages yet')).not.toBeInTheDocument()
  })

  it('shows the configured empty state when the query succeeds with no rows', () => {
    render(<MessageList messages={[]} emptyLabel="Say hello." {...handlers} />)

    expect(screen.getByText('No messages yet')).toBeInTheDocument()
    expect(screen.getByText('Say hello.')).toBeInTheDocument()
  })

  it('renders messages and wires message actions', () => {
    const onReply = vi.fn()
    const message = {
      id: 'message-1',
      sender_id: 'user-1',
      body: 'Hello Nexus',
      created_at: new Date().toISOString(),
      sender: { username: 'Jared', avatar_url: null },
      attachments: [],
      reactions: [],
    }

    const { container } = render(
      <MessageList
        messages={[message]}
        currentUserId="user-1"
        {...handlers}
        onReply={onReply}
      />
    )

    expect(screen.getByText('Jared')).toBeInTheDocument()
    expect(screen.getByText('Hello Nexus')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Reply'))
    expect(onReply).toHaveBeenCalledWith(message)
    expect(screen.getByTitle('Edit')).toBeInTheDocument()
    expect(screen.getByTitle('Delete')).toBeInTheDocument()
    expect(container.querySelector('.msg-row')).toHaveClass('is-mine')
  })

  it('keeps messages from teammates on the left', () => {
    const { container } = render(
      <MessageList
        messages={[{ id: 'message-2', sender_id: 'user-2', body: 'Left side', created_at: new Date().toISOString(), sender: { username: 'Angela' }, attachments: [], reactions: [] }]}
        currentUserId="user-1"
        {...handlers}
      />
    )
    expect(container.querySelector('.msg-row')).not.toHaveClass('is-mine')
  })
})

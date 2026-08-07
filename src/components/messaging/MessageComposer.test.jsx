import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import MessageComposer from './MessageComposer'

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  uploadFile: vi.fn(),
}))

vi.mock('react-toastify', () => ({ toast: { error: mocks.toastError } }))
vi.mock('../../lib/storage', () => ({ uploadFile: mocks.uploadFile }))

describe('MessageComposer', () => {
  it('submits trimmed text with Enter and clears the composer', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined)
    const onCancelReply = vi.fn()
    render(
      <MessageComposer
        workspaceId="workspace-1"
        placeholder="Message #General"
        onSend={onSend}
        onCancelReply={onCancelReply}
      />
    )

    const composer = screen.getByPlaceholderText('Message #General')
    fireEvent.change(composer, { target: { value: '  hello  ' } })
    fireEvent.keyDown(composer, { key: 'Enter' })

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith({ body: 'hello', replyToId: undefined, attachments: [] })
    })
    expect(composer).toHaveValue('')
    expect(onCancelReply).toHaveBeenCalled()
  })

  it('keeps the draft and reports an error when sending fails', async () => {
    const onSend = vi.fn().mockRejectedValue(new Error('Network unavailable'))
    render(<MessageComposer workspaceId="workspace-1" onSend={onSend} />)

    const composer = screen.getByPlaceholderText('Message...')
    fireEvent.change(composer, { target: { value: 'keep this' } })
    fireEvent.keyDown(composer, { key: 'Enter' })

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Network unavailable'))
    expect(composer).toHaveValue('keep this')
  })
})

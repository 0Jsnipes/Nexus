import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMessages } from './useMessages'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
  notifyNewMessage: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: mocks.from,
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
  },
}))

vi.mock('../../lib/authStore', () => ({
  useAuthStore: (selector) => selector({ profile: { id: 'user-1', username: 'Jared' } }),
}))

vi.mock('../../lib/notify', () => ({ notifyNewMessage: mocks.notifyNewMessage }))
vi.mock('../../lib/storage', () => ({ resolveStorageUrl: (value) => Promise.resolve(value) }))

const SELECT_COLUMNS =
  '*, sender:profiles!messages_sender_id_fkey(id, username, avatar_url), attachments:message_attachments(*), reactions:message_reactions(*)'

const createQuery = (result) => {
  const query = {
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    eq: vi.fn(() => query),
    then: (resolve) => Promise.resolve(result).then(resolve),
  }
  return query
}

describe('useMessages', () => {
  let selectResults
  let select
  let insert
  let insertSingle
  let channel

  beforeEach(() => {
    selectResults = []
    select = vi.fn(() => createQuery(selectResults.shift() || { data: [], error: null }))
    insertSingle = vi.fn()
    insert = vi.fn(() => ({
      select: vi.fn(() => ({ single: insertSingle })),
    }))
    const messageTable = { select, insert }

    mocks.from.mockImplementation((table) => {
      if (table === 'messages') return messageTable
      return { insert: vi.fn().mockResolvedValue({ error: null }) }
    })

    channel = {
      on: vi.fn(() => channel),
      subscribe: vi.fn(() => channel),
    }
    mocks.channel.mockReturnValue(channel)
    mocks.notifyNewMessage.mockResolvedValue(undefined)
  })

  it('loads room messages through the unambiguous sender foreign key', async () => {
    const message = { id: 'message-1', body: 'Hello' }
    selectResults.push({ data: [message], error: null })

    const { result } = renderHook(() =>
      useMessages({ workspaceId: 'workspace-1', roomId: 'room-1', roomName: 'General' })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(select).toHaveBeenCalledWith(SELECT_COLUMNS)
    const query = select.mock.results[0].value
    expect(query.eq).toHaveBeenCalledWith('room_id', 'room-1')
    expect(result.current.messages).toEqual([{ ...message, attachments: [] }])
    expect(result.current.error).toBeNull()
  })

  it('exposes Supabase read errors to the UI', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    selectResults.push({ data: null, error: { code: 'PGRST201', message: 'Ambiguous relationship' } })

    const { result } = renderHook(() =>
      useMessages({ workspaceId: 'workspace-1', roomId: 'room-1' })
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Ambiguous relationship')
    expect(result.current.messages).toEqual([])
  })

  it('inserts a message and refreshes it without depending on Realtime', async () => {
    const inserted = {
      id: 'message-2',
      workspace_id: 'workspace-1',
      room_id: 'room-1',
      dm_id: null,
      sender_id: 'user-1',
      body: 'Sent message',
      reply_to_id: null,
    }
    selectResults.push({ data: [], error: null }, { data: [inserted], error: null })
    insertSingle.mockResolvedValue({ data: inserted, error: null })

    const { result } = renderHook(() =>
      useMessages({ workspaceId: 'workspace-1', roomId: 'room-1', roomName: 'General' })
    )
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.sendMessage({ body: 'Sent message' })
    })

    expect(insert).toHaveBeenCalledWith({
      workspace_id: 'workspace-1',
      room_id: 'room-1',
      dm_id: null,
      sender_id: 'user-1',
      body: 'Sent message',
      reply_to_id: null,
    })
    expect(select).toHaveBeenCalledTimes(2)
    expect(result.current.messages).toEqual([{ ...inserted, attachments: [] }])
    expect(mocks.notifyNewMessage).toHaveBeenCalledWith(
      expect.objectContaining({ messageId: 'message-2', roomId: 'room-1', senderId: 'user-1', body: 'Sent message' })
    )
  })
})

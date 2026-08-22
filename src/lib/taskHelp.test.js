import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requestTaskHelp, respondToHelpRequest } from './taskHelp'

const mocks = vi.hoisted(() => ({ from: vi.fn(), createDm: vi.fn(), notify: vi.fn(), notifyMessage: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('./channels', () => ({ createDirectMessage: mocks.createDm }))
vi.mock('./notify', () => ({ notifyHelpRequest: mocks.notify, notifyNewMessage: mocks.notifyMessage }))

const resolved = (value = { error: null }) => ({ then: (resolve) => Promise.resolve(value).then(resolve) })

describe('task help workflow', () => {
  beforeEach(() => {
    mocks.createDm.mockResolvedValue({ data: { id: 'dm-1' }, error: null })
    mocks.notify.mockResolvedValue(undefined)
    mocks.notifyMessage.mockResolvedValue(undefined)
    mocks.from.mockImplementation((table) => {
      if (table === 'task_help_requests') {
        return {
          insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: 'request-1' }, error: null }) })) })),
          update: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => resolved()) , then: (resolve) => Promise.resolve({ error: null }).then(resolve) })) })),
        }
      }
      if (table === 'task_collaborators') return { upsert: vi.fn().mockResolvedValue({ error: null }) }
      if (table === 'messages') return { insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: 'message-1', body: 'Help message' }, error: null }) })) })) }
      return { insert: vi.fn().mockResolvedValue({ error: null }) }
    })
  })

  it('creates a help request, a DM, and a notification', async () => {
    const request = await requestTaskHelp({ workspaceId: 'workspace-1', task: { id: 'task-1', title: 'Launch' }, requester: { id: 'user-1', username: 'Jared' }, helperId: 'user-2' })
    expect(request).toMatchObject({ id: 'request-1', dm_id: 'dm-1' })
    expect(mocks.createDm).toHaveBeenCalledWith({ workspaceId: 'workspace-1', userIds: ['user-1', 'user-2'] })
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ helperId: 'user-2', requestId: 'request-1' }))
  })

  it('adds an accepting helper as a task collaborator', async () => {
    await respondToHelpRequest({ request: { id: 'request-1', task_id: 'task-1', helper_id: 'user-2', workspace_id: 'workspace-1', dm_id: 'dm-1', task: { title: 'Launch' } }, accepted: true, helperName: 'Angela' })
    expect(mocks.from).toHaveBeenCalledWith('task_collaborators')
    expect(mocks.from).toHaveBeenCalledWith('messages')
  })
})

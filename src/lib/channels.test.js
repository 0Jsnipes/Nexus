import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('./supabase', () => ({ supabase: { rpc: mocks.rpc } }))

import { createDirectMessage, createRoom } from './channels'

describe('atomic channel creation', () => {
  beforeEach(() => {
    mocks.rpc.mockResolvedValue({ data: { id: 'channel-1' }, error: null })
  })

  it('creates rooms through the secured atomic RPC', async () => {
    await createRoom({
      workspaceId: 'workspace-1',
      name: 'Marketing Ideas',
      topic: 'Campaign planning',
      isPrivate: true,
    })

    expect(mocks.rpc).toHaveBeenCalledWith('create_room', {
      _workspace_id: 'workspace-1',
      _name: 'Marketing Ideas',
      _topic: 'Campaign planning',
      _is_private: true,
    })
  })

  it('creates DMs through the secured atomic RPC', async () => {
    await createDirectMessage({
      workspaceId: 'workspace-1',
      userIds: ['user-1', 'user-2'],
      name: '',
    })

    expect(mocks.rpc).toHaveBeenCalledWith('create_dm', {
      _workspace_id: 'workspace-1',
      _user_ids: ['user-1', 'user-2'],
      _name: null,
    })
  })
})

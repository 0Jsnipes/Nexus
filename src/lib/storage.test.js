import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  upload: vi.fn(),
  getPublicUrl: vi.fn(),
  createSignedUrl: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabase: {
    storage: { from: mocks.from },
  },
}))

import { resolveStorageUrl, uploadFile } from './storage'

describe('secure storage routing', () => {
  beforeEach(() => {
    mocks.from.mockReturnValue({
      upload: mocks.upload,
      getPublicUrl: mocks.getPublicUrl,
      createSignedUrl: mocks.createSignedUrl,
    })
    mocks.upload.mockResolvedValue({ error: null })
    mocks.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example/avatar.png' } })
    mocks.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.example/file' }, error: null })
    vi.spyOn(Date, 'now').mockReturnValue(1234)
  })

  it('stores profile media in the public bucket', async () => {
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' })

    await expect(uploadFile('profile/user-1', file)).resolves.toBe('https://cdn.example/avatar.png')
    expect(mocks.from).toHaveBeenCalledWith('nexus-public')
    expect(mocks.upload).toHaveBeenCalledWith('profile/user-1/1234-avatar.png', file, {
      cacheControl: '3600',
      upsert: false,
    })
  })

  it('stores workspace files privately and persists only their object key', async () => {
    const file = new File(['secret'], 'plan.pdf', { type: 'application/pdf' })

    await expect(uploadFile('workspace-1/attachments', file)).resolves.toBe(
      'workspace-1/attachments/1234-plan.pdf'
    )
    expect(mocks.from).toHaveBeenCalledWith('nexus')
    expect(mocks.getPublicUrl).not.toHaveBeenCalled()
  })

  it('signs private object keys but leaves existing URLs unchanged', async () => {
    await expect(resolveStorageUrl('workspace-1/attachments/plan.pdf')).resolves.toBe(
      'https://signed.example/file'
    )
    expect(mocks.createSignedUrl).toHaveBeenCalledWith('workspace-1/attachments/plan.pdf', 3600)

    await expect(resolveStorageUrl('https://example.com/already-public.png')).resolves.toBe(
      'https://example.com/already-public.png'
    )
    expect(mocks.createSignedUrl).toHaveBeenCalledTimes(1)
  })
})

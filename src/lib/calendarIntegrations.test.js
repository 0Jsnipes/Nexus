import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createGoogleMeeting, getCalendarConnections } from './calendarIntegrations'

const mocks = vi.hoisted(() => ({ from: vi.fn(), invoke: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: { from: mocks.from, functions: { invoke: mocks.invoke } } }))

describe('calendar integrations', () => {
  beforeEach(() => {
    mocks.from.mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [{ provider: 'google', status: 'active' }], error: null }) })
    mocks.invoke.mockResolvedValue({ data: { eventId: 'event-1', joinUrl: 'https://meet.google.com/test' }, error: null })
  })

  it('loads the signed-in users calendar connections', async () => {
    await expect(getCalendarConnections()).resolves.toEqual([{ provider: 'google', status: 'active' }])
    expect(mocks.from).toHaveBeenCalledWith('calendar_connections')
  })

  it('creates a Google Calendar meeting through the secured edge function', async () => {
    const meeting = { id: 'meeting-1', title: 'Planning' }
    await expect(createGoogleMeeting({ meeting, attendeeEmails: ['team@example.com'] })).resolves.toMatchObject({ eventId: 'event-1' })
    expect(mocks.invoke).toHaveBeenCalledWith('google-calendar', { body: { action: 'create-meeting', meeting, attendeeEmails: ['team@example.com'] } })
  })
})

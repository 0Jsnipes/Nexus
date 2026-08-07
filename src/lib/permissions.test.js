import { describe, expect, it } from 'vitest'
import { hasPermission } from './permissions'

describe('hasPermission', () => {
  it('denies access when there is no membership', () => {
    expect(hasPermission(null, [], 'create_rooms')).toBe(false)
  })

  it('always allows workspace owners', () => {
    expect(hasPermission({ role: 'owner' }, [], 'manage_workspace_settings')).toBe(true)
  })

  it('honors custom member permissions', () => {
    const membership = { role: 'member', custom_permissions: ['create_rooms'] }

    expect(hasPermission(membership, [], 'create_rooms')).toBe(true)
  })

  it('uses permissions assigned to the member role', () => {
    const membership = { role: 'member', custom_permissions: [] }
    const rolePermissions = [{ role: 'member', permission: 'create_tasks' }]

    expect(hasPermission(membership, rolePermissions, 'create_tasks')).toBe(true)
    expect(hasPermission(membership, rolePermissions, 'manage_roles')).toBe(false)
  })
})

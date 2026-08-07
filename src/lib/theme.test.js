import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyTheme, getStoredTheme, watchSystemTheme } from './theme'

describe('theme helpers', () => {
  let mediaQuery

  beforeEach(() => {
    mediaQuery = {
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    window.matchMedia = vi.fn(() => mediaQuery)
  })

  it('persists and applies an explicit theme', () => {
    applyTheme('dark')

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(getStoredTheme()).toBe('dark')
  })

  it('resolves the system theme and reacts to preference changes', () => {
    applyTheme('system')
    const stopWatching = watchSystemTheme()
    const changeHandler = mediaQuery.addEventListener.mock.calls[0][1]

    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    mediaQuery.matches = false
    changeHandler()
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')

    stopWatching()
    expect(mediaQuery.removeEventListener).toHaveBeenCalledWith('change', changeHandler)
  })
})

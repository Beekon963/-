import { describe, expect, it } from 'vitest'
import { normalizeServerUrl } from './serverUrl'

describe('normalizeServerUrl', () => {
  it('keeps only the origin of a pasted Supabase URL', () => {
    expect(normalizeServerUrl('https://abcd.supabase.co')).toBe('https://abcd.supabase.co')
    expect(normalizeServerUrl(' https://abcd.supabase.co/ ')).toBe('https://abcd.supabase.co')
    expect(normalizeServerUrl('https://abcd.supabase.co/rest/v1/')).toBe('https://abcd.supabase.co')
    expect(normalizeServerUrl('abcd.supabase.co')).toBe('https://abcd.supabase.co')
  })
})

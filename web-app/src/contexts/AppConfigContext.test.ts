import { describe, expect, it } from 'vitest'
import { normalizeServerUrl } from './AppConfigContext.tsx'

describe('normalizeServerUrl', () => {
  it('drops trailing slashes and surrounding spaces', () => {
    expect(normalizeServerUrl('https://example.com/')).toBe('https://example.com')
    expect(normalizeServerUrl(' https://example.com// ')).toBe('https://example.com')
  })
  it('keeps a URL without a trailing slash as is', () => {
    expect(normalizeServerUrl('http://localhost:8787')).toBe('http://localhost:8787')
  })
})

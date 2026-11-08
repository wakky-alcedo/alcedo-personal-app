import { describe, it, expect } from 'vitest'
import { parseRuleExport } from './ruleExport.ts'

describe('parseRuleExport', () => {
  it('keeps valid rules and string colors', () => {
    const text = JSON.stringify({
      rules: [{ pattern: 'code', category: 'Dev', field: 'processName', priority: 2, id: 'x' }, { pattern: 1 }, null],
      categories: { Dev: '#123456', Bad: 7 },
    })
    expect(parseRuleExport(text)).toEqual({
      rules: [{ pattern: 'code', category: 'Dev', field: 'processName', priority: 2 }],
      categories: { Dev: '#123456' },
    })
  })

  it('treats missing sections as empty and rejects non-array rules', () => {
    expect(parseRuleExport('{}')).toEqual({ rules: [], categories: null })
    expect(() => parseRuleExport('{"rules":{}}')).toThrow('rules が配列ではありません')
    expect(() => parseRuleExport('not json')).toThrow()
  })
})

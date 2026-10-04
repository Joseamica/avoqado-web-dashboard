// src/pages/Settings/Billing/plan/__tests__/featureIcons.test.ts
import { Sparkles } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { FEATURE_ICON_IDS, featureIcon } from '../featureIcons'

describe('featureIcon', () => {
  it('every catalog id resolves to its own lucide component, aliases included', () => {
    expect(FEATURE_ICON_IDS).toHaveLength(41)
    // An import that resolved to undefined would silently fall back to Sparkles: only UPSELL_AI uses it on purpose.
    expect(FEATURE_ICON_IDS.filter(id => featureIcon(id) === Sparkles)).toEqual(['UPSELL_AI'])
  })

  it('an unknown id falls back to a neutral icon', () => {
    expect(featureIcon('NOT_IN_THE_CATALOG')).toBe(Sparkles)
  })
})

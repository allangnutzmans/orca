import { describe, expect, it } from 'vitest'
import { pluginPanelContributionSchema } from './plugin-panel-contribution'

const panel = { id: 'board', title: 'Board' }

describe('panel runtime', () => {
  it('defaults to a frame panel and leaves the field absent', () => {
    const parsed = pluginPanelContributionSchema.parse({ ...panel, entry: 'panel.html' })
    expect(parsed).toEqual({ ...panel, entry: 'panel.html' })
  })

  it.each(['dist/panel.js', 'panel.mjs', 'Panel.JS'])(
    'accepts a declarative %s module',
    (entry) => {
      expect(
        pluginPanelContributionSchema.safeParse({ ...panel, entry, runtime: 'declarative' }).success
      ).toBe(true)
    }
  )

  it.each(['panel.html', 'panel.tsx', 'panel.js.map'])(
    'refuses a declarative %s entry',
    (entry) => {
      const parsed = pluginPanelContributionSchema.safeParse({
        ...panel,
        entry,
        runtime: 'declarative'
      })
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues[0]).toMatchObject({ path: ['entry'] })
    }
  )

  it('refuses an unknown runtime', () => {
    expect(
      pluginPanelContributionSchema.safeParse({ ...panel, entry: 'panel.js', runtime: 'native' })
        .success
    ).toBe(false)
  })
})

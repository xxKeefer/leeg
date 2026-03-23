import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import App from './app.vue'

describe('app', () => {
  it('renders the placeholder page', async () => {
    const wrapper = await mountSuspended(App)
    expect(wrapper.text()).toContain('leeg')
    expect(wrapper.text()).toContain('Pokemon Showdown League Tracker')
  })
})

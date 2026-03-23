import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import App from './app.vue'

describe('app', () => {
  it('renders the nav with app name', async () => {
    const wrapper = await mountSuspended(App)
    expect(wrapper.text()).toContain('leeg')
  })

  it('has navigation links', async () => {
    const wrapper = await mountSuspended(App)
    expect(wrapper.text()).toContain('Trainers')
    expect(wrapper.text()).toContain('Seasons')
  })
})

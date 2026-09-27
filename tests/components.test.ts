import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import HeaderBar from '@/components/HeaderBar.vue'
import RecordButton from '@/components/RecordButton.vue'
import ResultCard from '@/components/ResultCard.vue'
import SettingsModal from '@/components/SettingsModal.vue'
import SavedModal from '@/components/SavedModal.vue'
import AudioVisualizer from '@/components/AudioVisualizer.vue'
import PipelineStepper from '@/components/PipelineStepper.vue'

describe('HeaderBar.vue', () => {
  it('renders saved records button and settings without mock/groq switcher', async () => {
    const wrapper = mount(HeaderBar, {
      props: {
        hasApiKey: false,
        savedCount: 3,
      },
    })

    // Mock and Groq switcher buttons are removed from header
    expect(wrapper.text()).not.toContain('Mock')
    expect(wrapper.text()).not.toContain('Groq')

    // Saved button is present with count badge
    expect(wrapper.text()).toContain('Збережені')
    expect(wrapper.text()).toContain('3')

    const savedBtn = wrapper.find('button[aria-label="Збережені записи"]')
    expect(savedBtn.exists()).toBe(true)

    await savedBtn.trigger('click')
    expect(wrapper.emitted('openSaved')).toHaveLength(1)
  })

  it('emits openSettings when settings button is clicked', async () => {
    const wrapper = mount(HeaderBar, {
      props: {
        hasApiKey: true,
      },
    })

    const settingsBtn = wrapper.find('button[aria-label="Налаштування API"]')
    await settingsBtn.trigger('click')
    expect(wrapper.emitted('openSettings')).toHaveLength(1)
  })
})

describe('SavedModal.vue', () => {
  const sampleItems = [
    {
      id: 'item-1',
      createdAt: 1727265000000,
      processedText: 'Перший збережений текст для тестування.',
      rawText: 'перший збережений текст',
      durationMs: 1200,
    },
    {
      id: 'item-2',
      createdAt: 1727266000000,
      processedText: 'Другий текст.',
      rawText: 'другий текст',
      durationMs: 800,
    },
  ]

  it('renders empty state when there are no saved items', () => {
    const wrapper = mount(SavedModal, {
      props: {
        isOpen: true,
        savedItems: [],
      },
    })

    expect(wrapper.text()).toContain('Немає збережених записів')
    expect(wrapper.text()).toContain('0')
  })

  it('renders saved items list and allows opening or deleting an item', async () => {
    const wrapper = mount(SavedModal, {
      props: {
        isOpen: true,
        savedItems: sampleItems,
      },
    })

    expect(wrapper.text()).toContain('Перший збережений текст для тестування.')
    expect(wrapper.text()).toContain('Другий текст.')
    expect(wrapper.text()).toContain('2')

    // Click "Відкрити" on the first item
    const openBtns = wrapper.findAll('button').filter((b) => b.text().includes('Відкрити'))
    expect(openBtns.length).toBe(2)

    await openBtns[0].trigger('click')
    expect(wrapper.emitted('openItem')?.[0]).toEqual([sampleItems[0]])
    expect(wrapper.emitted('close')).toHaveLength(1)

    // Click "Видалити" on the second item
    const deleteBtns = wrapper.findAll('button[aria-label="Видалити запис"]')
    expect(deleteBtns.length).toBe(2)

    await deleteBtns[1].trigger('click')
    expect(wrapper.emitted('deleteItem')?.[0]).toEqual(['item-2'])
  })

  it('emits close when close button is clicked', async () => {
    const wrapper = mount(SavedModal, {
      props: {
        isOpen: true,
        savedItems: sampleItems,
      },
    })

    const closeBtn = wrapper.find('button[aria-label="Закрити модальне вікно"]')
    await closeBtn.trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})

describe('RecordButton.vue', () => {
  it('renders idle state and emits start on click', async () => {
    const wrapper = mount(RecordButton, {
      props: {
        status: 'idle',
      },
    })

    expect(wrapper.text()).toContain('Натисніть для початку запису')
    const btn = wrapper.find('button')
    await btn.trigger('click')
    expect(wrapper.emitted('start')).toHaveLength(1)
  })

  it('renders recording state and emits stop on click', async () => {
    const wrapper = mount(RecordButton, {
      props: {
        status: 'recording',
      },
    })

    expect(wrapper.text()).toContain('Запис...')
    const btn = wrapper.find('button')
    await btn.trigger('click')
    expect(wrapper.emitted('stop')).toHaveLength(1)
  })

  it('disables button while transcribing or correcting', () => {
    const wrapper = mount(RecordButton, {
      props: {
        status: 'transcribing',
      },
    })

    const btn = wrapper.find('button')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Розпізнавання аудіо')
  })
})

describe('ResultCard.vue', () => {
  const sampleResult = {
    rawText: 'це сирий текст',
    processedText: 'Це відредагований текст.',
    durationMs: 850,
  }

  it('renders processed text and raw text in details', () => {
    const wrapper = mount(ResultCard, {
      props: {
        result: sampleResult,
      },
    })

    const textarea = wrapper.find('textarea')
    expect((textarea.element as HTMLTextAreaElement).value).toBe('Це відредагований текст.')
    expect(wrapper.text()).toMatch(/0\.[89] с/)
    expect(wrapper.text()).toContain('це сирий текст')
  })

  it('emits update:processedText when user edits textarea', async () => {
    const wrapper = mount(ResultCard, {
      props: {
        result: sampleResult,
      },
    })

    const textarea = wrapper.find('textarea')
    await textarea.setValue('Новий відредагований вручну текст')

    expect(wrapper.emitted('update:processedText')?.[0]).toEqual([
      'Новий відредагований вручну текст',
    ])
  })

  it('renders save button and emits save event', async () => {
    const wrapper = mount(ResultCard, {
      props: {
        result: sampleResult,
        isSaved: false,
      },
    })

    const saveBtn = wrapper.find('button[aria-label="Зберегти результат"]')
    expect(saveBtn.exists()).toBe(true)
    expect(saveBtn.text()).toContain('Зберегти')

    await saveBtn.trigger('click')
    expect(wrapper.emitted('save')).toHaveLength(1)
  })

  it('shows saved state when isSaved is true', () => {
    const wrapper = mount(ResultCard, {
      props: {
        result: sampleResult,
        isSaved: true,
      },
    })

    const savedBtn = wrapper.find('button[aria-label="Запис збережено"]')
    expect(savedBtn.exists()).toBe(true)
    expect(savedBtn.text()).toContain('Збережено')
  })
})

describe('SettingsModal.vue', () => {
  it('renders modal when isOpen is true and allows saving key', async () => {
    const wrapper = mount(SettingsModal, {
      props: {
        isOpen: true,
        initialApiKey: 'gsk_existing_key',
      },
    })

    const input = wrapper.find('input')
    expect((input.element as HTMLInputElement).value).toBe('gsk_existing_key')

    await input.setValue('gsk_updated_key')
    const saveBtn = wrapper.findAll('button').find((b) => b.text().includes('Зберегти'))
    await saveBtn?.trigger('click')

    expect(wrapper.emitted('save')?.[0]).toEqual(['gsk_updated_key'])
  })

  it('shows deferred guidance when isDeferred is true', () => {
    const wrapper = mount(SettingsModal, {
      props: {
        isOpen: true,
        initialApiKey: '',
        isDeferred: true,
      },
    })

    expect(wrapper.text()).toContain('Аудіо вже записано!')
    expect(wrapper.text()).toContain('Продовжити обробку')
  })

  it('applies independent provider changes only after saving', async () => {
    const wrapper = mount(SettingsModal, {
      props: {
        isOpen: true,
        initialApiKey: '',
        transcriptionMode: 'browser',
        correctionMode: 'local',
      },
    })

    const groqWhisperBtn = wrapper.findAll('button').find((b) => b.text().includes('Groq Whisper'))
    expect(groqWhisperBtn).toBeDefined()
    await groqWhisperBtn?.trigger('click')
    expect(wrapper.emitted('update:transcriptionMode')).toBeUndefined()

    const groqAiBtn = wrapper.findAll('button').find((b) => b.text().includes('Groq AI'))
    expect(groqAiBtn).toBeDefined()
    await groqAiBtn?.trigger('click')
    expect(wrapper.emitted('update:correctionMode')).toBeUndefined()

    const saveBtn = wrapper.findAll('button').find((b) => b.text().includes('Зберегти'))
    await saveBtn?.trigger('click')
    expect(wrapper.emitted('update:transcriptionMode')?.[0]).toEqual(['groq'])
    expect(wrapper.emitted('update:correctionMode')?.[0]).toEqual(['groq'])
  })

  it('discards provider changes when cancelled', async () => {
    const wrapper = mount(SettingsModal, {
      props: {
        isOpen: true,
        initialApiKey: '',
        transcriptionMode: 'browser',
        correctionMode: 'local',
      },
    })

    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Groq Whisper'))
      ?.trigger('click')
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Скасувати'))
      ?.trigger('click')

    expect(wrapper.emitted('update:transcriptionMode')).toBeUndefined()
    expect(wrapper.emitted('update:correctionMode')).toBeUndefined()
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})

describe('AudioVisualizer.vue', () => {
  it('renders idle state with microphone ready badge and prompt hint', () => {
    const wrapper = mount(AudioVisualizer, {
      props: {
        analyserNode: null,
        isRecording: false,
      },
    })

    expect(wrapper.text()).toContain('Мікрофон готовий')
    expect(wrapper.text()).toContain('Готово до запису')
    expect(wrapper.find('canvas').exists()).toBe(true)
  })

  it('renders live recording state with live indicator and VU meter', () => {
    const wrapper = mount(AudioVisualizer, {
      props: {
        analyserNode: null,
        isRecording: true,
      },
    })

    expect(wrapper.text()).toContain('LIVE')
    expect(wrapper.find('[aria-label="Шкала рівня звуку"]').exists()).toBe(true)
  })
})

describe('PipelineStepper.vue', () => {
  it('renders all steps in idle state', () => {
    const wrapper = mount(PipelineStepper, {
      props: {
        status: 'idle',
      },
    })

    expect(wrapper.text()).toContain('Запис')
    expect(wrapper.text()).toContain('Розпізнавання')
    expect(wrapper.text()).toContain('Редагування')
    expect(wrapper.text()).toContain('Готово')
  })

  it('marks recording as active and updates styling', () => {
    const wrapper = mount(PipelineStepper, {
      props: {
        status: 'recording',
      },
    })

    const recordingItem = wrapper
      .findAll('.flex.items-center.gap-1\\.5')
      .find((el) => el.text().includes('Запис'))
    expect(recordingItem?.classes()).toContain('text-orange-400')
  })

  it('marks completed state with checkmarks for all steps', () => {
    const wrapper = mount(PipelineStepper, {
      props: {
        status: 'completed',
      },
    })

    const items = wrapper.findAll('.flex.items-center.gap-1\\.5')
    items.forEach((item) => {
      expect(item.classes()).toContain('text-emerald-400')
    })
  })
})

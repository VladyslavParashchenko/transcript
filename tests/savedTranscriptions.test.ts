import { describe, it, expect, beforeEach } from 'vitest'
import { useSavedTranscriptions } from '@/composables/useSavedTranscriptions'

describe('useSavedTranscriptions Composable', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('initializes with empty saved transcriptions when localStorage is clean', () => {
    const { savedTranscriptions } = useSavedTranscriptions()
    expect(savedTranscriptions.value).toEqual([])
  })

  it('saves new transcription and persists to localStorage', () => {
    const { savedTranscriptions, saveTranscription, isSaved } = useSavedTranscriptions()

    const saved = saveTranscription({
      rawText: 'сирий голос',
      processedText: 'Відредагований голос.',
      durationMs: 1500,
    })

    expect(saved.id).toBeDefined()
    expect(saved.processedText).toBe('Відредагований голос.')
    expect(savedTranscriptions.value.length).toBe(1)
    expect(isSaved(saved.id)).toBe(true)

    const stored = JSON.parse(localStorage.getItem('transcript_saved_transcriptions') || '[]')
    expect(stored.length).toBe(1)
    expect(stored[0].id).toBe(saved.id)
  })

  it('updates existing transcription when id is provided', () => {
    const { savedTranscriptions, saveTranscription } = useSavedTranscriptions()

    const initial = saveTranscription({
      rawText: 'сирий текст',
      processedText: 'Початковий текст.',
      durationMs: 1000,
    })

    const updated = saveTranscription({
      id: initial.id,
      rawText: 'сирий текст',
      processedText: 'Оновлений текст після редагування.',
      durationMs: 1000,
    })

    expect(updated.id).toBe(initial.id)
    expect(savedTranscriptions.value.length).toBe(1)
    expect(savedTranscriptions.value[0].processedText).toBe('Оновлений текст після редагування.')
  })

  it('deletes transcription by id', () => {
    const { savedTranscriptions, saveTranscription, deleteTranscription, isSaved } =
      useSavedTranscriptions()

    const item1 = saveTranscription({
      rawText: 'текст 1',
      processedText: 'Текст 1.',
      durationMs: 500,
    })
    const item2 = saveTranscription({
      rawText: 'текст 2',
      processedText: 'Текст 2.',
      durationMs: 800,
    })

    expect(savedTranscriptions.value.length).toBe(2)

    deleteTranscription(item1.id)
    expect(savedTranscriptions.value.length).toBe(1)
    expect(isSaved(item1.id)).toBe(false)
    expect(isSaved(item2.id)).toBe(true)
  })

  it('clears all saved transcriptions', () => {
    const { savedTranscriptions, saveTranscription, clearAllSaved } = useSavedTranscriptions()

    saveTranscription({ rawText: 'a', processedText: 'A.', durationMs: 100 })
    saveTranscription({ rawText: 'b', processedText: 'B.', durationMs: 200 })
    expect(savedTranscriptions.value.length).toBe(2)

    clearAllSaved()
    expect(savedTranscriptions.value.length).toBe(0)
    expect(JSON.parse(localStorage.getItem('transcript_saved_transcriptions') || '[]')).toEqual([])
  })
})

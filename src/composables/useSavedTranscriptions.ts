import { ref, type Ref } from 'vue'
import type { SavedTranscription } from '@/types/transcription'

const SAVED_ITEMS_STORAGE = 'transcript_saved_transcriptions'

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `rec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}

function generateTitle(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return 'Запис без назви'
  const firstLine = trimmed.split('\n')[0]
  return firstLine.length > 50 ? `${firstLine.slice(0, 47)}...` : firstLine
}

function loadFromStorage(): SavedTranscription[] {
  try {
    const raw = localStorage.getItem(SAVED_ITEMS_STORAGE)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed
    }
    return []
  } catch (err) {
    console.error('Failed to load saved transcriptions:', err)
    return []
  }
}

function saveToStorage(items: SavedTranscription[]): void {
  try {
    localStorage.setItem(SAVED_ITEMS_STORAGE, JSON.stringify(items))
  } catch (err) {
    console.error('Failed to save transcriptions to localStorage:', err)
  }
}

export interface UseSavedTranscriptionsReturn {
  savedTranscriptions: Ref<SavedTranscription[]>
  saveTranscription: (item: {
    id?: string
    processedText: string
    rawText: string
    durationMs: number
    title?: string
  }) => SavedTranscription
  deleteTranscription: (id: string) => void
  clearAllSaved: () => void
  isSaved: (id?: string) => boolean
  formatDate: (timestamp: number) => string
}

export function useSavedTranscriptions(): UseSavedTranscriptionsReturn {
  const savedTranscriptions = ref<SavedTranscription[]>(loadFromStorage())

  function saveTranscription(item: {
    id?: string
    processedText: string
    rawText: string
    durationMs: number
    title?: string
  }): SavedTranscription {
    if (item.id) {
      const existingIndex = savedTranscriptions.value.findIndex((s) => s.id === item.id)
      if (existingIndex !== -1) {
        const existing = savedTranscriptions.value[existingIndex]
        const updated: SavedTranscription = {
          ...existing,
          processedText: item.processedText,
          rawText: item.rawText,
          durationMs: item.durationMs,
          title: item.title || generateTitle(item.processedText),
        }
        savedTranscriptions.value[existingIndex] = updated
        saveToStorage(savedTranscriptions.value)
        return updated
      }
    }

    const newItem: SavedTranscription = {
      id: item.id || generateId(),
      createdAt: Date.now(),
      processedText: item.processedText,
      rawText: item.rawText,
      durationMs: item.durationMs,
      title: item.title || generateTitle(item.processedText),
    }

    savedTranscriptions.value.unshift(newItem)
    saveToStorage(savedTranscriptions.value)
    return newItem
  }

  function deleteTranscription(id: string): void {
    savedTranscriptions.value = savedTranscriptions.value.filter((s) => s.id !== id)
    saveToStorage(savedTranscriptions.value)
  }

  function clearAllSaved(): void {
    savedTranscriptions.value = []
    saveToStorage([])
  }

  function isSaved(id?: string): boolean {
    if (!id) return false
    return savedTranscriptions.value.some((s) => s.id === id)
  }

  function formatDate(timestamp: number): string {
    try {
      const date = new Date(timestamp)
      return new Intl.DateTimeFormat('uk-UA', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date)
    } catch {
      return ''
    }
  }

  return {
    savedTranscriptions,
    saveTranscription,
    deleteTranscription,
    clearAllSaved,
    isSaved,
    formatDate,
  }
}

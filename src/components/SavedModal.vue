<script setup lang="ts">
import { ref } from 'vue'
import type { SavedTranscription } from '@/types/transcription'
import { Bookmark, X, FolderOpen, Copy, Check, Trash2, Clock, FileText } from 'lucide-vue-next'

defineProps<{
  isOpen: boolean
  savedItems: SavedTranscription[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'openItem', item: SavedTranscription): void
  (e: 'deleteItem', id: string): void
  (e: 'clearAll'): void
}>()

const copiedId = ref<string | null>(null)
let copyTimeoutId: number | null = null

function formatDate(timestamp: number): string {
  try {
    const date = new Date(timestamp)
    return new Intl.DateTimeFormat('uk-UA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  } catch {
    return ''
  }
}

function getWordCount(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

async function copyItemText(item: SavedTranscription) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(item.processedText)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = item.processedText
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }

    copiedId.value = item.id
    if (copyTimeoutId !== null) clearTimeout(copyTimeoutId)
    copyTimeoutId = window.setTimeout(() => {
      copiedId.value = null
      copyTimeoutId = null
    }, 2000)
  } catch (err) {
    console.error('Failed to copy saved item:', err)
  }
}

function handleClose() {
  emit('close')
}

function handleOpen(item: SavedTranscription) {
  emit('openItem', item)
  emit('close')
}

function handleDelete(id: string) {
  emit('deleteItem', id)
}

function handleClearAll() {
  if (window.confirm('Видалити всі збережені записи?')) {
    emit('clearAll')
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm transition-opacity"
    role="dialog"
    aria-modal="true"
    aria-labelledby="saved-modal-title"
    @keydown.esc="handleClose"
  >
    <!-- Modal Card -->
    <div
      class="animate-in fade-in zoom-in-95 relative flex max-h-[85vh] w-full max-w-xl flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl duration-150"
      @click.stop
    >
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-slate-800/80 pb-4 pr-10">
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10 text-orange-400"
          >
            <Bookmark class="h-5 w-5" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 id="saved-modal-title" class="text-lg font-bold text-slate-100">
                Збережені записи
              </h2>
              <span
                class="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold text-orange-400"
              >
                {{ savedItems.length }}
              </span>
            </div>
            <p class="text-xs text-slate-400">Історія розпізнаних та відредагованих текстів</p>
          </div>
        </div>

        <button
          v-if="savedItems.length > 0"
          type="button"
          class="flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/40"
          title="Очистити всі збережені"
          @click="handleClearAll"
        >
          <Trash2 class="h-3.5 w-3.5" />
          <span class="hidden sm:inline">Очистити все</span>
        </button>
      </div>

      <!-- Close button -->
      <button
        type="button"
        class="absolute right-4 top-4 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
        aria-label="Закрити модальне вікно"
        @click="handleClose"
      >
        <X class="h-5 w-5" />
      </button>

      <!-- Empty State -->
      <div
        v-if="savedItems.length === 0"
        class="flex flex-col items-center justify-center py-12 text-center"
      >
        <div
          class="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-slate-800 bg-slate-950/60 text-slate-600"
        >
          <Bookmark class="h-7 w-7" />
        </div>
        <p class="text-sm font-semibold text-slate-300">Немає збережених записів</p>
        <p class="mt-1 max-w-xs text-xs text-slate-500">
          Запишіть аудіо, і після розпізнавання ви зможете переглянути, відкрити чи скопіювати текст
          тут.
        </p>
      </div>

      <!-- Items List -->
      <div
        v-else
        class="flex-1 space-y-3 overflow-y-auto pr-1"
        style="max-height: calc(85vh - 150px)"
      >
        <div
          v-for="item in savedItems"
          :key="item.id"
          class="group flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 transition-all hover:border-slate-700 hover:bg-slate-950/90"
        >
          <!-- Item Header: date and duration badges -->
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-slate-400">
              {{ formatDate(item.createdAt) }}
            </span>
            <div class="flex items-center gap-2">
              <span
                class="flex items-center gap-1 rounded-md bg-slate-850 px-2 py-0.5 text-[11px] text-slate-400"
                title="Тривалість аудіо"
              >
                <Clock class="h-3 w-3 text-slate-500" />
                {{ (item.durationMs / 1000).toFixed(1) }} с
              </span>
              <span
                class="flex items-center gap-1 rounded-md bg-slate-850 px-2 py-0.5 text-[11px] text-slate-400"
                title="Кількість слів"
              >
                <FileText class="h-3 w-3 text-slate-500" />
                {{ getWordCount(item.processedText) }} слів
              </span>
            </div>
          </div>

          <!-- Item Text Preview -->
          <p class="line-clamp-3 text-sm leading-relaxed text-slate-200">
            {{ item.processedText }}
          </p>

          <!-- Item Actions -->
          <div class="flex items-center justify-between border-t border-slate-850 pt-3">
            <div class="flex items-center gap-2">
              <!-- Open button -->
              <button
                type="button"
                class="flex min-h-[36px] items-center gap-1.5 rounded-xl border border-orange-500/20 bg-orange-500/10 px-3.5 py-1.5 text-xs font-semibold text-orange-400 transition-all hover:bg-orange-500/20 hover:text-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                @click="handleOpen(item)"
              >
                <FolderOpen class="h-3.5 w-3.5" />
                <span>Відкрити</span>
              </button>

              <!-- Copy button -->
              <button
                type="button"
                class="flex min-h-[36px] items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition-all hover:border-slate-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                @click="copyItemText(item)"
              >
                <Check v-if="copiedId === item.id" class="h-3.5 w-3.5 text-emerald-400" />
                <Copy v-else class="h-3.5 w-3.5 text-slate-400" />
                <span>{{ copiedId === item.id ? 'Скопійовано!' : 'Копіювати' }}</span>
              </button>
            </div>

            <!-- Delete button -->
            <button
              type="button"
              class="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-xl p-1.5 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/50"
              title="Видалити цей запис"
              aria-label="Видалити запис"
              @click="handleDelete(item.id)"
            >
              <Trash2 class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

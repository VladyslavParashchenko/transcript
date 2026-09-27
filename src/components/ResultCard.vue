<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import type { TranscriptionResult } from '@/types/transcription'
import {
  Copy,
  Check,
  ChevronDown,
  Clock,
  FileText,
  Sparkles,
  Trash2,
  Bookmark,
  BookmarkCheck,
} from 'lucide-vue-next'

const props = defineProps<{
  result: TranscriptionResult
  isSaved?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:processedText', text: string): void
  (e: 'clear'): void
  (e: 'save'): void
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const isCopied = ref(false)
let copyTimeoutId: number | null = null

// Adjust textarea height dynamically to fit content
function autoGrow() {
  nextTick(() => {
    const el = textareaRef.value
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${Math.max(100, el.scrollHeight)}px`
    }
  })
}

watch(
  () => props.result.processedText,
  () => {
    autoGrow()
  }
)

onMounted(() => {
  autoGrow()
})

async function copyToClipboard() {
  if (!props.result.processedText) return

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(props.result.processedText)
    } else {
      // Fallback for older browsers/contexts
      const textarea = document.createElement('textarea')
      textarea.value = props.result.processedText
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }

    isCopied.value = true
    if (copyTimeoutId !== null) clearTimeout(copyTimeoutId)
    copyTimeoutId = window.setTimeout(() => {
      isCopied.value = false
      copyTimeoutId = null
    }, 2000)
  } catch (err) {
    console.error('Failed to copy to clipboard:', err)
  }
}

function handleInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  emit('update:processedText', target.value)
  autoGrow()
}

const wordCount = computed(() => {
  const text = props.result.processedText.trim()
  if (!text) return 0
  return text.split(/\s+/).length
})

const charCount = computed(() => {
  return props.result.processedText.length
})

const formattedDuration = computed(() => {
  const sec = (props.result.durationMs / 1000).toFixed(1)
  return `${sec} с`
})
</script>

<template>
  <div
    class="flex min-h-64 w-full flex-col overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/60 shadow-2xl backdrop-blur-sm transition-all sm:min-h-72 md:min-h-72"
  >
    <!-- Header: Label and Actions -->
    <div
      class="flex items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-850/80 px-4 py-3"
    >
      <div class="flex items-center gap-2">
        <Sparkles class="h-4 w-4 text-orange-400" />
        <span class="text-xs font-bold uppercase tracking-wider text-slate-300">
          Відредагований результат
        </span>
      </div>

      <div class="flex items-center gap-1.5">
        <!-- Save Button -->
        <button
          type="button"
          class="flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          :class="[
            isSaved
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-orange-500/20 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 hover:text-orange-300',
          ]"
          :aria-label="isSaved ? 'Запис збережено' : 'Зберегти результат'"
          @click="emit('save')"
        >
          <BookmarkCheck v-if="isSaved" class="h-4 w-4 text-emerald-400" />
          <Bookmark v-else class="h-4 w-4" />
          <span>{{ isSaved ? 'Збережено' : 'Зберегти' }}</span>
        </button>

        <!-- Copy Button with 48px touch target -->
        <button
          type="button"
          class="flex min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          :class="[
            isCopied
              ? 'bg-emerald-600/90 text-white shadow-sm shadow-emerald-600/30'
              : 'border border-orange-500/20 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 hover:text-orange-300',
          ]"
          aria-label="Копіювати результат"
          @click="copyToClipboard"
        >
          <Check v-if="isCopied" class="h-4 w-4" />
          <Copy v-else class="h-4 w-4" />
          <span>{{ isCopied ? 'Скопійовано!' : 'Копіювати' }}</span>
        </button>

        <!-- Clear Button -->
        <button
          type="button"
          class="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-800/80 hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/50"
          title="Очистити результат"
          aria-label="Очистити результат"
          @click="emit('clear')"
        >
          <Trash2 class="h-4 w-4" />
        </button>
      </div>
    </div>

    <!-- Main Content: Auto-growing editable textarea -->
    <div class="flex flex-1 flex-col p-4">
      <label for="processed-text-output" class="sr-only">Відредагований текст</label>
      <textarea
        id="processed-text-output"
        ref="textareaRef"
        :value="result.processedText"
        rows="4"
        class="w-full resize-none rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-base font-normal leading-relaxed text-slate-100 placeholder-slate-500 transition-colors focus:border-orange-500/40 focus:outline-none focus:ring-2 focus:ring-orange-500/50 sm:text-lg"
        placeholder="Тут з’явиться відредагований текст..."
        @input="handleInput"
      />

      <!-- Metrics Bar -->
      <div class="mt-3 flex flex-wrap items-center gap-4 px-1 text-xs text-slate-400">
        <div class="flex items-center gap-1.5" title="Час обробки">
          <Clock class="h-3.5 w-3.5 text-slate-500" />
          <span>{{ formattedDuration }}</span>
        </div>
        <div class="flex items-center gap-1.5" title="Кількість слів">
          <FileText class="h-3.5 w-3.5 text-slate-500" />
          <span>{{ wordCount }} слів</span>
        </div>
        <div class="text-slate-500">
          <span>{{ charCount }} симв.</span>
        </div>
      </div>
    </div>

    <!-- Pre-correction raw text collapsible diff view -->
    <div class="border-t border-slate-800/80 bg-slate-950/40">
      <details class="group">
        <summary
          class="flex cursor-pointer select-none items-center justify-between px-4 py-3 text-xs font-semibold text-slate-400 transition-colors hover:text-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500/40"
        >
          <span class="flex items-center gap-2">
            <span>Сирий розпізнаний текст (до виправлення)</span>
          </span>
          <ChevronDown
            class="h-4 w-4 text-slate-500 transition-transform duration-200 group-open:rotate-180"
          />
        </summary>
        <div class="px-4 pb-4 pt-1">
          <div
            class="select-text whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-400 sm:text-sm"
          >
            {{ result.rawText }}
          </div>
        </div>
      </details>
    </div>
  </div>
</template>

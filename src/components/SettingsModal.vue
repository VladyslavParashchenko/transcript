<script setup lang="ts">
import { ref, watch } from 'vue'
import type { TranscriptionMode, CorrectionMode, ServiceMode } from '@/types/transcription'
import {
  Eye,
  EyeOff,
  X,
  ExternalLink,
  Check,
  Sparkles,
  Globe,
  FileText,
  Sliders,
  Settings,
} from 'lucide-vue-next'

const props = defineProps<{
  isOpen: boolean
  initialApiKey: string
  isDeferred?: boolean
  transcriptionMode?: TranscriptionMode
  correctionMode?: CorrectionMode
  serviceMode?: ServiceMode
}>()

const emit = defineEmits<{
  (e: 'save', key: string): void
  (e: 'cancel'): void
  (e: 'update:transcriptionMode', mode: TranscriptionMode): void
  (e: 'update:correctionMode', mode: CorrectionMode): void
  (e: 'update:serviceMode', mode: ServiceMode): void
}>()

const inputKey = ref('')
const isVisible = ref(false)
const showSavedBadge = ref(false)
const draftTranscriptionMode = ref<TranscriptionMode>('browser')
const draftCorrectionMode = ref<CorrectionMode>('local')

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      inputKey.value = props.initialApiKey || ''
      isVisible.value = false
      showSavedBadge.value = false
      draftTranscriptionMode.value = props.transcriptionMode || 'browser'
      draftCorrectionMode.value = props.correctionMode || 'local'
    }
  },
  { immediate: true }
)

function handleSave() {
  emit('update:transcriptionMode', draftTranscriptionMode.value)
  emit('update:correctionMode', draftCorrectionMode.value)
  emit('save', inputKey.value)
  showSavedBadge.value = true
}

function handleClose() {
  emit('cancel')
}

function handleClear() {
  inputKey.value = ''
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm transition-opacity"
    role="dialog"
    aria-modal="true"
    aria-labelledby="settings-modal-title"
    @keydown.esc="handleClose"
  >
    <!-- Modal Card -->
    <div
      class="animate-in fade-in zoom-in-95 relative flex w-full max-w-md flex-col gap-5 rounded-3xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl duration-150"
      @click.stop
    >
      <!-- Close button -->
      <button
        type="button"
        class="absolute right-4 top-4 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
        aria-label="Закрити модальне вікно"
        @click="handleClose"
      >
        <X class="h-5 w-5" />
      </button>

      <!-- Header -->
      <div class="flex items-center gap-3 pr-8">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10 text-orange-400"
        >
          <Settings class="h-5 w-5" />
        </div>
        <div>
          <h2 id="settings-modal-title" class="text-lg font-bold text-slate-100">Налаштування</h2>
          <p v-if="isDeferred" class="text-xs text-orange-400">
            Аудіо вже записано! Оберіть сервіси або введіть ключ для завершення обробки.
          </p>
        </div>
      </div>

      <!-- Section 1: Transcription Service (Speech-to-Text) -->
      <div class="space-y-2">
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Розпізнавання мови
        </label>
        <div class="grid grid-cols-2 gap-2">
          <!-- Browser Web Speech API -->
          <button
            type="button"
            class="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            :class="[
              draftTranscriptionMode === 'browser'
                ? 'border-orange-500/60 bg-orange-500/15 font-semibold text-orange-300 ring-1 ring-orange-500/30'
                : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200',
            ]"
            @click="draftTranscriptionMode = 'browser'"
          >
            <Globe class="h-4 w-4 shrink-0 text-orange-400" />
            <span>Браузер</span>
          </button>

          <!-- Groq Whisper -->
          <button
            type="button"
            class="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            :class="[
              draftTranscriptionMode === 'groq'
                ? 'border-orange-500/60 bg-orange-500/15 font-semibold text-orange-300 ring-1 ring-orange-500/30'
                : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200',
            ]"
            @click="draftTranscriptionMode = 'groq'"
          >
            <Sparkles class="h-4 w-4 shrink-0 text-orange-400" />
            <span>Groq Whisper</span>
          </button>
        </div>
      </div>

      <!-- Section 2: Text Correction / Editing -->
      <div class="space-y-2">
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Редагування тексту
        </label>
        <div class="grid grid-cols-3 gap-2">
          <!-- Groq AI (Llama) -->
          <button
            type="button"
            class="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2.5 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            :class="[
              draftCorrectionMode === 'groq'
                ? 'border-orange-500/60 bg-orange-500/15 font-semibold text-orange-300 ring-1 ring-orange-500/30'
                : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200',
            ]"
            @click="draftCorrectionMode = 'groq'"
          >
            <Sparkles class="h-3.5 w-3.5 shrink-0 text-orange-400" />
            <span>Groq AI</span>
          </button>

          <!-- Local Basic Formatting -->
          <button
            type="button"
            class="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2.5 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            :class="[
              draftCorrectionMode === 'local'
                ? 'border-orange-500/60 bg-orange-500/15 font-semibold text-orange-300 ring-1 ring-orange-500/30'
                : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200',
            ]"
            @click="draftCorrectionMode = 'local'"
          >
            <FileText class="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span>Базове</span>
          </button>

          <!-- Raw / No corrections -->
          <button
            type="button"
            class="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2.5 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            :class="[
              draftCorrectionMode === 'none'
                ? 'border-orange-500/60 bg-orange-500/15 font-semibold text-orange-300 ring-1 ring-orange-500/30'
                : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200',
            ]"
            @click="draftCorrectionMode = 'none'"
          >
            <Sliders class="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>Без змін</span>
          </button>
        </div>
      </div>

      <!-- Section 3: Groq API Key Input -->
      <div class="space-y-2 pt-1">
        <div class="flex items-center justify-between">
          <label for="groq-api-key-input" class="block text-xs font-semibold text-slate-300">
            Groq API Key
          </label>
          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-[11px] font-medium text-orange-400 transition-colors hover:text-orange-300"
          >
            <span>Отримати ключ</span>
            <ExternalLink class="h-3 w-3" />
          </a>
        </div>

        <div class="relative flex items-center">
          <input
            id="groq-api-key-input"
            v-model="inputKey"
            :type="isVisible ? 'text' : 'password'"
            autocomplete="off"
            spellcheck="false"
            placeholder="gsk_..."
            class="min-h-[44px] w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-3.5 pr-20 font-mono text-sm text-slate-100 placeholder-slate-600 transition-colors focus:border-orange-500/40 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            @keydown.enter.prevent="handleSave"
          />
          <div class="absolute right-1.5 flex items-center gap-1">
            <button
              v-if="inputKey"
              type="button"
              class="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg p-1.5 text-slate-500 transition-colors hover:text-slate-300"
              title="Очистити"
              aria-label="Очистити поле ключа"
              @click="handleClear"
            >
              <X class="h-4 w-4" />
            </button>
            <button
              type="button"
              class="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              :aria-label="isVisible ? 'Приховати ключ' : 'Показати ключ'"
              @click="isVisible = !isVisible"
            >
              <EyeOff v-if="isVisible" class="h-4 w-4" />
              <Eye v-else class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          class="min-h-[44px] rounded-xl border border-slate-800 px-5 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-700"
          @click="handleClose"
        >
          Скасувати
        </button>

        <button
          type="button"
          class="flex min-h-[44px] items-center gap-2 rounded-xl bg-orange-500 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition-all hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
          @click="handleSave"
        >
          <Check v-if="showSavedBadge" class="h-4 w-4" />
          <span>{{ isDeferred ? 'Продовжити обробку' : 'Зберегти' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

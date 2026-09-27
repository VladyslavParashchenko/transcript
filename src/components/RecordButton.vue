<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue'
import type { PipelineStatus } from '@/types/transcription'
import { Mic, Square, Loader2, Sparkles, RotateCcw } from 'lucide-vue-next'

const props = defineProps<{
  status: PipelineStatus
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'start'): void
  (e: 'stop'): void
  (e: 'reset'): void
}>()

// Timer state while recording
const recordSeconds = ref(0)
let timerId: number | null = null

watch(
  () => props.status,
  (newStatus) => {
    if (newStatus === 'recording') {
      recordSeconds.value = 0
      if (timerId !== null) clearInterval(timerId)
      timerId = window.setInterval(() => {
        recordSeconds.value++
      }, 1000)
    } else {
      if (timerId !== null) {
        clearInterval(timerId)
        timerId = null
      }
    }
  }
)

onUnmounted(() => {
  if (timerId !== null) {
    clearInterval(timerId)
    timerId = null
  }
})

const formattedTime = computed(() => {
  const mins = Math.floor(recordSeconds.value / 60)
  const secs = recordSeconds.value % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
})

function handleClick() {
  if (props.disabled) return

  if (props.status === 'idle') {
    emit('start')
  } else if (props.status === 'recording') {
    emit('stop')
  } else if (props.status === 'completed' || props.status === 'error') {
    emit('start')
  }
}
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-4 py-4">
    <!-- Outer button wrapper with animated pulse ring while recording -->
    <div class="relative flex items-center justify-center">
      <!-- Pulsing ripple effect during recording -->
      <span
        v-if="status === 'recording'"
        class="absolute -inset-4 animate-ping rounded-full bg-orange-500/25 duration-1000 sm:-inset-6"
      />
      <span
        v-if="status === 'recording'"
        class="absolute -inset-8 animate-pulse rounded-full bg-orange-500/15 duration-700 sm:-inset-12"
      />

      <!-- Main Trigger Button -->
      <button
        type="button"
        :disabled="disabled || status === 'transcribing' || status === 'correcting'"
        class="relative z-10 flex h-28 w-28 transform select-none flex-col items-center justify-center rounded-full shadow-2xl transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-orange-500/40 active:scale-95 sm:h-36 sm:w-36"
        :class="[
          status === 'idle'
            ? 'bg-gradient-to-tr from-orange-600 to-orange-500 text-white shadow-orange-500/30 hover:scale-105 hover:from-orange-500 hover:to-orange-400'
            : '',
          status === 'recording'
            ? 'bg-red-500 text-white shadow-red-500/40 ring-8 ring-red-500/20 hover:bg-red-600'
            : '',
          status === 'transcribing' || status === 'correcting'
            ? 'cursor-wait border-2 border-orange-500/50 bg-slate-900 text-orange-400 shadow-orange-500/10'
            : '',
          status === 'completed'
            ? 'hover:bg-slate-750 border-2 border-slate-700 bg-slate-800 text-slate-200 shadow-slate-900/50 hover:scale-105 hover:border-orange-500/50'
            : '',
          status === 'error'
            ? 'border-2 border-red-500/50 bg-slate-800 text-red-300 hover:bg-slate-700'
            : '',
        ]"
        :aria-label="status === 'recording' ? 'Зупинити запис' : 'Почати запис'"
        @click="handleClick"
      >
        <!-- Idle Icon -->
        <Mic v-if="status === 'idle'" class="h-12 w-12 transition-transform sm:h-16 sm:w-16" />

        <!-- Recording Stop Icon -->
        <div v-else-if="status === 'recording'" class="flex flex-col items-center justify-center">
          <Square class="h-10 w-10 fill-current transition-transform sm:h-14 sm:w-14" />
        </div>

        <!-- Processing Spinners -->
        <Loader2
          v-else-if="status === 'transcribing'"
          class="h-12 w-12 animate-spin text-orange-400 sm:h-16 sm:w-16"
        />
        <Sparkles
          v-else-if="status === 'correcting'"
          class="h-12 w-12 animate-pulse text-orange-400 sm:h-16 sm:w-16"
        />

        <!-- Completed / Record Again Icon -->
        <div
          v-else-if="status === 'completed'"
          class="flex flex-col items-center justify-center gap-1"
        >
          <Mic class="h-10 w-10 text-orange-400 sm:h-14 sm:w-14" />
        </div>

        <!-- Error Retry Icon -->
        <RotateCcw v-else-if="status === 'error'" class="h-10 w-10 text-red-400 sm:h-14 sm:w-14" />
      </button>
    </div>

    <!-- Status Text & Subtitle Guidance -->
    <div class="flex min-h-[48px] flex-col items-center justify-center text-center">
      <div v-if="status === 'idle'" class="text-base font-semibold text-slate-200 sm:text-lg">
        Натисніть для початку запису
      </div>
      <div
        v-else-if="status === 'recording'"
        class="flex items-center gap-2.5 text-base font-bold text-red-400 sm:text-lg"
      >
        <span class="inline-block h-3 w-3 animate-ping rounded-full bg-red-500" />
        <span>Запис... {{ formattedTime }}</span>
      </div>
      <div
        v-else-if="status === 'transcribing'"
        class="flex items-center gap-2.5 text-base font-semibold text-orange-400 sm:text-lg"
      >
        <Loader2 class="h-5 w-5 animate-spin" />
        <span>Розпізнавання аудіо...</span>
      </div>
      <div
        v-else-if="status === 'correcting'"
        class="flex items-center gap-2.5 text-base font-semibold text-orange-400 sm:text-lg"
      >
        <Sparkles class="h-5 w-5 animate-bounce" />
        <span>AI-редагування тексту...</span>
      </div>
      <div v-else-if="status === 'completed'" class="text-base font-medium text-slate-300">
        Готово! Натисніть, щоб записати нову нотатку
      </div>
      <div v-else-if="status === 'error'" class="text-base font-medium text-red-400">
        Сталася помилка. Натисніть для повтору
      </div>

      <p class="mt-1 text-xs text-slate-500 sm:text-sm">
        <template v-if="status === 'recording'"
          >Натисніть ще раз, щоб завершити та обробити</template
        >
        <template v-else-if="status === 'idle'">Говоріть природно українською мовою</template>
        <template v-else-if="status === 'transcribing'">Конвертація мови в текст</template>
        <template v-else-if="status === 'correcting'">Виправлення пунктуації та структури</template>
      </p>
    </div>
  </div>
</template>

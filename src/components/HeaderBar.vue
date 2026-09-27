<script setup lang="ts">
import type { ServiceMode, TranscriptionMode, CorrectionMode } from '@/types/transcription'
import { Settings, Bookmark } from 'lucide-vue-next'

defineProps<{
  hasApiKey: boolean
  savedCount?: number
  serviceMode?: ServiceMode
  transcriptionMode?: TranscriptionMode
  correctionMode?: CorrectionMode
}>()

const emit = defineEmits<{
  (e: 'openSaved'): void
  (e: 'openSettings'): void
  (e: 'update:serviceMode', mode: ServiceMode): void
}>()
</script>

<template>
  <header class="sticky top-0 z-30 w-full px-4 py-3 sm:px-6">
    <div class="mx-auto flex max-w-2xl items-center justify-end gap-2.5">
      <!-- Saved Recordings Button -->
      <button
        type="button"
        class="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-xs font-medium text-slate-300 backdrop-blur-md transition-colors hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
        title="Збережені записи"
        aria-label="Збережені записи"
        @click="emit('openSaved')"
      >
        <Bookmark class="h-4 w-4 text-orange-400" />
        <span class="font-medium">Збережені</span>
        <span
          v-if="savedCount !== undefined && savedCount > 0"
          class="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500/20 px-1.5 text-[11px] font-bold text-orange-400"
        >
          {{ savedCount }}
        </span>
      </button>

      <!-- Settings Button with 44px touch target -->
      <button
        type="button"
        class="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 p-2.5 text-slate-300 backdrop-blur-md transition-colors hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
        title="Налаштування API"
        aria-label="Налаштування API"
        @click="emit('openSettings')"
      >
        <Settings class="h-5 w-5" />
        <!-- Key indicator dot -->
        <span
          class="absolute right-2 top-2 h-2 w-2 rounded-full"
          :class="[
            hasApiKey
              ? 'bg-emerald-400'
              : serviceMode === 'groq' || transcriptionMode === 'groq' || correctionMode === 'groq'
                ? 'bg-amber-400 ring-2 ring-slate-900'
                : 'bg-slate-600',
          ]"
        />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTranscription } from '@/composables/useTranscription'
import { useSavedTranscriptions } from '@/composables/useSavedTranscriptions'
import HeaderBar from '@/components/HeaderBar.vue'
import PipelineStepper from '@/components/PipelineStepper.vue'
import AudioVisualizer from '@/components/AudioVisualizer.vue'
import RecordButton from '@/components/RecordButton.vue'
import ResultCard from '@/components/ResultCard.vue'
import SettingsModal from '@/components/SettingsModal.vue'
import SavedModal from '@/components/SavedModal.vue'
import type { SavedTranscription } from '@/types/transcription'
import { AlertCircle, X } from 'lucide-vue-next'

const {
  status,
  serviceMode,
  transcriptionMode,
  correctionMode,
  apiKey,
  result,
  errorMessage,
  isSettingsModalOpen,
  recorder,
  startRecording,
  stopRecording,
  setServiceMode,
  setTranscriptionMode,
  setCorrectionMode,
  submitApiKey,
  cancelApiKeyPrompt,
  openSettings,
  clearError,
  resetPipeline,
  updateProcessedText,
  loadSavedTranscription,
} = useTranscription()

const { savedTranscriptions, saveTranscription, deleteTranscription, clearAllSaved } =
  useSavedTranscriptions()

const isSavedModalOpen = ref(false)
const hasApiKey = computed(() => Boolean(apiKey.value && apiKey.value.trim()))

// Check if current result is saved and matches saved content
const isCurrentResultSaved = computed(() => {
  if (!result.value || !result.value.id) return false
  const matching = savedTranscriptions.value.find((s) => s.id === result.value?.id)
  if (!matching) return false
  return matching.processedText === result.value.processedText
})

function handleSaveResult() {
  if (!result.value) return
  const saved = saveTranscription({
    id: result.value.id,
    rawText: result.value.rawText,
    processedText: result.value.processedText,
    durationMs: result.value.durationMs,
  })
  result.value.id = saved.id
}

function handleOpenSavedItem(item: SavedTranscription) {
  loadSavedTranscription(item)
}
</script>

<template>
  <div
    class="flex min-h-screen flex-col bg-slate-950 text-slate-100 selection:bg-orange-500/30 selection:text-orange-200"
  >
    <!-- Header with top-right settings & saved items -->
    <HeaderBar
      :service-mode="serviceMode"
      :transcription-mode="transcriptionMode"
      :correction-mode="correctionMode"
      :has-api-key="hasApiKey"
      :saved-count="savedTranscriptions.length"
      @update:service-mode="setServiceMode"
      @open-settings="openSettings"
      @open-saved="isSavedModalOpen = true"
    />

    <!-- Main Container filling viewport -->
    <main class="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-4 sm:py-8">
      <!-- Error Alert Banner -->
      <div
        v-if="errorMessage"
        class="animate-in fade-in slide-in-from-top-2 relative mb-6 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300 duration-200"
        role="alert"
      >
        <AlertCircle class="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
        <div class="flex-1 pr-6 text-sm leading-relaxed">
          <p class="font-semibold text-red-200">Помилка обробки</p>
          <p class="mt-0.5 text-xs text-red-300/90">{{ errorMessage }}</p>
        </div>
        <button
          type="button"
          class="absolute right-3 top-3 flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-500/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-400"
          aria-label="Закрити повідомлення про помилку"
          @click="clearError"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <!-- Pipeline Progress Stepper (Always visible to keep layout fixed and prevent shifts) -->
      <div class="mb-6 flex w-full justify-center">
        <PipelineStepper :status="status" />
      </div>

      <!-- Result View (When result is available and completed) -->
      <section
        v-if="result && status === 'completed'"
        aria-label="Результат транскрипції"
        class="animate-in fade-in flex w-full flex-1 flex-col items-center justify-center gap-6 py-4 duration-300 sm:gap-8 sm:py-8"
      >
        <div class="flex flex-col items-center justify-center">
          <RecordButton
            :status="status"
            @start="startRecording"
            @stop="stopRecording"
            @reset="resetPipeline"
          />
        </div>

        <div class="w-full">
          <ResultCard
            :result="result"
            :is-saved="isCurrentResultSaved"
            @update:processed-text="updateProcessedText"
            @save="handleSaveResult"
            @clear="resetPipeline"
          />
        </div>
      </section>

      <!-- Main Microphone Interface (Occupies almost the whole screen) -->
      <section
        v-else
        class="flex w-full flex-1 flex-col items-center justify-center gap-6 py-4 sm:gap-8 sm:py-8"
        aria-label="Інтерфейс мікрофона"
      >
        <!-- Microphone Trigger Button -->
        <div class="flex flex-col items-center justify-center">
          <RecordButton
            :status="status"
            @start="startRecording"
            @stop="stopRecording"
            @reset="resetPipeline"
          />
        </div>

        <!-- Audio Visualizer (Recognition quality details) -->
        <div class="w-full">
          <AudioVisualizer
            :analyser-node="recorder.analyserNode.value"
            :is-recording="recorder.isRecording.value"
          />
        </div>
      </section>
    </main>

    <!-- Saved Recordings Modal -->
    <SavedModal
      :is-open="isSavedModalOpen"
      :saved-items="savedTranscriptions"
      @close="isSavedModalOpen = false"
      @open-item="handleOpenSavedItem"
      @delete-item="deleteTranscription"
      @clear-all="clearAllSaved"
    />

    <!-- Settings Modal -->
    <SettingsModal
      :is-open="isSettingsModalOpen"
      :initial-api-key="apiKey"
      :transcription-mode="transcriptionMode"
      :correction-mode="correctionMode"
      :service-mode="serviceMode"
      :is-deferred="status === 'recording' || status === 'transcribing'"
      @save="submitApiKey"
      @cancel="cancelApiKeyPrompt"
      @update:transcription-mode="setTranscriptionMode"
      @update:correction-mode="setCorrectionMode"
      @update:service-mode="setServiceMode"
    />
  </div>
</template>

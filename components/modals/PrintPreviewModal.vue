<script setup lang="ts">
import type { GameSchedule, PrintOptions } from '~/types';
import { generatePDFFromElement } from '~/utils/pdfGenerator';
import { generatePDFFromHTML } from '~/utils/simplePdfGenerator';

// Props
interface Props {
  open: boolean;
  schedule: GameSchedule | null;
  printOptions: PrintOptions;
}

// Emits
interface Emits {
  (e: 'update:open', value: boolean): void;
  (e: 'update:print-options', value: PrintOptions): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Stores
const printStore = usePrintStore();
const playerStore = usePlayerStore();
const toast = useToast();

// Local state
const previewGenerated = ref(false);
const printPreviewRef = ref<HTMLElement>();
const generatedPreviewHTML = ref<string>('');

// Local copy of print options that can be modified
const localPrintOptions = ref<PrintOptions>({ ...props.printOptions });

// Update local copy when modal opens
watch(
  () => props.open,
  isOpen => {
    if (isOpen) {
      localPrintOptions.value = { ...props.printOptions };
    }
  }
);

// Emit changes when local options change
watch(
  localPrintOptions,
  newOptions => {
    emit('update:print-options', { ...newOptions });
  },
  { deep: true }
);

// Computed
const isOpen = computed({
  get: () => {
    return props.open;
  },
  set: (value: boolean) => {
    emit('update:open', value);
  }
});

// Methods
async function generatePreview(): Promise<void> {
  if (!props.schedule) {
    return;
  }

  try {
    // Generate HTML using the print store
    generatedPreviewHTML.value = printStore.generatePrintHTML(
      props.schedule as GameSchedule,
      localPrintOptions.value,
      playerStore
    );

    previewGenerated.value = true;

    // Scroll to preview after DOM update
    await nextTick();
    if (printPreviewRef.value) {
      printPreviewRef.value.scrollIntoView({ behavior: 'smooth' });
    }
  } catch (error) {
    console.error('Error generating preview:', error);
  }
}

async function print(): Promise<void> {
  if (!props.schedule) {
    return;
  }
  try {
    // Cast readonly types to mutable types for compatibility
    const schedule = props.schedule as GameSchedule;
    await printStore.printSchedule(schedule, localPrintOptions.value, playerStore);
  } catch (error) {
    console.error('Error printing schedule:', error);
  }
}

async function downloadPdf(): Promise<void> {
  if (!props.schedule) {
    return;
  }

  // Check if we're on the client side
  if (typeof window === 'undefined') {
    toast.add({
      title: 'PDF Generation Not Available',
      description: 'PDF generation is only available in the browser.',
      color: 'error'
    });
    return;
  }

  try {
    // Show loading toast
    toast.add({
      title: 'Generating PDF...',
      description: 'Please wait while we create your PDF document.',
      color: 'primary'
    });

    // Generate preview first if not already generated
    if (!previewGenerated.value) {
      await generatePreview();
    }

    // Wait for preview to fully render and DOM to update
    await nextTick();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if the preview element exists and has content
    const previewElement = document.getElementById('print-preview-element');
    if (!previewElement) {
      throw new Error('Print preview element not found');
    }

    // Check if element has content
    if (!previewElement.innerHTML || previewElement.innerHTML.trim() === '') {
      throw new Error('Print preview element is empty');
    }

    // Make sure element is visible and has proper dimensions
    const rect = previewElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      throw new Error('Print preview element has no dimensions');
    }

    // Generate filename based on event details
    const eventTitle = localPrintOptions.value.eventTitle || 'pickleball-schedule';
    const eventDate = localPrintOptions.value.eventDate || new Date().toISOString().split('T')[0];
    const filename = `${eventTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${eventDate}.pdf`;

    // Try the new simple PDF generator first
    try {
      await generatePDFFromHTML(generatedPreviewHTML.value, {
        orientation: localPrintOptions.value.orientation,
        filename: filename
      });

      // Close loading toast and show success toast
      toast.clear();
      toast.add({
        title: 'PDF Generated Successfully',
        description: `Your schedule has been downloaded as ${filename}`,
        color: 'success'
      });
      return;
    } catch (simpleError) {
      console.error('Simple PDF generator failed, trying advanced method:', simpleError);
    }

    // Fallback to original method
    await generatePDFFromElement('print-preview-element', {
      orientation: localPrintOptions.value.orientation,
      filename: filename,
      quality: 1.0,
      scale: 1.5,
      backgroundColor: '#ffffff'
    });

    // Close loading toast and show success toast
    toast.clear();
    toast.add({
      title: 'PDF Generated Successfully',
      description: `Your schedule has been downloaded as ${filename}`,
      color: 'success'
    });
  } catch (error) {
    console.error('Error generating PDF:', error);

    // Close loading toast and show error toast
    toast.clear();
    toast.add({
      title: 'PDF Generation Failed',
      description: `There was an error creating your PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
      color: 'error'
    });
  }
}

// Auto-generate preview when modal opens
watch(isOpen, async newValue => {
  if (newValue && props.schedule && !previewGenerated.value) {
    await generatePreview();
  }
});

// Auto-update preview when print options change
watch(
  localPrintOptions,
  async () => {
    if (isOpen.value && props.schedule && previewGenerated.value) {
      await generatePreview();
    }
  },
  { deep: true }
);
</script>

<template>
  <UModal
    v-model:open="isOpen"
    title="Print Configuration & Preview"
    class="print-preview-modal"
    :ui="{
      wrapper: 'w-full max-w-[95vw] h-full max-h-[95vh]',
      content: 'w-full h-full max-w-none'
    }"
  >
    <template #body>
      <div class="flex gap-6 h-full min-h-[80vh]">
        <!-- Configuration Panel (Left Side) -->
        <div class="w-80 flex-shrink-0 space-y-6 overflow-y-auto pr-4 border-r border-gray-200">
          <!-- Header Configuration -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold text-gray-900">Event Information</h3>
            <UFormField label="Event Name">
              <UInput
                v-model="localPrintOptions.eventTitle"
                placeholder="Pickleball League"
                class="form-input w-full"
              />
            </UFormField>

            <UFormField label="Event Date">
              <UInput v-model="localPrintOptions.eventDate" type="date" class="form-input w-full" />
            </UFormField>

            <UFormField label="Location">
              <UInput v-model="localPrintOptions.location" placeholder="Community Center" class="form-input w-full" />
            </UFormField>

            <UFormField label="Organizer">
              <UInput
                v-model="localPrintOptions.organizer"
                placeholder="League Coordinator"
                class="form-input w-full"
              />
            </UFormField>
          </div>

          <!-- Print Options -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold text-gray-900">Print Options</h3>

            <UFormField label="Configuration">
              <div
                id="configuration-container"
                class="space-y-4 bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl"
              >
                <!-- Layout and Display Options -->
                <div class="space-y-3">
                  <div class="flex items-center space-x-3">
                    <input
                      id="compact-layout-checkbox"
                      v-model="localPrintOptions.compactLayout"
                      type="checkbox"
                      class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label for="compact-layout-checkbox" class="text-sm text-blue-800 cursor-pointer">
                      Compact Layout
                    </label>
                  </div>
                  <div class="flex items-center space-x-3">
                    <input
                      id="color-mode-checkbox"
                      v-model="localPrintOptions.colorMode"
                      type="checkbox"
                      class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label for="color-mode-checkbox" class="text-sm text-blue-800 cursor-pointer">
                      Color Mode (uncheck for black & white printers)
                    </label>
                  </div>
                  <div class="flex items-center space-x-3">
                    <input
                      id="show-ratings-checkbox"
                      v-model="localPrintOptions.showRatings"
                      type="checkbox"
                      class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label for="show-ratings-checkbox" class="text-sm text-blue-800 cursor-pointer">
                      Show Player Skill Ratings
                    </label>
                  </div>
                </div>
              </div>
            </UFormField>
          </div>

          <!-- Action Buttons -->
          <div class="space-y-3 pt-4 border-t border-gray-200">
            <UButton class="btn-primary w-full" @click="print">
              <Icon name="mdi:printer" class="mr-2" />
              Print
            </UButton>
            <ClientOnly>
              <UButton class="btn-primary w-full" @click="downloadPdf">
                <Icon name="mdi:file-pdf-box" class="mr-2" />
                Download PDF
              </UButton>
            </ClientOnly>
            <UButton variant="ghost" class="btn-secondary w-full" @click="isOpen = false"> Cancel </UButton>
          </div>
        </div>

        <!-- Print Preview Panel (Right Side) -->
        <div class="flex-1 flex flex-col min-h-0 min-w-0">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900">Print Preview</h3>
            <div class="text-sm text-gray-600">
              {{ localPrintOptions.compactLayout ? 'Compact' : 'Standard' }} Layout
            </div>
          </div>
          <!-- Preview Container with Paper-like appearance -->
          <div class="flex-1 overflow-auto bg-gray-100 p-4 rounded-lg min-h-[600px] flex justify-center items-start">
            <!-- eslint-disable vue/no-v-html -->
            <div
              v-if="previewGenerated && schedule && generatedPreviewHTML"
              id="print-preview-element"
              ref="printPreviewRef"
              class="bg-white shadow-lg print-preview-container min-w-[8.5in] min-h-[11in] w-full max-w-[11in]"
              v-html="generatedPreviewHTML"
            ></div>
            <!-- eslint-enable vue/no-v-html -->

            <div v-else class="flex items-center justify-center h-full min-h-[400px]">
              <div class="text-center text-gray-500">
                <Icon name="mdi:file-document-outline" class="text-6xl mb-4 mx-auto" />
                <p class="text-lg">Click "Generate Preview" to show print preview</p>
                <p class="text-sm mt-2">Preview will show actual print dimensions scaled to fit</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
/* Modal isolation and dark mode styling */
.print-preview-modal :deep(.modal-header) {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-bottom: 2px solid var(--paddle-teal);
}

.print-preview-modal :deep(.dark .modal-header) {
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%) !important;
  border-bottom: 2px solid rgba(58, 182, 187, 0.3) !important;
}

.print-preview-modal :deep(.modal-content) {
  background: white;
  border: 1px solid #e5e7eb;
}

.print-preview-modal :deep(.dark .modal-content) {
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%) !important;
  border: 2px solid rgba(58, 182, 187, 0.4) !important;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6) !important;
}

.print-preview-modal :deep(.modal-overlay) {
  background: rgba(0, 0, 0, 0.6);
}

.print-preview-modal :deep(.dark .modal-overlay) {
  background: rgba(15, 23, 42, 0.9) !important;
  backdrop-filter: blur(12px) !important;
}

/* Override modal title color in dark mode */
.print-preview-modal :deep(.dark h1) {
  color: #f1f5f9 !important;
}

/* Ensure preview container uses app fonts */
:deep(.print-preview-container) {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
}

/* Print Preview Styles */
.print-page-portrait {
  width: 8.5in;
  height: 11in;
  transform: scale(1.1);
  transform-origin: top center;
  margin: 0;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  border: 1px solid #e5e7eb;
}

.print-page-landscape {
  width: 11in;
  height: 8.5in;
  transform: scale(0.9);
  transform-origin: top center;
  margin: 0;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  border: 1px solid #e5e7eb;
}

.print-preview-container {
  width: 100%;
  min-width: 8.5in;
  height: auto;
  min-height: 11in;
  padding: 0.75in;
  box-sizing: border-box;
  overflow: visible;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 12pt;
  line-height: 1.4;
  color: #000;
  background: white;
}

/* Ensure the preview looks like actual print output */
.print-preview-container :deep(.print-preview-safe) {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 12pt;
  line-height: 1.4;
  color: #000;
  background: transparent;
  padding: 0;
  min-height: auto;
}

.print-preview-container :deep(.header h1) {
  font-size: 20pt;
  margin-bottom: 12pt;
}

.print-preview-container :deep(.section h2) {
  font-size: 16pt;
  margin: 12pt 0 8pt 0;
}

.print-preview-container :deep(.games-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 8pt;
  margin-bottom: 12pt;
}

.print-preview-container :deep(.game-card) {
  border: 1pt solid #333;
  padding: 8pt;
  border-radius: 3pt;
  background-color: #fafafa;
  break-inside: avoid;
}

.print-preview-container :deep(.stats-table) {
  font-size: 10pt;
}

.print-preview-container :deep(.player-list) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 4pt;
  margin-bottom: 12pt;
}

.print-preview-container :deep(.player-item) {
  font-size: 10pt;
  padding: 2pt 4pt;
}

/* Compact layout adjustments */
.print-preview-container.compact :deep(.section) {
  margin-bottom: 16pt;
}

.print-preview-container.compact :deep(.games-grid) {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 6pt;
}

.print-preview-container.compact :deep(.game-card) {
  padding: 6pt;
}

.print-preview-container.compact :deep(.header h1) {
  font-size: 18pt;
  margin-bottom: 10pt;
}

.print-preview-container.compact :deep(.section h2) {
  font-size: 14pt;
  margin: 10pt 0 6pt 0;
}

/* Improve placeholder visibility in dark mode */
:deep(.dark input::placeholder) {
  color: rgb(156 163 175 / 0.8); /* lighter gray in dark mode */
  opacity: 1;
}

:deep(.dark input:not(:placeholder-shown)) {
  color: rgb(255 255 255 / 0.9); /* slightly lighter text when filled */
}
</style>

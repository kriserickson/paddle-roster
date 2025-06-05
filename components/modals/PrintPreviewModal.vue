<script setup lang="ts">
import type { Game, GameSchedule, PrintOptions } from '~/types';
import { generatePDFFromElement } from '~/utils/pdfGenerator';

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
const toast = useToast();

// Local state
const previewGenerated = ref(false);
const printPreviewRef = ref<HTMLElement>();
const generatedPreviewHTML = ref<string>('');

// Computed
const isOpen = computed({
  get: () => {
    console.log('PrintPreviewModal isOpen getter:', props.open);
    return props.open;
  },
  set: (value: boolean) => {
    console.log('PrintPreviewModal isOpen setter:', value);
    emit('update:open', value);
  }
});

const localPrintOptions = computed({
  get: () => props.printOptions,
  set: (value: PrintOptions) => emit('update:print-options', value)
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
      localPrintOptions.value
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
    await printStore.printSchedule(schedule, localPrintOptions.value);
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
    const loadingToast = toast.add({
      title: 'Generating PDF...',
      description: 'Please wait while we create your PDF document.',
      color: 'primary'
    });

    // Generate preview first if not already generated
    if (!previewGenerated.value) {
      await generatePreview();
      // Wait for preview to fully render
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Generate filename based on event details
    const eventTitle = localPrintOptions.value.eventTitle || 'pickleball-schedule';
    const eventDate = localPrintOptions.value.eventDate || new Date().toISOString().split('T')[0];
    const filename = `${eventTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${eventDate}.pdf`;

    // Generate PDF from the preview element
    await generatePDFFromElement('print-preview-element', {
      orientation: localPrintOptions.value.orientation,
      filename: filename,
      quality: 0.95,
      scale: 2,
      backgroundColor: '#ffffff'
    });

    // Show success toast
    toast.add({
      title: 'PDF Generated Successfully',
      description: `Your schedule has been downloaded as ${filename}`,
      color: 'success'
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    
    // Show error toast
    toast.add({
      title: 'PDF Generation Failed',
      description: 'There was an error creating your PDF. Please try again.',
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
              <UInput v-model="localPrintOptions.eventTitle" placeholder="Pickleball League" class="form-input w-full" />
            </UFormField>

            <UFormField label="Event Date">
              <UInput v-model="localPrintOptions.eventDate" type="date" class="form-input w-full" />
            </UFormField>

            <UFormField label="Location">
              <UInput v-model="localPrintOptions.location" placeholder="Community Center" class="form-input w-full" />
            </UFormField>

            <UFormField label="Organizer">
              <UInput v-model="localPrintOptions.organizer" placeholder="League Coordinator" class="form-input w-full" />
            </UFormField>
          </div>

          <!-- Print Options -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold text-gray-900">Print Options</h3>

            <UFormField label="Configuration">
              <div class="space-y-4 bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl">
                
                <!-- Layout and Display Options -->
                <div class="space-y-3">
                  <UCheckbox
                    v-model="localPrintOptions.compactLayout"
                    label="Compact Layout"
                    class="text-blue-800"
                  />
                  <UCheckbox
                    v-model="localPrintOptions.colorMode"
                    label="Color Mode (uncheck for black & white printers)"
                    class="text-blue-800"
                  />
                  <UCheckbox
                    v-model="localPrintOptions.showRatings"
                    label="Show Player Skill Ratings"
                    class="text-blue-800"
                  />
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
            <UButton variant="ghost" class="btn-secondary w-full" @click="isOpen = false"> 
              Cancel 
            </UButton>
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
            <div
              v-if="previewGenerated && schedule && generatedPreviewHTML"
              id="print-preview-element"
              ref="printPreviewRef"
              class="bg-white shadow-lg print-preview-container"              
              v-html="generatedPreviewHTML"
            ></div>

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
  height: 100%;
  padding: 0.75in;
  box-sizing: border-box;
  overflow: hidden;
}

/* Ensure the preview looks like actual print output */
.print-preview-container :deep(.print-preview-safe) {
  font-family: 'Times New Roman', serif;
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
</style>

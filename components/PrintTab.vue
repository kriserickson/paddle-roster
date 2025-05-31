<script setup lang="ts">
import type { GameSchedule, PrintOptions } from '~/types';

const printStore = usePrintStore();
const gameSchedule = useState<GameSchedule | null>('gameSchedule', () => null);

// Print configuration
const printOptions = ref<PrintOptions>({
  eventTitle: 'Pickleball League',
  eventSubtitle: new Date().toLocaleDateString(),
  eventDate: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
  location: '',
  organizer: '',
  includePlayerList: true,
  includeStats: true,
  includeRestPeriods: true,
  includeCourtAssignments: true,
  orientation: 'landscape',
  compactLayout: false
});

// Preview state
const previewGenerated = ref(false);
const printPreviewRef = ref<HTMLElement>();

/**
 * Generate print preview
 */
async function generatePreview(): Promise<void> {
  if (!gameSchedule.value) {
    return;
  }

  try {
    previewGenerated.value = true;
    
    // Scroll to preview
    await nextTick();
    if (printPreviewRef.value) {
      printPreviewRef.value.scrollIntoView({ behavior: 'smooth' });
    }
  } catch (error) {
    console.error('Error generating preview:', error);
  }
}

/**
 * Print the schedule
 */
async function print(): Promise<void> {
  if (!gameSchedule.value) {
    return;
  }
  try {
    await printStore.printSchedule(gameSchedule.value, printOptions.value);
  } catch (error) {
    console.error('Error printing schedule:', error);
  }
}

/**
 * Download as PDF (browser print dialog)
 */
async function downloadPdf(): Promise<void> {
  if (!gameSchedule.value) {
    return;
  }

  // Generate preview first if not already generated
  if (!previewGenerated.value) {
    await generatePreview();
  }
  
  // Open print dialog which allows saving as PDF
  await print();
}

/**
 * Export as HTML file
 */
function exportHtml(): void {
  if (!gameSchedule.value || !previewGenerated.value) {
    return;
  }
  // Generate HTML for export
  const htmlContent = printStore.generatePrintHTML(gameSchedule.value, printOptions.value);
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pickleball-schedule-${printOptions.value.eventSubtitle || 'schedule'}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Auto-update preview when options change
watch(printOptions, () => {
  if (previewGenerated.value && gameSchedule.value) {
    generatePreview();
  }
}, { deep: true });

// Watch for schedule changes
watch(gameSchedule, (newSchedule) => {
  if (newSchedule && previewGenerated.value) {
    generatePreview();
  }
});
</script>

<template>
  <div class="space-y-6">
    <!-- Print Configuration -->
    <div class="content-card">
      <div class="content-card-header">
        <div class="flex items-center gap-3">
          <Icon name="mdi:printer" class="text-paddle-teal text-3xl" />
          <h3 class="text-2xl font-bold text-gray-900">Print Configuration</h3>
        </div>
      </div>

      <div class="p-6 space-y-6">
        <!-- Header Configuration -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <UFormField label="Event Name">
            <UInput
              v-model="printOptions.eventTitle"
              placeholder="Pickleball League"
              class="form-input"
            />
          </UFormField>

          <UFormField label="Event Date">
            <UInput
              v-model="printOptions.eventDate"
              type="date"
              class="form-input"
            />
          </UFormField>

          <UFormField label="Location">
            <UInput
              v-model="printOptions.location"
              placeholder="Community Center"
              class="form-input"
            />
          </UFormField>

          <UFormField label="Organizer">
            <UInput
              v-model="printOptions.organizer"
              placeholder="League Coordinator"
              class="form-input"
            />
          </UFormField>
        </div>

        <!-- Print Options -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <UFormField label="Include Options">
            <div class="space-y-3 bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl">
              <UCheckbox
                v-model="printOptions.includePlayerList"
                label="Player List"
                class="text-blue-800"
              />
              <UCheckbox
                v-model="printOptions.includeStats"
                label="Game Statistics"
                class="text-blue-800"
              />
              <UCheckbox
                v-model="printOptions.includeRestPeriods"
                label="Rest Period Information"
                class="text-blue-800"
              />
              <UCheckbox
                v-model="printOptions.includeCourtAssignments"
                label="Court Assignments"
                class="text-blue-800"
              />
            </div>
          </UFormField>

          <UFormField label="Layout Options">
            <div class="space-y-3 bg-gradient-to-br from-paddle-teal/10 to-paddle-teal/20 p-4 rounded-xl">
              <URadioGroup
                v-model="printOptions.orientation"
                :options="[
                  { value: 'portrait', label: 'Portrait' },
                  { value: 'landscape', label: 'Landscape' }
                ]"
                class="text-paddle-teal-dark"
              />
              <UCheckbox
                v-model="printOptions.compactLayout"
                label="Compact Layout"
                class="text-paddle-teal-dark"
              />
            </div>
          </UFormField>
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-wrap gap-4 pt-6 border-t-2 border-paddle-teal/20">
          <UButton
            :disabled="!gameSchedule"
            icon="i-heroicons-eye"
            @click="generatePreview"
            class="btn-primary"
            size="lg"
          >
            <Icon name="mdi:eye" class="mr-2" />
            Generate Preview
          </UButton>

          <UButton
            :disabled="!gameSchedule"
            icon="i-heroicons-printer"
            @click="print"
            class="btn-secondary"
          >
            <Icon name="mdi:printer" class="mr-2" />
            Print
          </UButton>

          <UButton
            :disabled="!gameSchedule"
            icon="i-heroicons-document-arrow-down"
            @click="downloadPdf"
            class="btn-secondary"
          >
            <Icon name="mdi:file-pdf-box" class="mr-2" />
            Download PDF
          </UButton>

          <UButton
            :disabled="!gameSchedule || !previewGenerated"
            icon="i-heroicons-code-bracket"
            @click="exportHtml"
            class="btn-secondary"
          >
            <Icon name="mdi:code-tags" class="mr-2" />
            Export HTML
          </UButton>
        </div>
      </div>
    </div>

    <!-- No Schedule Message -->
    <UCard v-if="!gameSchedule">
      <div class="text-center py-12">
        <UIcon name="i-heroicons-document-text" class="text-6xl text-gray-300 mb-4" />
        <h3 class="text-xl font-medium text-gray-900 mb-2">No Schedule Available</h3>
        <p class="text-gray-600 mb-6">
          Generate a schedule first to enable printing options.
        </p>
        <UButton
          to="#games"
          color="primary"
          icon="i-heroicons-cog-6-tooth"
        >
          Generate Schedule
        </UButton>
      </div>
    </UCard>

    <!-- Print Preview -->
    <UCard v-if="previewGenerated && gameSchedule">
      <template #header>
        <div class="flex justify-between items-center">
          <h3 class="text-lg font-semibold">Print Preview</h3>
          <div class="flex gap-2">
            <UButton
              size="sm"
              icon="i-heroicons-printer"
              @click="print"
            >
              Print
            </UButton>
            <UButton
              size="sm"
              variant="outline"
              icon="i-heroicons-document-arrow-down"
              @click="downloadPdf"
            >
              Save PDF
            </UButton>
          </div>
        </div>
      </template>      <PrintPreview
        ref="printPreviewRef"
        :schedule="gameSchedule"
        :options="printOptions"
        class="print-preview bg-white border rounded-lg p-6 shadow-inner"
        :class="{ compact: printOptions.compactLayout }"
      />
    </UCard>
  </div>
</template>

<style scoped>
.print-preview {
  font-family: 'Times New Roman', serif;
  line-height: 1.4;
  color: #000;
  background: white;
  min-height: 400px;
}

.print-preview :deep(h1) {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 16px;
  text-align: center;
}

.print-preview :deep(h2) {
  font-size: 18px;
  font-weight: bold;
  margin: 16px 0 8px 0;
  border-bottom: 1px solid #ccc;
  padding-bottom: 4px;
}

.print-preview :deep(h3) {
  font-size: 16px;
  font-weight: bold;
  margin: 12px 0 6px 0;
}

.print-preview :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 16px;
}

.print-preview :deep(th),
.print-preview :deep(td) {
  border: 1px solid #ccc;
  padding: 8px;
  text-align: left;
}

.print-preview :deep(th) {
  background-color: #f5f5f5;
  font-weight: bold;
}

.print-preview :deep(.round-section) {
  margin-bottom: 24px;
  page-break-inside: avoid;
}

.print-preview :deep(.game-card) {
  border: 1px solid #ddd;
  margin-bottom: 8px;
  padding: 8px;
  border-radius: 4px;
}

.print-preview :deep(.player-list) {
  columns: 2;
  column-gap: 20px;
  margin-bottom: 16px;
}

.print-preview :deep(.statistics-table) {
  font-size: 12px;
}
</style>

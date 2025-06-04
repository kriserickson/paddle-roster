export interface PDFGenerationOptions {
  orientation?: 'portrait' | 'landscape';
  quality?: number;
  filename?: string;
  scale?: number;
  backgroundColor?: string;
}

/**
 * Generate PDF from an HTML element using jsPDF and html2canvas
 * This function only works on the client side
 */
export async function generatePDFFromElement(
  elementId: string,
  options: PDFGenerationOptions = {}
): Promise<void> {
  // Check if we're running on the client side
  if (typeof window === 'undefined') {
    throw new Error('PDF generation can only be performed on the client side');
  }

  const {
    orientation = 'landscape',
    quality = 2,
    filename = 'document.pdf',
    scale = 2,
    backgroundColor = '#ffffff'
  } = options;

  try {
    // Dynamic imports for client-side only
    const [jsPDFModule, html2canvasModule] = await Promise.all([
      import('jspdf'),
      import('html2canvas')
    ]);
    
    const jsPDF = jsPDFModule.default;
    const html2canvas = html2canvasModule.default;

    // Find the element
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with ID '${elementId}' not found`);
    }

    // Show loading state by temporarily making the element visible if needed
    const originalDisplay = element.style.display;
    const originalVisibility = element.style.visibility;
    const originalPosition = element.style.position;
    
    // Ensure element is visible for canvas capture
    element.style.display = 'block';
    element.style.visibility = 'visible';
    
    // Wait a moment for any dynamic content to render
    await new Promise(resolve => setTimeout(resolve, 100));

    // Convert HTML to canvas with high quality settings
    const canvas = await html2canvas(element, {
      scale: scale,
      useCORS: true,
      allowTaint: false,
      backgroundColor: backgroundColor,
      removeContainer: false,
      foreignObjectRendering: true,
      imageTimeout: 0,
      logging: false,
      onclone: (clonedDoc: Document) => {
        // Ensure all fonts are loaded in the cloned document
        const clonedElement = clonedDoc.getElementById(elementId);
        if (clonedElement) {
          // Force font rendering
          clonedElement.style.fontFamily = '"Times New Roman", serif';
        }
      }
    });

    // Restore original element styles
    element.style.display = originalDisplay;
    element.style.visibility = originalVisibility;
    element.style.position = originalPosition;

    // Calculate PDF dimensions
    const imgData = canvas.toDataURL('image/png', quality);
    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    // Get page dimensions
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    // Calculate image dimensions to fit page
    const imgWidth = pageWidth - 20; // 10mm margin on each side
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let heightLeft = imgHeight;
    let position = 10; // 10mm top margin

    // Add first page
    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= (pageHeight - 20); // Account for top and bottom margins

    // Add additional pages if content is longer than one page
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight + 10; // 10mm top margin
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= (pageHeight - 20);
    }

    // Save the PDF
    pdf.save(filename);

  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate PDF with better page handling for long content
 * This function only works on the client side
 */
export async function generateMultiPagePDF(
  elementId: string,
  options: PDFGenerationOptions = {}
): Promise<void> {
  // Check if we're running on the client side
  if (typeof window === 'undefined') {
    throw new Error('PDF generation can only be performed on the client side');
  }

  const {
    orientation = 'landscape',
    quality = 1.0,
    filename = 'document.pdf',
    scale = 2,
    backgroundColor = '#ffffff'
  } = options;

  try {
    // Dynamic imports for client-side only
    const [jsPDFModule, html2canvasModule] = await Promise.all([
      import('jspdf'),
      import('html2canvas')
    ]);
    
    const jsPDF = jsPDFModule.default;
    const html2canvas = html2canvasModule.default;

    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with ID '${elementId}' not found`);
    }

    // Ensure element is visible
    const originalStyles = {
      display: element.style.display,
      visibility: element.style.visibility,
      position: element.style.position,
      left: element.style.left,
      top: element.style.top
    };
    
    element.style.display = 'block';
    element.style.visibility = 'visible';
    element.style.position = 'absolute';
    element.style.left = '-9999px';
    element.style.top = '0';

    // Wait for rendering
    await new Promise(resolve => setTimeout(resolve, 200));

    // Create canvas
    const canvas = await html2canvas(element, {
      scale: scale,
      useCORS: true,
      allowTaint: false,
      backgroundColor: backgroundColor,
      removeContainer: false,
      foreignObjectRendering: true,
      width: element.scrollWidth,
      height: element.scrollHeight,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      logging: false
    });

    // Restore original styles
    Object.entries(originalStyles).forEach(([key, value]) => {
      (element.style as any)[key] = value;
    });

    // Create PDF
    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'px',
      format: [canvas.width / scale, canvas.height / scale],
      compress: true
    });

    const imgData = canvas.toDataURL('image/png', quality);
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / scale, canvas.height / scale, undefined, 'FAST');

    // Save the PDF
    pdf.save(filename);

  } catch (error) {
    console.error('Error generating multi-page PDF:', error);
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

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
export async function generatePDFFromElement(elementId: string, options: PDFGenerationOptions = {}): Promise<void> {
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
    const [jsPDFModule, html2canvasModule] = await Promise.all([import('jspdf'), import('html2canvas')]);

    const jsPDF = jsPDFModule.default;
    const html2canvas = html2canvasModule.default; // Find the element
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with ID '${elementId}' not found`);
    }

    // Check if element has content
    if (!element.innerHTML || element.innerHTML.trim() === '') {
      throw new Error('Element has no content to convert to PDF');
    }

    // Create a temporary container for better capture
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.top = '-9999px';
    tempContainer.style.left = '0';
    tempContainer.style.zIndex = '9999';
    tempContainer.style.background = '#ffffff';
    tempContainer.style.padding = '20px';
    tempContainer.style.border = 'none';
    tempContainer.style.boxShadow = 'none';
    tempContainer.style.width = '816px'; // Fixed width for consistency
    tempContainer.style.height = 'auto';

    // Clone the element content
    const elementClone = element.cloneNode(true) as HTMLElement;
    elementClone.id = elementId + '-temp-clone';
    elementClone.style.display = 'block';
    elementClone.style.visibility = 'visible';
    elementClone.style.position = 'static';
    elementClone.style.transform = 'none';
    elementClone.style.margin = '0';
    elementClone.style.padding = '20px';
    elementClone.style.width = '776px'; // 816 - 40px padding
    elementClone.style.height = 'auto';
    elementClone.style.maxWidth = 'none';
    elementClone.style.maxHeight = 'none';
    elementClone.style.fontSize = '12px';
    elementClone.style.fontFamily = 'Arial, sans-serif';
    elementClone.style.lineHeight = '1.4';
    elementClone.style.color = '#000';

    // Copy all stylesheets to ensure proper rendering
    const allStyles = Array.from(document.styleSheets);
    const styleElement = document.createElement('style');
    let combinedCSS = '';

    try {
      allStyles.forEach(sheet => {
        try {
          const rules = Array.from(sheet.cssRules || sheet.rules);
          rules.forEach(rule => {
            combinedCSS += rule.cssText + '\n';
          });
        } catch {
          // Skip stylesheets that can't be accessed (CORS)
        }
      });
    } catch {
      // Ignore errors copying styles
    }

    styleElement.textContent = combinedCSS;
    tempContainer.appendChild(styleElement);
    tempContainer.appendChild(elementClone);
    document.body.appendChild(tempContainer);

    // Wait a moment for any dynamic content to render
    await new Promise(resolve => setTimeout(resolve, 300));

    // Check element dimensions
    const rect = elementClone.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      document.body.removeChild(tempContainer);
      throw new Error(`Element has no dimensions: ${rect.width}x${rect.height}`);
    }

    // Convert HTML to canvas with high quality settings
    const canvas = await html2canvas(elementClone, {
      scale: scale,
      useCORS: true,
      allowTaint: false,
      backgroundColor: backgroundColor,
      removeContainer: false,
      foreignObjectRendering: true,
      imageTimeout: 0,
      logging: true,
      width: elementClone.scrollWidth,
      height: elementClone.scrollHeight,
      windowWidth: elementClone.scrollWidth,
      windowHeight: elementClone.scrollHeight
    });

    // Clean up the temporary container
    document.body.removeChild(tempContainer);

    // Check if canvas was created successfully
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      throw new Error(`Failed to create canvas from element: ${canvas?.width || 0}x${canvas?.height || 0}`);
    }

    // Calculate PDF dimensions
    const imgData = canvas.toDataURL('image/png', quality);

    // Check if image data was created successfully
    if (!imgData || imgData === 'data:,' || imgData.length < 100) {
      throw new Error('Failed to generate image data from canvas');
    }

    // Debug: Create a temporary image to verify the canvas content
    const testImg = new Image();
    testImg.onload = () => {};
    testImg.onerror = () => {};
    testImg.src = imgData;

    // Wait a moment for the test image to load
    await new Promise(resolve => setTimeout(resolve, 100));

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
    heightLeft -= pageHeight - 20; // Account for top and bottom margins

    // Add additional pages if content is longer than one page
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight + 10; // 10mm top margin
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight - 20;
    }
    // Save the PDF
    pdf.save(filename);
  } catch (error) {
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate PDF with better page handling for long content
 * This function only works on the client side
 */
export async function generateMultiPagePDF(elementId: string, options: PDFGenerationOptions = {}): Promise<void> {
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
    const [jsPDFModule, html2canvasModule] = await Promise.all([import('jspdf'), import('html2canvas')]);

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
      element.style.setProperty(key, value);
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
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

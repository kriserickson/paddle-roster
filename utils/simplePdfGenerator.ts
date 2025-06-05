export interface SimplePDFOptions {
  orientation?: 'portrait' | 'landscape';
  filename?: string;
}

/**
 * Simple PDF generation from HTML string using jsPDF and html2canvas
 */
export async function generatePDFFromHTML(htmlContent: string, options: SimplePDFOptions = {}): Promise<void> {
  // Check if we're running on the client side
  if (typeof window === 'undefined') {
    throw new Error('PDF generation can only be performed on the client side');
  }

  const { orientation = 'landscape', filename = 'document.pdf' } = options;

  try {
    // Dynamic imports for client-side only
    const [jsPDFModule, html2canvasModule] = await Promise.all([import('jspdf'), import('html2canvas')]);

    const jsPDF = jsPDFModule.default;
    const html2canvas = html2canvasModule.default;

    // Create a temporary iframe to render the HTML
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.top = '-9999px';
    iframe.style.left = '0';
    iframe.style.width = orientation === 'landscape' ? '11in' : '8.5in';
    iframe.style.height = orientation === 'landscape' ? '8.5in' : '11in';
    iframe.style.border = 'none';
    iframe.style.background = 'white';

    document.body.appendChild(iframe);

    // Wait for iframe to be ready
    await new Promise(resolve => {
      iframe.onload = resolve;
      // Write the HTML content to the iframe
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(htmlContent);
        iframeDoc.close();
      }
    });

    // Wait for content to render
    await new Promise(resolve => setTimeout(resolve, 500));

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc || !iframeDoc.body) {
      throw new Error('Failed to access iframe document');
    }

    console.log(
      'Simple PDF Generator - Iframe body dimensions:',
      iframeDoc.body.scrollWidth,
      'x',
      iframeDoc.body.scrollHeight
    );

    // Convert iframe content to canvas
    const canvas = await html2canvas(iframeDoc.body, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      width: iframeDoc.body.scrollWidth,
      height: iframeDoc.body.scrollHeight,
      logging: true
    });

    // Clean up iframe
    document.body.removeChild(iframe);

    console.log('Simple PDF Generator - Canvas dimensions:', canvas.width, 'x', canvas.height);

    // Create PDF
    const imgData = canvas.toDataURL('image/png', 1.0);

    if (!imgData || imgData === 'data:,' || imgData.length < 100) {
      throw new Error('Failed to generate image data from canvas');
    }

    console.log('Simple PDF Generator - Image data length:', imgData.length);

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
    heightLeft -= pageHeight - 20;

    // Add additional pages if needed
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight - 20;
    }

    // Save the PDF
    pdf.save(filename);
    console.log('Simple PDF Generator - PDF saved successfully');
  } catch (error) {
    console.error('Error generating PDF from HTML:', error);
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

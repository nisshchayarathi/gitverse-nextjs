/**
 * Dynamic helper to export target element as PNG/PDF
 */
export async function exportElement(elementId: string, format: 'png' | 'pdf', fileName: string) {
  if (typeof window === "undefined") return;
  const element = document.getElementById(elementId);
  if (!element) return;

  const html2canvas = (await import("html2canvas")).default;
  const canvas = await html2canvas(element);

  if (format === 'png') {
    const link = document.createElement("a");
    link.download = `${fileName}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } else if (format === 'pdf') {
    const { default: jsPDF } = await import("jspdf");
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const scaleFactor = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
    const pdfWidth = canvas.width * scaleFactor;
    const pdfHeight = canvas.height * scaleFactor;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${fileName}.pdf`);
  }
}

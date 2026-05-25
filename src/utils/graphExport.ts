// @ts-ignore
import { jsPDF } from 'jspdf';

/**
 * Normalizes an SVG graph and draws it to an offscreen high-res canvas.
 */
async function renderSVGToCanvas(svgElement: SVGSVGElement, scaleFactor: number = 2): Promise<HTMLCanvasElement> {
  // 1. Clone the SVG to not mess up the active DOM
  const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
  
  // Find the primary group `<g>` that holds the content
  // In CodeDependencyGraph it's the first `<g>` (created by d3.zoom)
  const gElement = clonedSvg.querySelector('g');
  if (!gElement) throw new Error("Graph `<g>` container not found");
  
  // 2. We must remove the existing transform (zoom/pan) so it renders from 0,0 natively
  gElement.removeAttribute("transform");

  // 3. We need to compute the true bounding box. We can get this from the live SVG element's inner `<g>`
  const liveGElement = svgElement.querySelector('g');
  if (!liveGElement) throw new Error("Live Graph `<g>` container not found");
  
  const bbox = (liveGElement as any).getBBox();
  
  // Add padding
  const padding = 50;
  const width = bbox.width + padding * 2;
  const height = bbox.height + padding * 2;
  
  // 4. Update the cloned SVG's viewBox and dimensions to tightly wrap the graph
  clonedSvg.setAttribute("viewBox", `${bbox.x - padding} ${bbox.y - padding} ${width} ${height}`);
  clonedSvg.setAttribute("width", `${width}`);
  clonedSvg.setAttribute("height", `${height}`);

  // 5. Serialize to string
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(clonedSvg);
  
  // Add xml namespace if missing
  if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
    svgString = svgString.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
  }

  // 6. Convert to Data URL
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * scaleFactor;
      canvas.height = height * scaleFactor;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error("Canvas 2D context not available"));
      
      // Solid dark background
      ctx.fillStyle = '#0f111a'; // Match UI dark mode
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.scale(scaleFactor, scaleFactor);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load SVG into Image"));
    };
    img.src = url;
  });
}

/**
 * Export graph as a high-res PNG file.
 */
export async function exportGraphAsPNG(svgElement: SVGSVGElement, filename: string = 'dependency-graph.png') {
  const canvas = await renderSVGToCanvas(svgElement, 2); // 2x scale for Retina
  
  const dataUrl = canvas.toDataURL("image/png");
  
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

/**
 * Export graph as a PDF file containing the high-res image.
 */
export async function exportGraphAsPDF(svgElement: SVGSVGElement, filename: string = 'dependency-graph.pdf') {
  const canvas = await renderSVGToCanvas(svgElement, 3); // 3x scale for crisp PDF
  
  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  
  const orientation = canvas.width > canvas.height ? 'landscape' : 'portrait';
  const pdf = new jsPDF({
    orientation,
    unit: 'px',
    format: [canvas.width, canvas.height]
  });
  
  pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
  pdf.save(filename);
}

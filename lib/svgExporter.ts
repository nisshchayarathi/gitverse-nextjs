/**
 * Serializes CSS variables and relevant Tailwind/styling rules directly into a <style> block inside the SVG.
 */
function injectStylesIntoSVG(svgClone: SVGSVGElement): void {
  // Collect all unique class names used in the SVG
  const classes = new Set<string>();
  const elements = svgClone.querySelectorAll("*");
  elements.forEach((el) => {
    el.classList.forEach((cls) => classes.add(cls));
  });
  svgClone.classList.forEach((cls) => classes.add(cls));

  let cssText = "";

  // 1. Fetch Tailwind CSS variables from :root or body computed style
  const computedStyle = window.getComputedStyle(document.body);
  const tailwindVariables = [
    "--background",
    "--foreground",
    "--card",
    "--card-foreground",
    "--popover",
    "--popover-foreground",
    "--primary",
    "--primary-foreground",
    "--secondary",
    "--secondary-foreground",
    "--muted",
    "--muted-foreground",
    "--accent",
    "--accent-foreground",
    "--destructive",
    "--destructive-foreground",
    "--border",
    "--input",
    "--ring",
    "--radius",
  ];

  let rootVars = ":root {\n";
  tailwindVariables.forEach((variable) => {
    const val = computedStyle.getPropertyValue(variable);
    if (val) {
      rootVars += `  ${variable}: ${val.trim()};\n`;
    }
  });
  rootVars += "}\n";
  cssText += rootVars;

  // 2. Add base SVG style to match the application's glassmorphism/dark look
  cssText += `
svg {
  background-color: #0f172a !important;
  color: #ffffff !important;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
}
line {
  stroke-linecap: round;
}
text {
  user-select: none;
  font-family: inherit;
}
`;

  // 3. Find CSS rules matching the class names used in SVG
  try {
    for (let i = 0; i < document.styleSheets.length; i++) {
      const sheet = document.styleSheets[i];
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) continue;

        for (let j = 0; j < rules.length; j++) {
          const rule = rules[j];
          if (rule instanceof CSSStyleRule) {
            const selector = rule.selectorText;
            const matchesClass = Array.from(classes).some((cls) => 
              selector.includes(`.${cls}`)
            );
            const matchesElement = selector === "svg" || selector === "circle" || selector === "line" || selector === "text";
            
            if (matchesClass || matchesElement) {
              cssText += `${rule.cssText}\n`;
            }
          } else if (rule instanceof CSSGroupingRule) {
            let subRulesText = "";
            for (let k = 0; k < rule.cssRules.length; k++) {
              const subRule = rule.cssRules[k];
              if (subRule instanceof CSSStyleRule) {
                const subSelector = subRule.selectorText;
                const matchesClass = Array.from(classes).some((cls) => 
                  subSelector.includes(`.${cls}`)
                );
                if (matchesClass) {
                  subRulesText += `  ${subRule.cssText}\n`;
                }
              }
            }
            if (subRulesText) {
              const conditionText = rule.cssText.split('{')[0].trim();
              cssText += `${conditionText} {\n${subRulesText}}\n`;
            }
          }
        }
      } catch (e) {
        // Ignore cross-origin stylesheet access errors (e.g. external web fonts)
      }
    }
  } catch (e) {
    console.warn("Could not retrieve all styles:", e);
  }

  // Inject the style element
  const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
  styleEl.textContent = cssText;
  
  if (svgClone.firstChild) {
    svgClone.insertBefore(styleEl, svgClone.firstChild);
  } else {
    svgClone.appendChild(styleEl);
  }
}

/**
 * Extracts and downloads the D3 SVG graph element as a standalone vector graphic.
 */
export function exportGraphAsSVG(
  svgElement: SVGSVGElement,
  mode: "current" | "full",
  filename: string = "dependency-graph.svg"
): void {
  // Clone the SVG element so we do not modify the active DOM
  const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;

  const gElement = clonedSvg.querySelector("g");
  if (!gElement) {
    throw new Error("SVG `<g>` element not found in graph container");
  }

  if (mode === "current") {
    // Current View: Keep transform as is, set dimensions matching live element
    const bbox = svgElement.getBoundingClientRect();
    const width = bbox.width || 800;
    const height = bbox.height || 600;
    
    clonedSvg.setAttribute("width", `${width}`);
    clonedSvg.setAttribute("height", `${height}`);
    
    const activeViewBox = svgElement.getAttribute("viewBox");
    if (!activeViewBox) {
      clonedSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    }
  } else {
    // Full Map View: Reset transform to include all nodes
    gElement.removeAttribute("transform");

    const liveGElement = svgElement.querySelector("g");
    if (!liveGElement) {
      throw new Error("Live SVG `<g>` element not found");
    }

    const bbox = (liveGElement as any).getBBox();
    const padding = 50;
    
    const x = bbox.x - padding;
    const y = bbox.y - padding;
    const width = bbox.width + padding * 2;
    const height = bbox.height + padding * 2;

    clonedSvg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
    clonedSvg.setAttribute("width", `${width}`);
    clonedSvg.setAttribute("height", `${height}`);
  }

  // Inject styles and tailwind variables
  injectStylesIntoSVG(clonedSvg);

  // Serialize to string
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(clonedSvg);

  if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
    svgString = svgString.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
  }

  // Download file
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

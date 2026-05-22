import { defaultSchema } from 'rehype-sanitize';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';

// Refined schema for sanitizing README markdown
const readmeSanitizeSchema = (() => {
  const schema = {
    ...defaultSchema,
    // Note: "img" is already included in defaultSchema.tagNames, so we don't need to add it again.
    
    // Explicitly restrict protocols for attributes to mitigate protocol-based XSS (e.g. javascript:)
    protocols: {
      ...(defaultSchema.protocols || {}),
      href: ["http", "https", "mailto"], // Only allow safe link protocols
    },
    
    attributes: {
      ...(defaultSchema.attributes || {}),
      // Allow target and rel attributes for links (for external links)
      a: Array.from(
        new Set([
          ...((defaultSchema.attributes?.a) || []),
          "target",
          "rel",
        ]),
      ),
      // Allow standard image attributes used in READMEs (e.g. alignment and lazy loading)
      img: ["src", "alt", "title", "width", "height", "align", "loading"],
    },
  };
  return schema;
})();


const processor = unified()
  .use(remarkParse)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSanitize, readmeSanitizeSchema)
  .use(rehypeStringify);

const maliciousMarkdown = `
# Comprehensive HTML/Markdown Sanitization Test

## COLLAPSIBLE DETAILS
<details>
  <summary>Click to view details</summary>
  Here is some hidden content.
</details>

## TABLES
| Header 1 | Header 2 |
|---|---|
| Cell 1 | Cell 2 |

## ALIGNMENT & DECORATION
<p align="center">Centered text</p>
<div style="color: red; font-size: 20px;">Injected Style (should be stripped)</div>

## DANGEROUS HTML TAGS
<script>alert('XSS Script');</script>
<iframe src="https://malicious.com" width="500" height="300"></iframe>
<object data="malicious.swf"></object>
<embed src="malicious.swf"></embed>
<svg onload="alert('XSS SVG')"></svg>
<math><img src="x" onerror="alert('XSS Math')"></math>

## DANGEROUS ATTRIBUTES
<img src="https://example.com/image.png" alt="Test Image" align="left" width="100" onerror="alert('XSS Img')">
<a href="javascript:alert('XSS Link')" target="_blank" rel="noopener">Malicious Link</a>
<div id="location" class="custom-class" data-custom="value">DOM Clobbering / Class Test</div>
`;

processor.process(maliciousMarkdown).then((file) => {
  console.log("--- Sanitize Output ---");
  console.log(String(file));
}).catch(console.error);

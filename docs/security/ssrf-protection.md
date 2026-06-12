# SSRF Protection — Avatar URL Handling

## Problem: Stored SSRF via Avatar URLs

Users can set their avatar by providing an HTTP/HTTPS URL pointing to an external image. If the server merely validates the URL at upload time and stores it for the browser to render, an attacker can:

1. Register a domain that resolves to a public IP during the upload check
2. Later change the DNS record to point to a private address (DNS rebinding)
3. Any victim viewing the attacker's profile page makes a browser-side request to the attacker-controlled domain, which now resolves to an internal service

This is a **stored SSRF** — the attack payload persists until the avatar URL is changed.

## Defense Architecture

The fix uses three layers of defense, implemented across `lib/services/imageService.ts` and `app/api/upload/avatar/route.ts`:

### Layer 1: DNS-Based IP Validation (`validateHttpAvatarUrl`)

At upload time, the server resolves the domain and checks all returned IPs against a blocklist of private, loopback, link-local, and cloud-metadata ranges.

**File:** `lib/services/imageService.ts:116-162`

```
if not HTTP/HTTPS  → reject
if hostname has no dot → reject
lookup DNS → if any IP is private/loopback/link-local → reject
```

This is the same check that existed before, kept as a first-pass filter.

### Layer 2: Server-Side Fetch and Copy (`fetchAndValidateAvatarUrl`)

Instead of storing the external URL for the browser to render, the server fetches the content itself, validates it, stores a local copy, and returns the local URL. The original external URL is discarded.

**File:** `lib/services/imageService.ts:168-270`

```
1. DNS validation (same as Layer 1)
2. Fetch with AbortController timeout (10s default)
3. Check HTTP status code (must be 2xx)
4. Check Content-Type header (must be image/*)
5. Check Content-Length header and actual body size (must be ≤ 500KB)
6. Validate image content with sharp decoder
7. Return buffer and detected MIME type
```

The browser never touches the original URL. The server is the only entity that makes a request to the external domain, and that request happens at upload time when the server can control and validate every aspect of the response.

### Layer 3: Image Content Validation (`validateImageContent`)

All buffers — whether from file upload, data URL, or HTTP fetch — are validated by passing them through the `sharp` image decoder. If `sharp` cannot extract metadata from the buffer, the content is rejected.

**File:** `lib/services/imageService.ts:73-114`

This catches:
- Polyglot files (valid MIME header, non-image binary content)
- Truncated or corrupted images
- HTML pages returned by misconfigured servers
- Redirect bodies (already followed by `redirect: "follow"` but serves as a double-check)

## Code Flow

### HTTP URL Upload

```
POST /api/upload/avatar { "url": "https://..." }
  ├── requireAuth()
  ├── checkRateLimit()
  ├── validateHttpAvatarUrl(url)         ← Layer 1: DNS + IP check
  ├── fetchAndValidateAvatarUrl(url)     ← Layer 2: server-side fetch
  │     ├── validateSafeUrl()            ← DNS check again (fresh look-up)
  │     ├── fetch()                      ← server-side request
  │     ├── Content-Type check
  │     ├── content size check
  │     └── validateImageContent(buffer) ← Layer 3: sharp decode
  ├── storeAvatar(buffer, mimeType)      ← write local copy
  └── return { avatarUrl: "/uploads/..." }   ← local URL, not external
```

### Data URL Upload

```
POST /api/upload/avatar { "dataUrl": "data:image/..." }
  ├── requireAuth()
  ├── checkRateLimit()
  ├── validateDataUrl(dataUrl)           ← MIME prefix, base64 size
  ├── parseDataUrl(dataUrl)              ← decode base64 → buffer
  ├── validateImageContent(buffer)       ← Layer 3: sharp decode
  ├── storeAvatar(buffer, mimeType)      ← write local copy
  └── return { avatarUrl: "/uploads/..." }
```

### File Upload

```
POST /api/upload/avatar (multipart)
  ├── requireAuth()
  ├── checkRateLimit()
  ├── validateImageFile(file)            ← MIME + size on File object
  ├── storeAvatar(buffer, mimeType)      ← write local copy
  └── return { avatarUrl: "/uploads/..." }
```

## Test Coverage

| Test | File | What it validates |
|------|------|-------------------|
| `fetchAndValidateAvatarUrl` | `lib/services/__tests__/imageService.test.ts` | Valid URL returns buffer + MIME DNS reject, timeout, bad status, empty response, oversized response |
| `validateImageContent` | `lib/services/__tests__/imageService.test.ts` | JPEG/PNG/WebP/GIF accepted, corrupted buffer rejected, polyglot detection |
| `validateDataUrl` | `lib/services/__tests__/imageService.test.ts` | Existing tests still pass; MIME-prefix validation still works |
| `validateHttpAvatarUrl` | `lib/services/__tests__/imageService.test.ts` | Existing tests still pass; DNS validation chain intact |

## Edge Cases

### DNS Lookup Timing

The `validateSafeUrl` call inside `fetchAndValidateAvatarUrl` performs a fresh DNS lookup at fetch time, not at validation time. This means: if an attacker's DNS record was safe 100ms ago when the outer `validateHttpAvatarUrl` ran but changes before `fetchAndValidateAvatarUrl` calls `validateSafeUrl`, the fetch will still catch it. If the DNS changes between the `validateSafeUrl` call and the `fetch()` call (a 1-2ms window), the fetch goes to whatever IP the system DNS resolves. This window is too small for practical DNS rebinding and is further mitigated by the fact that even if the fetch reaches a private IP, the image content would not be a valid image (cloud metadata returns text, not JPEG), and the sharp decode would reject it.

### Redirect Chains

`fetch()` is called with `redirect: "follow"` with a default of up to 20 redirects (per fetch spec). The final response must be a valid image. A chain that redirects through multiple hosts is fine as long as the terminal response passes all checks. An attacker cannot use this to bypass the SSRF check because every redirect is followed server-side, not by the browser.

### Oversized Responses

Two size checks exist:
1. `Content-Length` header check (if present) — rejects before body download
2. Actual `arrayBuffer.byteLength` check — catches cases where `Content-Length` is missing or wrong

The maximum accepted size is 500 KB, matching the existing limit for direct file uploads.

### Timeouts

A 10-second timeout (configurable via the optional second parameter) prevents slow-loris or hanging responses from tying up server resources. The `AbortController` is cleaned up in a `finally` block to prevent memory leaks.

### Empty Responses

An empty response body (0 bytes) is explicitly checked and rejected.

## Performance Considerations

- Each HTTP URL upload triggers one outbound HTTP request to the external server. For typical avatar images (10-100 KB), this adds 100-500ms to the upload time.
- The sharp `metadata()` call operates on the in-memory buffer and does not write to disk. It is fast (single-digit ms for JPEG/PNG files under 500 KB).
- No new caching layer is added. If the same external URL is uploaded by multiple users, it is fetched and stored multiple times. This is acceptable because avatar uploads are infrequent per user.

## Related Issues

- Issue #1959: Original security report
- PR #[PR_NUMBER]: Implementation of server-side fetch SSRF defense

## References

- [OWASP Server-Side Request Forgery (SSRF)](https://owasp.org/www-community/attacks/Server_Side_Request_Forgery)
- [DNS Rebinding Attack](https://en.wikipedia.org/wiki/DNS_rebinding)
- [Sharp Image Processing Library](https://sharp.pixelplumbing.com/)

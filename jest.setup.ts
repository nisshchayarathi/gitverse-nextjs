import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
import { ReadableStream, TransformStream, WritableStream } from 'stream/web';
import { clearImmediate } from 'timers';
import { MessageChannel, MessagePort } from 'worker_threads';

// 1. Core Node polyfills must be set FIRST so undici can use them
Object.assign(globalThis, {
  TextEncoder,
  TextDecoder,
  ReadableStream,
  TransformStream,
  WritableStream,
  clearImmediate,
  MessageChannel,
  MessagePort,
});

// 2. Conditionally polyfill Web APIs using undici only if they are not already exposed by Node natively
if (!globalThis.fetch || !globalThis.Request || !globalThis.Response) {
  try {
    const undici = require('undici');
    Object.assign(globalThis, {
      Request: globalThis.Request || undici.Request,
      Response: globalThis.Response || undici.Response,
      Headers: globalThis.Headers || undici.Headers,
      fetch: globalThis.fetch || undici.fetch,
      FormData: globalThis.FormData || undici.FormData,
      Blob: globalThis.Blob || undici.Blob,
      File: globalThis.File || undici.File,
    });
  } catch (e) {
    console.warn("Native Web APIs are missing and undici polyfill failed to load:", e);
  }
}

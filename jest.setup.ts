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

// 2. Now we can safely require undici
const { fetch, Request, Response, Headers, FormData, Blob, File } = require('undici');

// 3. Polyfill Web APIs for Next.js App Router tests
Object.assign(globalThis, {
  Request,
  Response,
  Headers,
  fetch,
  FormData,
  Blob,
  File,
});

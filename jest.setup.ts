import '@testing-library/jest-dom';

if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

if (typeof global.ReadableStream === 'undefined') {
  const { ReadableStream } = require('node:stream/web' as any);
  global.ReadableStream = ReadableStream;
}

if (typeof global.Request === 'undefined' || typeof global.Response === 'undefined' || typeof global.Headers === 'undefined') {
  const undici = require('undici');
  global.Request = undici.Request;
  global.Response = undici.Response;
  global.Headers = undici.Headers;
}

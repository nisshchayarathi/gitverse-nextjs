import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
import { ReadableStream } from 'stream/web';

Object.assign(global, { TextDecoder, TextEncoder, ReadableStream });

const undici = require('undici');
Object.assign(global, {
  Request: undici.Request,
  Response: undici.Response,
  Headers: undici.Headers,
});


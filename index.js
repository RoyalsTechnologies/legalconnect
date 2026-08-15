import 'express';
import { createApp } from './server/dist/app.js';

/**
 * Vercel Express entry. Must import `express` in this file.
 * The API is compiled in vercel-build (`server/dist`) so Vercel does not
 * typecheck server/src (helmet/cors CJS exports fail that check).
 * Local Docker still starts from server/src/server.ts.
 */
export default createApp();

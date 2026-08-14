import { createApp } from './server/src/app.js';

/**
 * Vercel turns this default export into one Function (docs/06-deployment.md).
 * Local Docker still starts from server/src/server.ts.
 */
export default createApp();

import 'express';
import { createApp } from './server/src/app.js';

/**
 * Vercel turns this default export into one Function (docs/06-deployment.md).
 * The Express preset only accepts this file if it imports `express` here
 * (not only inside createApp). Local Docker still starts from server/src/server.ts.
 */
export default createApp();

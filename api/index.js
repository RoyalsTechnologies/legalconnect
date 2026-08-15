import { createApp } from '../server/dist/app.js';

/**
 * Vercel serverless entry for the whole API. An Express app is itself a
 * (req, res) handler, so exporting it is enough.
 *
 * The API is compiled to `server/dist` during vercel-build so Vercel never
 * typechecks `server/src`, where the CJS helmet/cors default exports fail.
 * Local development and Docker still start from `server/src/server.ts`.
 */
export default createApp();

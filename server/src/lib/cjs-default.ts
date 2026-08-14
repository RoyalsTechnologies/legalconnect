import { createRequire } from 'node:module';
import type { CorsOptions } from 'cors';
import type { RequestHandler } from 'express';
import type bcryptjs from 'bcryptjs';
import type jwtTypes from 'jsonwebtoken';
import type nodemailerTypes from 'nodemailer';

// Vercel's Express typecheck treats CJS/ESM default exports as a namespace
// (`typeof import("…")`) with no call signatures. require() unwraps the real
// export so helmet/cors/bcrypt/jwt/nodemailer stay callable at runtime.
const require = createRequire(import.meta.url);

function interop<T>(id: string): T {
  const loaded: unknown = require(id);
  if (loaded && typeof loaded === 'object' && 'default' in loaded) {
    const inner = (loaded as { default: unknown }).default;
    if (inner !== undefined && inner !== null) return inner as T;
  }
  return loaded as T;
}

export const helmet = interop<(options?: object) => RequestHandler>('helmet');
export const cors = interop<(options?: CorsOptions) => RequestHandler>('cors');
export const bcrypt = interop<typeof bcryptjs>('bcryptjs');
export const jwt = interop<typeof jwtTypes>('jsonwebtoken');
export const nodemailer = interop<typeof nodemailerTypes>('nodemailer');

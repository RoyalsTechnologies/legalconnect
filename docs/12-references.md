# References and acknowledgements

Every third-party framework, library, API, and service that LegalConnect Ghana depends on,
as required by CON-005 and the examination brief. Versions are the ranges declared in
`client/package.json`, `server/package.json`, and the root `package.json` as at
15 August 2026; nothing is listed here that the project does not actually use.

Citation style throughout: **Publisher. *Name*, version. URL**

## Runtime and language

- Node.js Foundation. *Node.js*, 22 LTS. <https://nodejs.org>
- Microsoft. *TypeScript*, ^5.7.3. <https://www.typescriptlang.org>
- npm, Inc. *npm*. <https://www.npmjs.com>

## Frontend

- Meta Open Source. *React*, ^18.3.1. <https://react.dev>
- Meta Open Source. *React DOM*, ^18.3.1. <https://react.dev/reference/react-dom>
- Remix Software. *React Router DOM*, ^7.1.1. <https://reactrouter.com>
- Ant Group. *Ant Design*, ^6.6.0. <https://ant.design>
- Ant Group. *Ant Design Icons*, ^6.3.2. <https://ant.design/components/icon>
- Evan You and Vite contributors. *Vite*, ^6.0.7. <https://vite.dev>
- Vite contributors. *@vitejs/plugin-react*, ^4.3.4. <https://github.com/vitejs/vite-plugin-react>

## Backend

- OpenJS Foundation. *Express*, ^4.21.2. <https://expressjs.com>
- Colin Hacks. *Zod*, ^3.24.1. <https://zod.dev>
- Evan Hahn and contributors. *Helmet*, ^8.0.0. <https://helmetjs.github.io>
- Troy Goode and contributors. *cors*, ^2.8.5. <https://github.com/expressjs/cors>
- Daniel Wirtz and contributors. *bcryptjs*, ^2.4.3. <https://github.com/dcodeIO/bcrypt.js>
- Auth0. *jsonwebtoken*, ^9.0.2. <https://github.com/auth0/node-jsonwebtoken>
- Nodemailer contributors. *Nodemailer*, ^9.0.5. <https://nodemailer.com>
- Motdotla. *dotenv*, ^16.4.7. <https://github.com/motdotla/dotenv>

## Database

- PostgreSQL Global Development Group. *PostgreSQL*, 16. <https://www.postgresql.org>
- Prisma Data, Inc. *Prisma ORM* and *@prisma/client*, ^6.2.1. <https://www.prisma.io>

## Testing and quality

- Vitest contributors. *Vitest*, ^4.1.10. <https://vitest.dev>
- Vitest contributors. *@vitest/coverage-v8*, ^4.1.10. <https://vitest.dev/guide/coverage>
- Ladjs. *SuperTest*, ^7.0.0. <https://github.com/ladjs/supertest>
- Microsoft. *Playwright Test*, ^1.62.1. <https://playwright.dev>
- Biome contributors. *Biome*, ^2.0.0. <https://biomejs.dev>
- Esbuild-kit contributors. *tsx*, ^4.19.2. <https://github.com/privatenumber/tsx>

## Infrastructure and hosting

- Vercel, Inc. *Vercel* — static hosting for the Vite build and the Express serverless
  function. <https://vercel.com>
- Supabase, Inc. *Supabase* — hosted PostgreSQL for the deployed environment.
  <https://supabase.com>
- Docker, Inc. *Docker Compose* — local PostgreSQL, API, and client stack.
  <https://docs.docker.com/compose>
- GitHub, Inc. *GitHub Actions* — continuous integration.
  <https://docs.github.com/actions>

## External services and APIs

- OpenRouter. *OpenRouter API* — the OpenAI-compatible gateway used by the AI adapter at
  `https://openrouter.ai/api/v1`. <https://openrouter.ai/docs>
- NVIDIA. *Nemotron* (`nvidia/nemotron-3-ultra-550b-a55b:free`) — the large language model
  requested through OpenRouter for intake triage. <https://openrouter.ai/models>
- Nalo Solutions Ltd. *NaloPay* — mobile money collection and disbursement, test endpoint
  `https://nalopaytest.nalosolutions.com`. <https://nalosolutions.com>
- Nalo Solutions Ltd. *SMS Solutions HTTP API* — optional SMS notifications, configured
  through `SMS_ENDPOINT`. <https://nalosolutions.com>
- Google LLC. *Google Meet* and *Google Calendar* — used only through their public URL
  conventions (`meet.google.com`, the Calendar event-template URL). No Google SDK,
  API key, or OAuth integration is present. <https://meet.google.com>

## Notes on attribution

No external source code was copied into this repository. All application code under
`client/src`, `server/src`, and `server/prisma` was written for this project; third-party
code is consumed only through the package manager as declared above.

Practitioner names, biographies, and profile details in the seed data are fictional. They
do not represent real lawyers, and no directory of practising lawyers was copied from the
General Legal Council or any other source.

Ghana-specific reference data used in the interface — the region list and mobile money
network names in `client/src/constants/ghana.ts` — is common public knowledge rather than
a licensed dataset.

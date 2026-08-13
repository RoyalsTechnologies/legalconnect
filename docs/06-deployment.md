# Deployment

Status: not yet deployed. Platform not yet selected.

The final application must be accessible online. Choose the approach that minimises
examination risk and has the fewest moving parts — ideally one web deployment plus managed
PostgreSQL.

Candidate platforms include Vercel, Netlify, Render, or another suitable host. **Confirm
the choice with the user before writing platform-specific configuration**, since it
depends on which accounts are available.

## Configuration

Keep production configuration separate from development. Use environment variables, commit
a `.env.example` containing placeholders only, and document every variable name.

Never commit `.env`, API secrets, database passwords, private keys, or admin passwords.
The AI provider key is server-side only and must never appear in a client bundle.

Planned variables (update as the code is written):

```
DATABASE_URL=
JWT_SECRET=
AI_PROVIDER_API_KEY=
AI_PROVIDER_BASE_URL=
AI_PROVIDER_MODEL=
AI_REQUEST_TIMEOUT_MS=
PORT=
CLIENT_ORIGIN=
```

## Pre-deployment verification

- [ ] Production build succeeds
- [ ] Environment variables configured on the host
- [ ] Database connection works
- [ ] Migrations applied
- [ ] API endpoints work
- [ ] Authentication works
- [ ] Static assets load
- [ ] Critical workflows work end to end
- [ ] No secrets exposed in the bundle or in API responses
- [ ] URLs are stable
- [ ] Test credentials work

Never mark deployment complete on the strength of a successful build. Test the live
application.

## Gate before deployment

Core Must requirements working · critical tests passing · critical security issues
addressed · production configuration prepared.

## Logging and observability

Log enough to diagnose critical failures: startup errors, database connection errors,
failed external calls, unexpected exceptions, and important state changes. Never log
passwords, access tokens, secret keys, full sensitive records, or full legal-intake text.
Avoid building monitoring infrastructure that the project does not need.

## Submission links

Maintain this for the final `Deployment_and_Source_Links.txt`. **Keep real passwords out of
the repository** — fill them in only in the submitted file, or reference credentials held
outside version control. Use placeholders here until real values exist, and never invent a
missing value.

```
Student Name:            <not yet recorded>
Student ID:              <not yet recorded>
Project Title:           LegalConnect Ghana — An AI-Powered Platform for Improving
                         Access to Legal Services
Live Application:        <not yet deployed>
Admin URL:               <not yet deployed>
Test Username:           <not yet created>
Test Password:           <supply in submission file only, not in the repository>
Admin Username:          <not yet created>
Admin Password:          <supply in submission file only, not in the repository>
Source Code Repository:  <not yet published>
```

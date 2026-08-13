# User manual

Status: draft against the implemented web app. Screenshots: not yet completed.

**Application URL** — local development: http://localhost:5173 (API http://localhost:4000). Production URL: not yet deployed.

**Supported roles** — Citizen (`USER`), Lawyer, Admin

## Getting started

### Create a citizen account

1. Open **Get started** / **Create an account**.
2. Leave **I am** on **Seeking legal help**.
3. Enter your name, email, optional Ghana phone number, and a password (at least 8 characters).
4. After submit you see **Check your email** — open the confirmation link before signing in.
5. If the email did not arrive, use **Resend confirmation email** on that screen or from the sign-in error.

### Apply as a lawyer

1. Open **Are you a lawyer?** on the home page, or **Create an account** and choose **A lawyer**.
2. Enter account details plus a short description of your practice, city, region, and at least one practice area. Licence number is optional but helps the administrator.
3. Confirm your email, then sign in. Your profile stays hidden until an administrator approves it.
4. You will not appear in the directory or receive consultation requests until you are approved **and** you have a live plan (My profile).

Admins can still create a lawyer account directly if needed.

### Sign in

Use the same form for citizens, lawyers, and administrators. You land on the home screen for your role.

### Forgot password

1. On **Sign in**, open **Forgot password?**
2. Enter your email. If the address is registered, you receive a reset link (valid about one hour).
3. Choose a new password on the link page, then sign in.

## Main navigation

Role-aware links in the header:

- **Citizen** — Home, New enquiry, Find a lawyer, My requests, Account
- **Lawyer** — Home, Requests, My profile, Account
- **Admin** — Home, Administration, Directory, Account

## Key citizen tasks

1. **Describe a legal issue** — Home → **Tell us what happened** (plain language; optional city/region).
2. **Review organisation** — suggested category, summary, and your original words. AI results organise the request; they are not legal advice.
3. **Suggested lawyers** — reasons shown for each match; or browse the full directory.
4. **Book a consultation** — attach an existing enquiry; pay that lawyer's consultation fee (shown on their profile). The lawyer is notified only after payment.
5. **Track requests** — **My requests**; status updates are emailed (and SMS’d when SMS is configured and a phone is on the account).
6. **Account** — change your name or Ghana phone number. Email cannot be changed here.

## Key lawyer tasks

1. Choose a **plan** on **My profile** (Starter 1 area, Practice 3, Chambers all listed areas). Pay one month or one year (twelve times the current monthly fee) by mobile money. Citizens cannot find you without a live plan.
2. Keep **My profile** (practice areas within your plan's cap, availability, location, licence number, consultation fee) accurate — matching uses practice areas; booking uses your fee.
3. Open **Requests** to read the structured summary and the citizen’s own words.
4. Accept, decline, or later mark completed. Accepting reveals contact details needed to continue.

If you applied yourself, wait for approval **and** subscribe to a plan before
citizens can find you. If an admin created your account you should receive a welcome email with a temporary password (if email is configured). Change it after first sign-in.

## Admin tasks

- **Overview** — counts needing attention (pending lawyers, review enquiries, AI fallbacks).
- **Users** — search, filter by role, suspend/reactivate.
- **Lawyers** — review pending self-registrations, approve or reject, grant a month or a year, or create an account directly.
- **Plans** — set each plan's monthly fee, add or retire packages (each package is a cap on practice areas). A year costs twelve times that fee. A fee change applies to the next payment, not a period already paid.
- **Categories** — add or retire practice categories (retired ones stay on old records).

## Logging out

Use **Sign out** in the header. Your browser session token is discarded.

## Email alerts (when SMTP is configured)

| Event | Recipient |
| --- | --- |
| Confirm signup | New citizen or lawyer |
| Password reset | Account holder |
| New consultation request | Lawyer |
| Accepted / declined / cancelled | Citizen |
| Lawyer account created by admin | New lawyer (temporary password) |
| Profile approved or rejected | Lawyer |

## Paying for a consultation

Each lawyer sets their own fee in Ghana cedis. Booking a consultation sends a NaloPay
mobile-money prompt to the number you enter (when `NALOPAY_*` credentials are set;
otherwise the server records the payment in local development). Approve the prompt on
your phone. The booking page checks payment status every few seconds; you can also tap
**I have approved the prompt**. The lawyer does not see the request until payment succeeds.
The platform does not yet pay that fee onward to the lawyer (TD-025).

NaloPay's webhook (`POST /api/v1/payments/callback`) cannot reach `localhost` from their
servers. Confirmation uses the collection-status poll, so local booking still completes
without a public URL. Set `NALOPAY_CALLBACK_URL` to a public HTTPS URL in a deployed
environment so NaloPay can also push updates.

## Paying for a lawyer plan

Lawyers choose a plan on **My profile** and pay one month or one year (FR-018). An
administrator sets each plan's monthly fee on **Plans**; the yearly amount is twelve times
that fee. The same NaloPay prompt is used. Recurring collection is not built (TD-026). An
administrator can grant a month or a year without payment for demonstration. The profile
page checks payment status every few seconds after you send a prompt.

If `EMAIL_HOST` is empty, the server logs messages instead of sending them (local development).

## SMS alerts (when `SMS_*` is configured)

Consultation events above are also texted when the recipient has a phone number on their account. Signup verification and password reset stay email-only. If SMS credentials are blank, the server logs the message instead of sending.

## Common errors

- **Invalid email or password** — check credentials; confirm email if you just registered.
- **Confirm your email before signing in** — use the link or resend from the login screen.
- **AI organisation delayed / needs review** — your words were saved; you can still browse the directory. Matching waits until the enquiry has a confirmed category. This is not a rejection.
- **Cannot reach the API** — ensure Docker/API is running on port 4000.

## Note on AI

AI-assisted results help organise your request and connect you with an appropriate legal professional. They are **not** a substitute for professional legal advice.

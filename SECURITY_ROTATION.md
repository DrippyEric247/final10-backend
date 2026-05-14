# Security Rotation Runbook

Status: **REQUIRED before first production push.**

You asked me to make the app App Store–ready. Phase 2 (production readiness)
cannot be considered done until every secret below has been rotated and moved
out of the repo. The `server/.env` that I saw during this session contained
live eBay production credentials, a weak `JWT_SECRET` literal
(`supersecretchangeme`), and other placeholders. Treat all of those values as
compromised and rotate them.

---

## Rotation checklist

Work through these in order. Each item has:

- **What to do** — the action you take in an external console.
- **Where the new value lives** — always a Railway env var, never a file.
- **How the server knows it happened** — the validator or logs that will
  confirm the rotation.

### 1. Generate a new `JWT_SECRET`

- Run locally:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- Copy the 96-char hex string into Railway → your server service → **Variables**
  → `JWT_SECRET`.
- Do **not** put the new value in `server/.env` in the repo. Local devs can
  keep any random 32+ character string in their own untracked `.env`.
- All existing user sessions will invalidate. That is correct and expected.

### 2. Rotate eBay production credentials

- Go to the eBay developer console → your Final10 app → **Production keyset**
  → regenerate `Cert ID`.
- Update Railway env vars:
  - `EBAY_CLIENT_ID`
  - `EBAY_CLIENT_SECRET`
- If you were not previously setting `FINAL10_REQUIRE_EBAY_APP_CREDENTIALS`,
  set it to `true` in Railway so the server refuses to boot without the new
  credentials.

### 3. Rotate MongoDB URI

- In MongoDB Atlas → Database Access → remove the old DB user used by the
  leaked URI → create a new user with a new password.
- In Network Access, confirm only Railway's egress IPs are allowed.
- Update Railway → `MONGODB_URI` with the new URI (URL-encode the password).

### 4. Rotate Stripe keys (if Stripe is in use)

- Stripe dashboard → Developers → API keys → **Roll secret key**.
- Update Railway:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET` (from the webhook endpoint settings)
  - `STRIPE_PREMIUM_PRICE_ID` (unchanged, but confirm)
- Set `FINAL10_REQUIRE_STRIPE=true` in Railway to block boots without it.

### 5. Rotate OpenAI key (if in use)

- OpenAI dashboard → API keys → revoke the old key → create a new one →
  `OPENAI_API_KEY` in Railway. Lock it to the Final10 project if using
  project keys.

### 6. Rotate SavvyShield secrets

- `SHIELD_API_KEY`, `SHIELD_WEBHOOK_SECRET` — regenerate inside Shield admin,
  update Railway.

### 7. Remove all dev-only bypass flags from Railway

Confirm none of these exist in the server service's env:

- `DISABLE_EBAY_AUTH`
- `ALLOW_PROGRESSION_TRUST_BYPASS`
- `ALLOW_BP_CLIENT_PREMIUM_UNLOCK`

The server now refuses to boot in production if any of these are set
(`server/config/envValidation.js`).

---

## One-time repo hygiene

Do these on your machine, once, after rotation is done:

### Stop tracking `client/.env`

`client/.env` is currently tracked in git. It only contains non-sensitive
base URLs, but we want the same hygiene rule everywhere:

```bash
git rm --cached client/.env
git commit -m "Stop tracking client/.env (now gitignored)"
```

The new root `.gitignore` already covers `.env` and `.env.*` everywhere.

### Delete the local `server/.env` with live secrets

After rotation, wipe the local file and re-create it from the new
`server/.env.example` with placeholder values you trust for local dev:

```bash
rm server/.env
cp server/.env.example server/.env
# edit server/.env locally, NEVER commit it
```

### Optional: strip historical leakage

If the old `server/.env` was ever committed in the past (even on a branch
that was force-pushed), rotate the secrets first (done above) and then
optionally scrub history:

```bash
# Back up the repo first.
pip install git-filter-repo
git filter-repo --path server/.env --invert-paths --force
```

This rewrites history, so you must force-push and every collaborator must
re-clone. Rotation is the real fix — history scrubbing is cosmetic.

---

## Verification

After you finish, restart the Railway service and watch the logs. The
startup report now prints a `[Final10 security checklist]` block. For a
healthy production boot you should see:

- `JWT_SECRET configured: true (length 96…)` — no `PLACEHOLDER DETECTED`.
- `eBay auth bypass: disabled (JWT required)`.
- `Progression trust bypass: enforced (eBay search + bid API issue tokens)`.
- `Battle pass premium self-unlock in production: requires membership / subscription / isPremium`.
- `Stripe secret key: true` (if Stripe is required).

If any secret still looks like a placeholder, the server exits with a
`[security] Environment validation failed` error and Railway will show a
crash loop. That is the guardrail doing its job — rotate the offending
secret and redeploy.

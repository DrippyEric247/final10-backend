# Social Sign-In Setup (Google + Apple)

Final10 supports three ways to sign in:

1. **Continue with Google** (OAuth)
2. **Continue with Apple** (OAuth)
3. **Email / password** (existing, unchanged)

Social buttons only appear when the matching provider is fully configured on the
backend. The client checks `GET /api/auth/providers` and renders only what is
enabled, so you can ship Google first and add Apple later with **zero code
changes** — just set the env vars.

---

## How it works

Authorization Code flow, no client-side OAuth SDK required:

```
[Login/Register page]
   └─ "Continue with Google/Apple"  →  GET  /api/auth/google  (or /apple)
                                          └─ 302 → provider consent screen
[Provider]  →  GET  /api/auth/google/callback   (Google, query)
            →  POST /api/auth/apple/callback     (Apple, form_post)
                 ├─ verify CSRF `state` (stateless signed JWT)
                 ├─ exchange code → provider id_token
                 ├─ verify id_token against provider JWKS (issuer/aud/nonce)
                 ├─ find-or-create / link user (data preserved)
                 ├─ sign our normal 7-day JWT (same as email login)
                 └─ 302 → {CLIENT_URL}/auth/social?token=...&provider=...
[/auth/social page]  →  stores token, calls /api/auth/me, redirects to app
```

- **Same JWT/session** as email login (`jsonwebtoken`, `JWT_SECRET`, `7d`). The
  token lands in `localStorage` (`f10_token`) exactly like email login.
- **CSRF**: the OAuth `state` is a short-lived JWT signed with `JWT_SECRET`
  (no server session/cookie — also survives Apple's cross-site `form_post`).
- **Token validation** is server-side via each provider's JWKS using Node's
  built-in `crypto` (no extra npm dependency).

### Account linking & data preservation

`findOrCreateSocialUser` (`server/services/socialAuthService.js`):

1. **Match by provider id** (`googleId` / `appleId`) → log that user in.
2. **Else match by email** → link the provider to the existing account.
   Only identity fields are touched (`googleId`/`appleId`, `authProviders`,
   `emailVerified`, and `profileImage` if empty). **Nothing else is overwritten:**
   Savvy balance, Battle Pass progress, eggs, Perk Machine history, streaks,
   alerts, calling cards, and subscription tier are all preserved.
3. **Else create** a new account (unique generated username, 100-point signup
   bonus, `provider` set, `referralCode = _id`).

Hidden Apple emails (`@privaterelay.appleid.com`) are stored as-is and treated as
verified. If Apple ever returns no email, a stable placeholder
(`apple_<sub>@users.final10.app`) is used so the account is still unique.

---

## Environment variables

Set these in `server/.env` (local) or the Railway dashboard (production).

### Google

| Var | Example | Notes |
|-----|---------|-------|
| `GOOGLE_CLIENT_ID` | `1234.apps.googleusercontent.com` | OAuth **Web application** client |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-...` | from the same client |
| `GOOGLE_CALLBACK_URL` | `https://api.final10.app/api/auth/google/callback` | must match exactly |

### Apple

| Var | Example | Notes |
|-----|---------|-------|
| `APPLE_CLIENT_ID` | `app.final10.signin` | the **Services ID**, not the app bundle id |
| `APPLE_TEAM_ID` | `ABCDE12345` | 10-char Apple Team ID |
| `APPLE_KEY_ID` | `ABC123DEFG` | Key ID of the Sign in with Apple key |
| `APPLE_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\n...\n-----END...` | `.p8` contents; literal `\n` for newlines, or base64 of the whole file |
| `APPLE_CALLBACK_URL` | `https://api.final10.app/api/auth/apple/callback` | must match a Return URL; **HTTPS only** |

---

## Google Cloud setup

1. [Google Cloud Console](https://console.cloud.google.com/) → create/select a project.
2. **APIs & Services → OAuth consent screen**: set app name, support email, and
   add scopes `openid`, `email`, `profile`. Add test users while in "Testing".
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized redirect URIs**: add your `GOOGLE_CALLBACK_URL`
     (e.g. `http://localhost:5000/api/auth/google/callback` for dev and
     `https://api.final10.app/api/auth/google/callback` for prod).
4. Copy the **Client ID** and **Client secret** into the env vars.

> Google allows `http://localhost` redirect URIs for development.

---

## Apple Developer setup

Apple requires more setup. You need a paid Apple Developer account.

1. **Identifiers → App ID** (if you don't have one): enable the
   **Sign in with Apple** capability.
2. **Identifiers → Services IDs → +**: create a Services ID
   (e.g. `app.final10.signin`). This value is your `APPLE_CLIENT_ID`.
   - Enable **Sign in with Apple**, click **Configure**:
     - **Primary App ID**: your App ID.
     - **Domains and Subdomains**: `api.final10.app` (your API domain).
     - **Return URLs**: add your `APPLE_CALLBACK_URL`
       (`https://api.final10.app/api/auth/apple/callback`). **HTTPS required —
       Apple does not allow `localhost`.** For local testing use an HTTPS tunnel
       (ngrok/Cloudflare Tunnel) and add that URL too.
3. **Keys → +**: create a key, enable **Sign in with Apple**, configure it with
   your Primary App ID, and **download the `.p8` file (once only)**.
   - The **Key ID** shown is your `APPLE_KEY_ID`.
   - The `.p8` contents go in `APPLE_PRIVATE_KEY`.
4. **Membership** page → copy your **Team ID** into `APPLE_TEAM_ID`.

### Putting `APPLE_PRIVATE_KEY` in an env var

Single-line with escaped newlines:

```
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIG...==\n-----END PRIVATE KEY-----\n"
```

Or base64 the whole file and paste the one-liner (the server auto-decodes):

```bash
base64 -w0 AuthKey_ABC123DEFG.p8   # Linux
base64 -i AuthKey_ABC123DEFG.p8    # macOS
```

> The client secret Apple expects is a short-lived ES256 JWT — the server
> generates and signs it automatically from these values
> (`buildAppleClientSecret`). You do **not** create it manually.

---

## Testing checklist

- [ ] Existing **email/password** login still works (unchanged).
- [ ] `GET /api/auth/providers` returns `{ google, apple }` reflecting your env.
- [ ] **Google signup** (new email) creates an account and lands on onboarding.
- [ ] **Google login** (returning) signs into the same account.
- [ ] An **existing email user** signing in with Google links to that account —
      Savvy/Battle Pass/eggs/streaks/subscription all intact.
- [ ] JWT works after social login (refresh keeps you signed in; `/api/auth/me`
      returns your profile).
- [ ] **Cancelled** provider login returns to `/login?error=cancelled` with a
      friendly message.
- [ ] Client build passes (`cd client && npm run build`).
- [ ] (Apple) repeat the above once the Services ID + key are configured.

---

## Files

**Backend**
- `server/config/socialAuthConfig.js` — env reading + `googleEnabled()/appleEnabled()`
- `server/services/oauthJwks.js` — JWKS id_token verification (built-in crypto)
- `server/services/socialAuthService.js` — auth URLs, code exchange, find/create/link
- `server/routes/auth.js` — `/auth/providers`, `/auth/google(+callback)`, `/auth/apple(+callback)`
- `server/models/User.js` — `provider`, `googleId`, `appleId`, `emailVerified`, `profileImage`, `authProviders`

**Frontend**
- `client/src/components/auth/SocialAuthButtons.js` — Google/Apple buttons + divider
- `client/src/pages/SocialAuthCallback.js` — `/auth/social` landing route
- `client/src/context/AuthContext.js` — `completeSocialLogin(token)`
- `client/src/pages/Login.js` / `Register.js` — buttons wired in

---

**Stay Savvy. Stay Smart. The best deals from the start.**

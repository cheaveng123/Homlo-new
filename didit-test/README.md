# Didit test app

A small Node/Express + plain HTML app to evaluate [Didit](https://docs.didit.me). It runs ID/passport verification with passive liveness and face match, then shows the result and the user's age.

```
Browser ──POST /api/start-verification──▶ server ──POST /v3/session/──▶ Didit
   │                                                     (returns url)
   └──redirect to Didit hosted page (scan ID + selfie)──▶ Didit
Didit ──POST /api/webhooks/didit (HMAC signed)──▶ server (verify, dedupe, store summary)
Didit ──redirect /callback?verificationSessionId=…──▶ /result/:sessionId ──▶ GET /api/result/:id
```

Everything was checked against the [integration recipe](https://docs.didit.me/integration/integration-prompt), the [webhooks doc](https://docs.didit.me/integration/webhooks) and [openapi-25.json](https://docs.didit.me/openapi-25.json) on 2026-11-20.

## What it costs

Source: [didit.me/pricing](https://didit.me/pricing), which notes that prices changed on 1 Nov 2026.

| | |
|---|---|
| Free plan | **$10 of credit every month**, no card. This is credit, not a number of free checks. Per the docs index, it only applies to organizations that signed up **with a work email** in the Console. Orgs created through the API start at $0. |
| **Sandbox application** | **Free.** Never billed, 500 sessions per 24 h. All providers are mocked, so results come from a chosen *scenario*, not from your photos. |
| ID Verification (OCR) | $0.15 |
| Passive Liveness | $0.10 |
| Face Match 1:1 | $0.05 |
| Device & IP Analysis | $0.03. **Not free**, so it is left out by default (`--with-ip` adds it). |
| Age Estimation | $0.10, bundled with passive liveness |

A live session with this workflow costs about **$0.30**, so $10 covers roughly 33 completed live checks per month. Creating sessions and workflows, and reading decisions, are not listed as billable. Didit's wording is "pay only for the checks that finish".

## Setup

1. **Console account.** Sign up at [business.didit.me](https://business.didit.me). If you want the $10 credit, use a work email. You do this step yourself; this app creates no accounts.
2. **Pick an application.** Use a **sandbox** application to start: it is free and gives deterministic results. Switch to a live application only for the real-photo tests below.
3. **API key.** Console → API & Webhooks → copy the key into `DIDIT_API_KEY`.
4. **Expose localhost.** Didit only delivers webhooks to HTTPS URLs.
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
   That needs no account. Alternatively run `ngrok http 3000`, which needs a free ngrok account. Put the https URL in `PUBLIC_BASE_URL`.
5. **Webhook destination.** Console → API & Webhooks → *Add destination*:
   - URL: `https://<your-tunnel>/api/webhooks/didit`
   - Version: `v3`
   - Events: `status.updated` and `data.updated`
   - Copy the destination's **`secret_shared_key`** into `DIDIT_WEBHOOK_SECRET`. This is not the API key.
   - If your application has *allowed domains* set, add your tunnel URL, or session creation fails with 400 on `callback`.
6. **Workflow** (features OCR → LIVENESS (passive) → FACE_MATCH). You have two options:
   - **API:** `npm run create-workflow`, which calls `POST /v3/workflows/`, then copy the printed `DIDIT_WORKFLOW_ID`. Add `-- --with-ip` to include IP analysis.
   - **Console:** Workflows → New → KYC template. Keep *ID Verification*, *Liveness Detection* set to **Passive**, and *Face Match*. Remove AML and the other add-ons, publish, then copy the workflow ID.
   - Either way, allow **desktop** if you want to test from a laptop webcam. The API default is `is_desktop_allowed: false`.
7. Run:
   ```bash
   cp .env.example .env   # then fill it in
   npm install
   npm test               # offline unit tests
   npm start              # http://localhost:3000, but open it via your tunnel URL
   ```

### Environment variables

| Name | What |
|---|---|
| `DIDIT_API_KEY` | Application API key, sent as `x-api-key`. Server only. |
| `DIDIT_WEBHOOK_SECRET` | Webhook destination `secret_shared_key`. |
| `DIDIT_WORKFLOW_ID` | Workflow `workflow_id`, the stable ID across versions. |
| `PUBLIC_BASE_URL` | Your tunnel URL. The callback is `<this>/callback`. |
| `DIDIT_ENV` | `sandbox` shows a scenario picker. `live` hides it and warns about credits. |
| `PORT` | Default 3000. |

## How it maps to Didit

- **Start:** `POST https://verification.didit.me/v3/session/` with `workflow_id`, `vendor_data`, `callback`, `callback_method: "both"` and `metadata`.
  - `vendor_data` is a server-assigned test user ID stored in an httpOnly cookie. Didit's recipe says never to take it from the request body.
  - The browser only receives `session_id` and `url`. `session_token` is meant for the native SDKs and is kept server-side.
- **UI:** the browser is redirected to `url`, as the create-session docs recommend. An iframe also works if you give it `allow="camera; microphone; geolocation; clipboard-write; fullscreen; autoplay; encrypted-media; digital-credentials-get"`.
- **Webhook:** the handler reads the raw body and checks `X-Timestamp`. It rejects the request if the timestamp is more than 300 s off, then verifies the HMAC-SHA256 signature:
  - First it tries **`X-Signature-V2`** (canonical JSON: sorted keys, compact, Unicode kept).
  - Then it tries `X-Signature` (raw bytes).
  - The deprecated `X-Signature-Simple` is **not** accepted, because it does not sign `decision`.
- **Webhook processing:**
  - Duplicate deliveries are dropped by `event_id`.
  - Events older than the stored `created_at` are ignored.
  - An event is ignored if its `vendor_data` does not own the session.
  - The handler returns 401 on a bad signature and 200 once handled.
- **Decision:** read from the webhook's `decision`. As a fallback (webhook missing, or `data.updated`), the app calls `GET /v3/session/{id}/decision/`.
  - The feature results are **arrays**: `id_verifications[]`, `liveness_checks[]`, `face_matches[]`, `ip_analyses[]`. The app shows the first entry of each.
- **Statuses:**
  - Session: `Approved`, `Declined` and `In Review`, plus `Not Started`, `In Progress`, `Awaiting User`, `Resubmitted`, `Expired`, `Kyc Expired` and `Abandoned`.
  - Per feature: `Not Finished`, `Approved`, `Declined`, `In Review`, and `Resub Requested` or `Expired`.
- **Age:** computed from `id_verifications[0].date_of_birth` in UTC, plus an `isAdult` (18+) flag. Didit's own `age` field is shown next to it, and a mismatch adds a warning.
- **Privacy:** only text fields are copied into memory. Image and video URLs from the decision are dropped. Logs contain only `event_id`, the session ID, the status and the webhook type.

### Didit's dedicated age products

- **Age Estimation** ($0.10, selfie-based, bundled with passive liveness). The docs give a mean error of about 1.1–1.9 years around ages 16–20.
  - In a workflow it is the `AGE_ESTIMATION` feature, and the result appears as `liveness_checks[].age_estimation`.
  - The result page shows it under "Estimated from selfie" when present.
- **"Adaptive Age Verification"** workflow template: estimates age from the selfie and falls back to an ID check for borderline ages.
- This app uses the date of birth from the ID as the source of truth, as requested.

## Test plan

### A. Sandbox (free, mocked outcomes)
Set `DIDIT_ENV=sandbox` with a sandbox API key. Pick each scenario on the home page, complete the flow (any photo works, since results are mocked), and check the result page against this table:

| Scenario | Expect |
|---|---|
| approve (default) | Approved, sample data filled in, 18+ = Yes |
| `decline_document_expired` | Declined; ID verification Declined; expiry warning |
| `decline_minimum_age` | Declined; age about 10; 18+ = No |
| `decline_face_match_low_similarity` | Declined; Face match Declined; `LOW_FACE_MATCH_SIMILARITY` |
| `review_face_match_borderline` | In Review |
| `decline_liveness_attack` | Declined; `LIVENESS_FACE_ATTACK` |
| `decline_could_not_recognize_document` | Declined; empty document fields |

Webhook checks:
- In Console → API & Webhooks, use **Try Webhook**. The terminal should log `[webhook] status.updated … via=X-Signature-V2`.
- Resend the same event. It should be answered `duplicate: true` and leave the stored result unchanged.
- Send a forged request. It should get a 401:
  ```bash
  curl -i -X POST https://<tunnel>/api/webhooks/didit -H "X-Timestamp: $(date +%s)" -H "X-Signature-V2: deadbeef" -d '{}'
  ```
- Clear `DIDIT_WEBHOOK_SECRET` and restart. Real webhooks are now rejected, but the result page still fills in through the API fallback.

### B. Live (uses credits, about $0.30 per completed session)
Real photos only matter here. Switch to a live application key and set `DIDIT_ENV=live`. Expect to use about 6–8 sessions.

1. **Happy path.** Use your own passport or ID, in good light, with a live selfie. Expect Approved, correct name, DOB, document number, expiry and nationality, the right age and 18+ flag, and Liveness and Face match Approved with scores.
2. **Blurry photo.** Move the document while capturing. Expect the hosted UI to ask for a retake. If it is forced through, expect a document or quality warning, or Declined/In Review.
3. **Photo of a screen.** Show your ID on a phone or monitor to the camera. Expect a document-liveness or screen warning, and Declined or In Review.
4. **Printed face photo.** Hold a printed photo up for the selfie step. Expect a liveness failure (spoof/attack warning). Passive liveness is iBeta Level 1; ACTIVE_3D is stricter if this gets through.
5. **Expired document.** Use an expired ID if you have one. Expect a Didit warning plus this app's `DOCUMENT_EXPIRED` check.
6. **Mismatched face.** Use your document but someone else's live selfie, with their consent. Expect Face match Declined or In Review and a low score.

For each case, record the session status, feature statuses, scores and warnings shown.

## Things I could not confirm from the docs

- **Free credit eligibility:**
  - The "$10 for work-email signups only" condition comes from the docs index, not the pricing page itself.
  - Whether a Gmail signup gets the credit is not stated.
  - The docs index also lists older standalone prices ($0.20 ID, $0.05 liveness) that conflict with the pricing page. The pricing page figures are used here.
- **Warning enums:** `warnings[].log_type` and `risk` have no full enum in the spec, only examples (`information`, `warning`, `LOW_FACE_MATCH_SIMILARITY`, …). The app shows them as text.
- **`liveness_checks[].method` values:** the spec types it as a free string. Examples are `PASSIVE` and `ACTIVE_3D`.
- **Canonical JSON for floats:** Didit's V2 canonical form is built in Python. A non-whole float with an unusual repr (e.g. `1e-07`) might stringify differently in JS. The raw-body `X-Signature` fallback covers that case.
- **Exact billing trigger:** it is not documented whether an abandoned live session that reached the selfie step is charged.
- **Workflow creation:** the `POST /v3/workflows/` request schema is in the spec, but this app has not been run against it. The Console path is the safe fallback.

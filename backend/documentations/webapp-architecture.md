# Webapp architecture — hosting, infra, and stack

A short tour of where Pipeline runs, how the pieces are deployed, and the
languages and frameworks in use.

## Hosting

| Concern | Choice |
|---|---|
| Cloud provider | Google Cloud Platform |
| Project | `tmls-agentic-hackathon` |
| Region | `northamerica-northeast2` (Toronto) |
| Compute | Two Cloud Run services (frontend + backend) |
| Build pipeline | Cloud Build, triggered by `gcloud run deploy --source .` |
| Storage | Google Cloud Storage bucket `gs://tmls-pipeline` (JSON state files) |
| Secrets | Google Secret Manager (`openai-api-key`) |
| Runtime identity | Service account `gcs-pipeline@tmls-agentic-hackathon.iam.gserviceaccount.com` |

The backend authenticates to GCS using Application Default Credentials via
the runtime service account — no key file is shipped in the container.
The frontend is deployed second so its `API_URL` can be set to the
backend's Cloud Run URL.

## Stack

### Frontend

- **Framework:** Next.js 14.2 (App Router), TypeScript, standalone output.
- **Runtime:** Node.js 20 (Cloud Run, `node server.js`).
- **Port:** 8080 (Cloud Run injects `PORT`).
- **API URL.** `app/page.tsx` (and the other pages) set
  `export const dynamic = "force-dynamic"` so `API_URL` is read per
  request — the deployed backend URL can change without rebuilding the
  frontend image.

### Backend

- **Framework:** FastAPI on Uvicorn.
- **Language:** Python ≥ 3.11, dependencies managed with `uv`.
- **Port:** 8080 (Cloud Run injects `PORT`; locally 8000).
- **Key dependencies:**
  - `fastapi`, `uvicorn` — HTTP and WebSocket surface.
  - `openai` — direct OpenAI calls (triage classifier, Whisper, Realtime).
  - `agent-framework-openai` (Microsoft Agent Framework) — conversation
    agent with function-calling tools.
  - `google-cloud-storage` — persistence of conversation state and LLM
    logs.
  - `python-dotenv` — loads `backend/.env` for local development.

### Local dev ports

| Service | Local port |
|---|---|
| Backend (uvicorn) | 8000 |
| Frontend (`next dev`) | 3000 |

In production both Cloud Run services listen on 8080.

## Architecture diagram

The flow of a single customer request, in production:

```
                          +---------------------+
                          |  Customer browser   |
                          |   (Next.js client)  |
                          +---------+-----------+
                                    |
                                    | HTTPS / WSS
                                    v
                       +------------+------------+
                       |     Cloud Run           |
                       |  frontend (Next.js)     |
                       |  northamerica-ne2:8080  |
                       +------------+------------+
                                    |
                                    | fetch(`${API_URL}/api/...`)
                                    v
                       +------------+------------+
                       |     Cloud Run           |
                       |   backend (FastAPI)     |
                       |  northamerica-ne2:8080  |
                       +---+----+----+----+------+
                           |    |    |    |
              +------------+    |    |    +-------------+
              |                 |    |                  |
              v                 v    v                  v
        +-----------+    +----------+----------+   +----------------+
        |  OpenAI   |    |  Google Cloud      |   |    Google      |
        |  REST +   |    |  Storage           |   |    Secret      |
        |  Realtime |    |  gs://tmls-pipeline|   |    Manager     |
        |   (TLS)   |    |  state / llm log / |   |  openai-api-key|
        |           |    |  index             |   |                |
        +-----------+    +--------------------+   +----------------+
```

Notes on the diagram:

- All outbound calls from the backend are HTTPS.
- The backend's identity is the `gcs-pipeline@...` service account; GCS
  and Secret Manager IAM bindings are scoped to it.
- The frontend never talks to OpenAI or GCS directly — every model and
  storage call goes through the backend.
- The voice channel uses the same backend service over WSS (see the
  *Voice agent* section).

## Deployment commands (short version)

For full details see `deploy_prod.md` and `deploy_test.md` at the repo
root. Typical update loop:

```bash
# Backend first (its URL feeds API_URL of the frontend).
cd backend
gcloud run deploy backend --source . --region northamerica-northeast2 \
  --service-account gcs-pipeline@tmls-agentic-hackathon.iam.gserviceaccount.com \
  --set-secrets OPENAI_API_KEY=openai-api-key:latest \
  --set-env-vars OPENAI_MODEL=gpt-4o-mini,GCS_BUCKET=tmls-pipeline,GCS_PREFIX=interactions

# Then the frontend, pointing at the backend's URL.
cd ../frontend
gcloud run deploy frontend --source . --region northamerica-northeast2 \
  --set-env-vars API_URL=https://backend-...run.app
```

`deploy_test.md` covers per-branch preview deploys that share the same
service account, secret, and bucket but use branch-suffixed service names
and `GCS_PREFIX` values.

## What is intentionally simple

- **No database.** State lives in JSON files on GCS. NFR-12 in the spec
  notes that this assumes a single concurrent conversation; the hackathon
  demo respects that constraint.
- **No auth.** Single-contractor demo context. There is no login, no
  multi-tenant, no per-user data partitioning.
- **No CI/CD beyond `gcloud run deploy --source .`.** Cloud Build is
  triggered ad-hoc from a developer machine for the hackathon.

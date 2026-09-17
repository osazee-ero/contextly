# Contextly

**A deployed document Q&A application with answers you can trace to a PDF and page.**

Upload PDFs, ask questions, and inspect the evidence behind each answer. Contextly combines hybrid retrieval with authenticated document ownership, persistent conversations, usage limits, and cloud deployment.

[Live application](https://contextly.osazeeero.com) | [Deployment guide](docs/UPDATE.md) | [Retrieval evaluation](backend/evaluation/evaluate_retrieval.py) | [Regression tests](backend/tests/test_regressions.py)

![Contextly chat with document citations](docs/images/chat.png)

## What this project demonstrates

- **RAG engineering:** page-aware text extraction, chunking, semantic search, PostgreSQL full-text search, and Reciprocal Rank Fusion.
- **Application engineering:** Next.js frontend, FastAPI backend, Clerk authentication, and PostgreSQL persistence.
- **Reliability:** actionable PDF failure messages, retry processing, signup recovery, and question/answer transactions with quota refunds on failure.
- **Deployment:** Vercel frontend; Dockerized API on AWS ECS Fargate; RDS/pgvector and private S3 storage.
- **Evaluation:** separate retrieval and citation checks, plus regression coverage for account isolation and failure recovery.

## Try it

1. Sign up at the [live application](https://contextly.osazeeero.com).
2. Upload a PDF with selectable text and wait for **Ready**.
3. Ask a question answered in the document.
4. Inspect the returned document and page citations.

The current limits are 10 documents, 100 MB total storage, 10 MB per PDF, and 20 questions per day. The daily quota resets at midnight UTC. Scanned PDFs need OCR before upload; Contextly does not perform OCR.

<details>
<summary>More screenshots</summary>

![Landing page](docs/images/landing.png)
![Dashboard](docs/images/dashboard.png)
![Document management](docs/images/documents.png)

</details>

## Architecture

```mermaid
flowchart LR
    Browser[Next.js on Vercel] --> Clerk[Clerk authentication]
    Browser -->|HTTPS and session token| ALB[Application Load Balancer]
    ALB --> API[FastAPI on ECS Fargate]
    API --> Clerk
    API --> DB[(RDS PostgreSQL and pgvector)]
    API --> Storage[(Private S3 bucket)]
    API --> OpenAI[OpenAI API]
```

**Ingestion:** validate PDF, save file, extract text and page numbers, split text, embed in batches, and store chunks. Failed processing retains an explanation and can retry the saved file.

**Question answering:** retrieve semantic and lexical candidates, combine rankings using RRF, supply the selected evidence to the model, validate citation references, and save the question and answer together.

Current defaults use 1,200-character chunks with 200-character overlap and `text-embedding-3-small`. The retrieval pipeline merges two candidate lists with RRF (`K=60`) and returns up to five chunks. See [retrieval.py](backend/app/services/retrieval.py) and [answer_generation.py](backend/app/services/answer_generation.py) for the exact selection and citation logic.

## Evaluation and verification

The repository includes a 30-question dataset mapping questions to expected filenames and pages. Previously reported project results are preserved below; they were **not rerun during the README cleanup**.

| Measure | Reported result |
| --- | ---: |
| Recall@1 | 63.33% |
| Recall@3 | 86.67% |
| Recall@5 | 86.67% |
| Mean Reciprocal Rank | 0.7444 |
| Answer generated successfully | 96.67% |
| Expected-page citation match | 86.67% |

These are a small project-specific baseline, not a general benchmark. Citation matching checks whether an expected document/page appears; it does not establish factual correctness of the entire answer.

To reproduce evaluation, load the matching source PDFs into your development account, adjust `EVAL_USER_EMAIL` in each evaluation script, and review [dataset.json](backend/evaluation/dataset.json). Then run from `backend`:

```bash
python -m evaluation.evaluate_retrieval
python -m evaluation.evaluate_answers
```

These scripts call the configured OpenAI services and require indexed documents. Results depend on the documents, model configuration, and current code.

The September 2026 reliability update passed **17 backend integration tests** and **10 Playwright browser tests**. Backend tests use disposable local PostgreSQL with mocked Clerk/OpenAI; browser tests use component fixtures with mocked authentication and API responses. They are not full live-provider end-to-end tests. Local database setup and commands are in the [release guide](docs/UPDATE.md#local-verification).

## Run locally

Use Docker for PostgreSQL and run the API and frontend locally. This avoids the existing Compose backend's AWS credential mount and separate deployment configuration.

Prerequisites: Docker Desktop, Python 3.12, Node.js compatible with Next.js 16, a Clerk development application, and an OpenAI API key with access to the configured models.

```bash
git clone https://github.com/osazee-ero/contextly.git
cd contextly
```

1. Copy the root `.env.example` to `.env` and set the local PostgreSQL values. Start only the database:

```bash
docker compose up -d db
```

2. Create `backend/.env` with the following settings. Substitute the database values from the root `.env`; the exposed database port is **5433**.

```dotenv
DATABASE_URL=postgresql+psycopg://contextly:change_me@localhost:5433/contextly
FRONTEND_URL=http://localhost:3000
STORAGE_BACKEND=local
OPENAI_API_KEY=your_openai_key
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

The chat model defaults to the value in [config.py](backend/app/core/config.py); use `OPENAI_CHAT_MODEL` in `backend/.env` to select a model your account can access.

3. Set up and start the backend:

```bash
cd backend
python -m venv .venv
```

Activate it with `source .venv/bin/activate` on macOS/Linux, or `.venv\Scripts\Activate.ps1` in PowerShell. Then:

```bash
python -m pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

4. In another terminal, create `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
```

Use keys from the same Clerk development application, with localhost configured for development. From `frontend`:

```bash
npm ci
npm run dev
```

Open http://localhost:3000. API documentation is at http://localhost:8000/docs. Keep credentials in ignored environment files.

## Engineering choices and current limits

- **One database for retrieval and application state:** PostgreSQL provides vector search, lexical search, conversations, and ownership-scoped queries.
- **Evidence before generation:** citations expose source passages for inspection; retrieval and generation can still be wrong.
- **Server-enforced limits:** upload quota checks are serialized per user; failed chat requests roll back partial messages and refund their reserved question.
- **Background ingestion:** FastAPI background tasks are not durable across process termination. A worker queue is needed for guaranteed recovery during deployment or shutdown.
- **PDF scope:** no OCR or additional document formats yet.
- **Operational visibility:** request IDs, structured application logs, and bounded in-process timing samples. Metrics reset when the process restarts.

## Repository map

| Path | Purpose |
| --- | --- |
| `backend/app/` | API routes, database models, ingestion, retrieval, generation |
| `backend/alembic/` | Database migrations |
| `backend/evaluation/` | Dataset and retrieval/answer evaluation scripts |
| `backend/tests/` | Local database regression tests |
| `frontend/src/` | Next.js application |
| `frontend/tests/` | Playwright component-fixture browser checks |
| `docs/UPDATE.md` | ECR image, ECS migration, backend rollout, and frontend verification |

## Deployment

The frontend deploys through Vercel; a GitHub push does not deploy the ECS backend. Follow [docs/UPDATE.md](docs/UPDATE.md), including the database migration **before** updating the backend service.

Built by [Osazee Ero](https://github.com/osazee-ero), AI & Machine Learning Engineer.

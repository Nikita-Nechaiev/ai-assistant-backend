# AI-Editor Portfolio — Backend

This is the server part of my portfolio project: live collaborative editing for documents plus built-in AI tools. Users sign in with email/password or Google, work together in sessions, use chat, manage access by roles, see version history and use ai assistance.

**Goal:** show a real, production-level solution — deployed, tested, with clear architecture and stable behavior — not just a simple pet project.

## 1) Title & one-liner

**AI-Editor Portfolio — Backend**  
NestJS + PostgreSQL + WebSocket. Authentication, roles & access, real-time sessions, document versions, chat, and AI actions.

## 2) Quick links

- **Production API:** https://ai-assistant-backend-fsdp.onrender.com
- **WebSocket:** https://ai-assistant-backend-fsdp.onrender.com/collaboration-session-socket
- **Health:** `<https://ai-assistant-backend-fsdp.onrender.com/health>`
- **Frontend:** https://www.ai-editor-portfolio.com
- **Demo (Loom):** <URL>
- **Repository:** <URL>

## 3) For Recruiters & CTO (30 seconds)

- **What it shows.** A working backend with auth, roles, live collaboration, chat, versions, and AI features — the building blocks you see in real products.
- **Stack.** NestJS, TypeScript, PostgreSQL, WebSocket, TypeORM, JWT, SMTP (email), Google OAuth 2.0, OpenAI integration (keys are in environment variables).
- **Quality.** Unit and e2e tests, coverage `<>%`. Checks run automatically on every PR.
- **Reliability.** Average latency `<> ms`, uptime `<>%`. Structured logs and basic metrics are in place.

## 4) Why it matters

Most demos stop at CRUD. Here you also get role-based access, real-time editing via WebSocket, version history, 2-token based authentication, email notifications, Google sign-in, and AI actions right inside the document.  
This reduces hiring risk: you can see how I model data, secure access, write tests, and ship features to production.

## 5) Architecture (short)

The frontend talks to the API and connects to a WebSocket channel. Data lives in PostgreSQL. For AI actions, the backend calls an AI provider.

FrontEnd (Next.js) -- REST/WS --> API(NestJS)
API -- SQL --> DB(PostgreSQL)
API -- AI calls --> AI(OpenAI)
FrontEnd(Next.js) <-- realtime --> API

- **REST:** auth, documents, versions, sessions, ai-tools, email notifications.
- **WebSocket:** live editing, session status, chat, ai-tools, invitations.
- **AI:** actions to work with text (translate, rephrase, etc.).

## 6) Modules

- **Auth** — email/password with tokens (access/refresh), Google sign-in (`/auth/google/callback`), password reset via email.
- **Users** — user profile and basic fields.
- **Collaboration-session** — create/join/leave a collaboration session.
- **User-collaboration-session** — create/join/leave. roles per collaborator, track session time (`timeSpent`).
- **Documents** — CRUD document operations, content stored in Quill-compatible format (json/delta), export `<EN-only>`.
- **Versions** — full history and restore to any document version.
- **Invitations** — invite to a session with a role (admin / editor / viewer), invitation statuses.
- **Messages** — real-time chat within a session.
- **Ai-tools-usage** — a set of AI actions (e.g., translate, rephrase) with basic limits.
- **Token** — validate, save, generate Jwt tokens.

## 7) Security & privacy

- **Auth:** tokens (access/refresh). Secrets and keys are stored only in environment variables on the hosting side.
- **Access:** three roles — admin, editor, viewer; actions are restricted by role.
- **Input checks:** all public requests are validated (both REST and WebSocket).
- **Protection:** rate limits on sensitive routes, brute-force protection, CORS allowed only from the trusted frontend domain `https://www.ai-editor-portfolio.com`.
- **Email:** notifications and password reset via SMTP (Gmail).
- **OAuth:** secure callback URLs for Google sign-in.

## 8) Tests

- **Types:**

  - Unit (Jest).
  - e2e (Supertest for REST, mocked server for WebSocket).

- **Coverage:** 97% (statements), 82% (branches), 95% (functions), 98% (lines). Enforced in CI.

- **What’s covered:**

  - Registration, login, token refresh, password reset; protection of private routes.
  - Role-based permissions on key flows.
  - Documents (create/update/export), Versions (view/restore).
  - Sessions (create/join/leave, time tracking).
  - Invitations (send/accept/decline).
  - Chat messages (delivery, error handling).
  - WebSocket events (payload shape, error handling).
  - AI calls are stubbed/mocked for stable tests.
  - Database work — transactions and consistency in critical scenarios.

- **Summary:**

  - Unit: 29 suites, 249 tests, all passed (time ~7s).
  - e2e: 8 suites, 30 tests, all passed (time ~3.8s).

- **When it runs:** on every PR and the `main` branch; CI publishes coverage & test summary.

## 9) Checks & auto-deploy (CI/CD)

- **Pipeline:** `lint → unit → e2e → build → DB migrations → deploy`.
- **Environments:** `<dev / stage / prod>` (separate env vars).
- **Releases:** versioning and quick rollback to a previous build `<>`.

## 10) Deployment & hosting

- **Where it runs:** Render (`ai-assistant-backend-fsdp`), auto-deploy from `main`.
- **Database:** PostgreSQL (`<provider/plan>`).
- **Domains:** API — `ai-assistant-backend-fsdp.onrender.com`, frontend — `ai-editor-portfolio.com`.
- **Ports & health:** the app listens on `<10000>` (hosting may override via ENV), health — `<GET /health>`.

## 11) Roadmap & current limitsз

**Coming soon:**

- Multi-language export (`<languages>`).
- Finer request limits by role.
- AI metrics (per-function latency, token usage) and a small monitoring panel.
- Better conflict resolution for concurrent editing.

**Current limits:**

- Export: `<EN-only>`.
- Some AI actions have input size limits `<N>` (chars/tokens).
- Some editing bugs are caused by the deprecated techniques of the Quill editor
- Public Swagger/OpenAPI docs are intentionally not included here.

## 15) Contacts

- **Name:** Nikita Nechayev
- **Email:** mykyta.nechaiev.dev@gmail.com
- **Telegram:** @nechaiev_mykyta
- **LinkedIn:** https://www.linkedin.com/in/mykyta-nechaiev-48b776358/

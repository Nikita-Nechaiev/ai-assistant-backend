# AI Editor — Backend

The NestJS backend for **Mykyta Nechaiev's developer portfolio project**. It provides cookie-based authentication, shared document sessions, participant presence, chat, invitations, document versions, AI tools, and dashboard statistics backed by PostgreSQL.

## Links

- [Live application](https://www.ai-editor-portfolio.com)
- [Portfolio presentation](https://canva.link/muceodsr6ld2q5q)
- [Production API](https://api.ai-editor-portfolio.com)
- [Health endpoint](https://api.ai-editor-portfolio.com/health)
- [Frontend repository](https://github.com/Nikita-Nechaiev/ai-assistant-frontend)
- [Backend repository](https://github.com/Nikita-Nechaiev/ai-assistant-backend)

## Stack and architecture

NestJS 10, TypeScript, PostgreSQL, TypeORM, Socket.IO, Passport/JWT, bcrypt, Nodemailer, and the OpenAI SDK.

The frontend uses HTTP for authentication, session creation/listing, profile updates, standalone AI requests, history, statistics, and CV downloads. Socket.IO handles session membership, participant status, document operations, version history, chat, invitations, and document AI requests. AI requests are executed by the backend; the OpenAI key stays on the server.

Socket.IO connects to the API origin with **`path: '/collaboration-session-socket'`**. This is a transport path, not a namespace or a `/ws` endpoint. For example:

```ts
io('http://localhost:3002', {
  path: '/collaboration-session-socket',
  transports: ['websocket'],
  withCredentials: true,
});
```

## Modules

| Module                       | Responsibility                                                               |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `auth`                       | Registration, login/logout, cookie refresh, Google OAuth, and password reset |
| `token`                      | JWT generation/validation and persisted refresh-token rotation               |
| `user`                       | Profiles, avatars, and user records                                          |
| `collaboration-session`      | Session creation/listing, real-time session operations, and presence         |
| `user-collaboration-session` | Membership, permissions, and recorded session time                           |
| `document`                   | Quill-compatible content, document operations, and document AI socket events |
| `version`                    | Version snapshots, retrieval, and restoration                                |
| `invitation`                 | Invitations, notification state, and invitation socket events                |
| `messages`                   | Session chat persistence                                                     |
| `ai-tool-usage`              | Nine AI actions, saved request/result history, and AI usage statistics       |
| `statistics`                 | Dashboard totals and daily activity, calculated on the backend               |
| `public-info`                | Public CV download at `GET /public-info/cv`                                  |
| `file`                       | Uploaded file storage                                                        |
| `email`                      | SMTP delivery for password-reset emails                                      |
| `health`                     | `GET /health`                                                                |
| `common`                     | Shared permissions, session state/context, decorators, and utilities         |

PDF document export runs in the **frontend**. The PDF bundled under `src/public-info/assets/` is the author's CV and is copied into the build by `nest-cli.json`.

`GET /statistics/dashboard` returns ready-to-display totals, a duration label, and 30 daily activity entries. Documents are counted across sessions the user currently belongs to; activity counts document creation dates and that user's AI requests, not document views or edits. Session time is the recorded membership time. Created/joined session counts are classified by the presence of Admin permission. Invitations are excluded from these statistics.

## Local setup

Use **Node.js 20**, npm, and a running PostgreSQL instance. Node 20 matches CI; CI uses PostgreSQL 15 for backend tests, while the included local test container uses PostgreSQL 16.

```sh
npm ci
```

Create a local PostgreSQL database named `ai_editor`, then create `.development.env` in this repository:

```dotenv
FRONTEND_URL=http://localhost:3000

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=replace-with-your-local-password
POSTGRES_DB=ai_editor

JWT_ACCESS_SECRET=replace-with-a-long-random-access-secret
JWT_REFRESH_SECRET=replace-with-a-different-long-random-refresh-secret

GOOGLE_CLIENT_ID=replace-with-your-google-client-id
GOOGLE_CLIENT_SECRET=replace-with-your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3002/auth/google/callback

OPENAI_API_KEY=replace-with-your-openai-api-key

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=replace-with-your-smtp-user
SMTP_PASSWORD=replace-with-your-smtp-password
SMTP_FROM="AI Editor <replace-with-your-sender-address>"
```

```sh
PORT=3002 npm run start:dev
```

The command sets `NODE_ENV=development`; the API is available at [localhost:3002](http://localhost:3002). Set both frontend API/socket variables to this origin. Without a `PORT` environment variable, the server defaults to **5000**. The command above supplies `PORT` explicitly; set it in the hosting environment for deployment as well.

Register the Google callback URL in your OAuth client to use Google sign-in. Google strategy initialization requires client configuration; placeholder values do not enable OAuth. Real AI requests need a valid OpenAI key, and password-reset delivery needs working SMTP credentials. The current SMTP transporter uses implicit TLS (`secure: true`), normally on port 465; changing only the port does not configure a plain SMTP server.

Keep local env files out of Git. Uploaded avatars are stored in `uploads/`, served at `/uploads`, and are not included in the repository.

## Environment and database configuration

`ConfigModule` selects the file based on `NODE_ENV`:

| `NODE_ENV`                           | File               |
| ------------------------------------ | ------------------ |
| `development`                        | `.development.env` |
| `test`                               | `.test.env`        |
| Other values, including `production` | `.production.env`  |

Values already supplied through the process environment take precedence. The production start command below explicitly supplies `NODE_ENV`.

- `DATABASE_URL`, when present, takes precedence over separate database variables.
- Without `DATABASE_URL`, development/production use `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`.
- Tests without `DATABASE_URL` use `PG_HOST`, `PG_PORT`, `PG_USER`, `PG_PASS`, and `PG_DB` (defaults: `localhost`, `5433`, `test`, `test`, `myapp_test`).
- For `DATABASE_URL`, `DB_SSL_MODE` accepts `auto` (default), `require`, or a value such as `disable` to turn SSL off. In auto mode, URLs containing `localhost`, `127.0.0.1`, or `internal` do not use SSL. Enabled SSL currently sets `rejectUnauthorized: false`.
- TypeORM currently uses **`synchronize: true`**, including production. There is no migration command or migration step in CI.

## Commands

| Command                                  | Purpose                                                    |
| ---------------------------------------- | ---------------------------------------------------------- |
| `npm run start:dev`                      | Watch mode with `NODE_ENV=development`                     |
| `npm run build`                          | Compile NestJS and copy configured assets                  |
| `npm run build:clean`                    | Remove build/cache output and rebuild                      |
| `NODE_ENV=production npm run start:prod` | Run `dist/main.js` using production configuration          |
| `npm start`                              | Start through Nest CLI with `NODE_ENV=production`          |
| `npm run lint`                           | ESLint, with zero warnings allowed                         |
| `npm run lint:fix`                       | Apply ESLint fixes                                         |
| `npm test`                               | Jest unit tests                                            |
| `npm run test:watch`                     | Jest watch mode                                            |
| `npm run test:cov -- --runInBand`        | Unit tests and coverage                                    |
| `npm run docker:pg:test`                 | Start the local disposable PostgreSQL test container       |
| `npm run test:e2e`                       | Backend HTTP/socket integration tests with `NODE_ENV=test` |

## Authentication and security boundaries

Email/password login sets **HttpOnly access and refresh cookies**. Access tokens expire after 15 minutes; refresh tokens after 30 days. Passwords are hashed with bcrypt. Refresh tokens are persisted and rotated. Google OAuth and email-based password reset are also implemented.

In production, cookies are `Secure` and scoped to `.ai-editor-portfolio.com`. Email/password cookies use `SameSite=Strict`; the Google callback uses `Lax`. Deployments on another domain require corresponding cookie configuration changes. HTTP and Socket.IO CORS use `FRONTEND_URL` with credentials enabled. Helmet is enabled for HTTP responses.

JWT guards protect selected HTTP controllers; permission checks are applied to selected session socket actions. These mechanisms should not be read as a claim that every endpoint has identical protection. DTO validation decorators exist, but the production bootstrap currently does **not** install a global `ValidationPipe`. Rate limiting and brute-force protection are **not implemented**. There is no configured application metrics pipeline or documented uptime/latency guarantee.

## Tests

Unit tests use Jest. `jest.config.ts` enforces **81% minimum coverage for statements, branches, functions, and lines** on its configured unit-test scope. Generate current results with `npm run test:cov`; reports are written to `coverage/`. This threshold is not a combined unit/e2e coverage measurement.

Backend e2e tests combine HTTP requests through Supertest and real Socket.IO connections. Some load the application with PostgreSQL, while gateway-focused tests replace services with stubs. External AI calls are mocked in the relevant tests. Test bootstraps may configure validation independently of `src/main.ts`.

Use a **disposable test database**. The test configuration without `DATABASE_URL` sets `dropSchema: true`; test runs can erase that database's schema. Even with `DATABASE_URL`, tests write data and schema synchronization remains enabled. Never point them at production or showcase data.

Start the included test database:

```sh
npm run docker:pg:test
```

Create `.test.env` with test-only values:

```dotenv
PG_HOST=localhost
PG_PORT=5433
PG_USER=test
PG_PASS=test
PG_DB=myapp_test
JWT_ACCESS_SECRET=test-access-only
JWT_REFRESH_SECRET=test-refresh-only
GOOGLE_CLIENT_ID=test-client
GOOGLE_CLIENT_SECRET=test-secret
GOOGLE_CALLBACK_URL=http://localhost:3002/auth/google/callback
FRONTEND_URL=http://localhost:3000
OPENAI_API_KEY=test
SMTP_HOST=localhost
SMTP_PORT=465
SMTP_USER=test
SMTP_PASSWORD=test
```

The placeholder provider credentials are for automated tests, not real Google, AI, or email requests. Ensure an inherited `DATABASE_URL` does not override the disposable database settings, then run:

```sh
npm run test:cov -- --runInBand
npm run test:e2e
```

The frontend's Playwright suite is separate. To run it, start this backend in development mode against a disposable database and follow [the frontend browser test guide](https://github.com/Nikita-Nechaiev/ai-assistant-frontend/blob/main/e2e/README.md).

## CI and hosting

[Backend CI](.github/workflows/backend-ci.yml) runs on pushes and PRs to `main`, and manual dispatch:

- **Build-and-test job:** starts PostgreSQL, installs dependencies, runs lint, unit coverage, and e2e tests, and uploads coverage.
- **Build job:** runs only after successful checks on a push to `main`; compiles NestJS and uploads `dist/`.

This workflow has no deployment or database migration job. Hosting is configured separately. The API is hosted on Render with the custom domain `api.ai-editor-portfolio.com`. Set `PORT` in the hosting environment, provide production secrets/database configuration, and preserve `uploads/` if uploaded files must survive redeploys. Verify startup through `GET /health`.w

## Contact

- **Mykyta Nechaiev**
- Email: [mykyta.nechaiev.dev@gmail.com](mailto:mykyta.nechaiev.dev@gmail.com)
- [LinkedIn](https://www.linkedin.com/in/mykyta-nechaiev-48b776358/)

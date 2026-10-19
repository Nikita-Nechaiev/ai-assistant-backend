# Backend unit tests

Run from the server directory:

```sh
npm test -- --runInBand
npm run test:cov -- --runInBand
```

The coverage command requires **at least 81%** for statements, branches, functions, and lines. The existing coverage scope includes services, controllers, gateways, guards, strategies, and shared logic; module wiring, entity models, DTO declarations, and the application bootstrap are excluded.

Unit tests mock repositories, authentication providers, mail, and other external dependencies. They do not require a running PostgreSQL database, SMTP server, OpenAI account, or application server.

The statistics tests cover authenticated user scoping, UTC date boundaries, zero-filled daily data, totals, duration formatting, distinct document aggregation, Admin versus invited memberships, and database failures. Public-info tests cover PDF bytes, download headers, public access, missing files, and unexpected filesystem errors.

Coverage reports are generated in `coverage/`: open `coverage/lcov-report/index.html` for details, or read `coverage/coverage-summary.json` for totals. Reports should not be committed.

Integration/end-to-end tests use a separate configuration and are not included in unit coverage totals.

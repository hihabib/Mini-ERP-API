# Mini ERP API — Claude Code Context

This file is the single source of truth for any AI session working in this repository.
Read it fully before writing any code or suggesting any changes.

---

## Tech Stack (mandatory — do not substitute)

| Concern | Technology |
|---|---|
| Runtime | Node.js LTS |
| Framework | Express.js |
| Language | TypeScript — `strict: true`, `noImplicitAny: true` |
| Database | MongoDB + Mongoose |
| Auth | JWT (access + refresh tokens) |
| Validation | Zod |
| Real-time | Socket.io |
| API Docs | Swagger / OpenAPI (`swagger-jsdoc` + `swagger-ui-express`) |
| Testing | Vitest + Supertest + `mongodb-memory-server` |
| Package manager | **pnpm** (never npm or yarn) |

---

## Architectural Principles (non-negotiable)

1. **Modular feature-based layout** — code lives under `src/modules/<feature>/`, never in top-level `controllers/`, `models/`, or `routes/` folders.
2. **Strict layering inside each module**: `route → controller → service → model`
   - **Route**: registers endpoints, wires middlewares.
   - **Controller**: HTTP concerns only — parse request, call service, shape response. Zero business logic.
   - **Service**: all business logic. No HTTP imports.
   - **Model**: Mongoose schema + data-access methods only.
3. **Shared cross-cutting concerns** live once in `src/middlewares/` and `src/shared/`:
   - All API responses **must** use `shared/apiResponse.ts` (`sendSuccess` / `sendError`).
   - All thrown errors **must** use `shared/ApiError.ts`.
   - Request validation uses the `validate` middleware from `middlewares/validate.middleware.ts`.
4. **Database-driven roles and permissions** — roles and permissions are stored in MongoDB, evaluated at runtime via `middlewares/permission.middleware.ts`. Never hardcode role names or permission strings anywhere in application code.
5. **Swappable interfaces** — anything that may change provider (image storage, email, etc.) must be accessed through an interface/adapter so the module using it does not need rewriting when the provider changes.
6. **Never call `process.env` directly** — import from `src/config/env.ts` only.

---

## Definition of Done (every feature, no exceptions)

- [ ] ESLint passes with zero warnings or errors (`pnpm lint`)
- [ ] TypeScript compiles cleanly (`pnpm typecheck`)
- [ ] All tests pass (`pnpm test`)
- [ ] Unit tests cover the service layer; integration tests cover the route layer via Supertest
- [ ] Swagger / OpenAPI doc updated for any new or changed endpoint
- [ ] `README.md` updated if setup steps or environment variables changed

---

## Key File Locations

```
src/
├── app.ts                      # Express app bootstrap
├── server.ts                   # HTTP server + Socket.io + DB connect
├── config/
│   ├── env.ts                  # Validated env — import from here, never process.env
│   ├── db.ts                   # Mongoose connect/disconnect
│   └── socket.ts               # Socket.io init
├── modules/<feature>/
│   ├── <feature>.routes.ts
│   ├── <feature>.controller.ts
│   ├── <feature>.service.ts
│   ├── <feature>.validation.ts
│   └── <feature>.test.ts
├── middlewares/
│   ├── auth.middleware.ts      # JWT verification
│   ├── permission.middleware.ts # Dynamic permission check
│   ├── validate.middleware.ts  # Zod validation wrapper
│   └── error.middleware.ts     # Global error handler
├── shared/
│   ├── apiResponse.ts          # sendSuccess / sendError
│   └── ApiError.ts             # Custom ApiError class
└── docs/swagger.ts
tests/
└── setup.ts                    # In-memory MongoDB lifecycle for tests
```

---

## Test Setup Note

`pnpm test` calls `node_modules/.bin/vitest run` directly (not via `pnpm exec`) to bypass a pnpm v11 interactive build-approval prompt. Do not change this without testing first.

---

## AI Tooling

The following tools/plugins are configured for this repository. Use them as described.

| Tool | When to use |
|---|---|
| **Context7 MCP** | Pull current docs for Express, Mongoose, Zod, Socket.io, Swagger, and any other library before writing implementation code. Never rely on training-data knowledge for library APIs. |
| **MongoDB MCP** | Inspect live schema, run aggregations, and verify data during development against the Dockerized local MongoDB instance. |
| **superpowers** | Enforced TDD workflow: plan → write failing test → implement → verify. Use for every feature. |
| **security-guidance** | Automatic vulnerability scanning on file edits and commits. Treat any finding as a blocker before merging. |
| **typescript-lsp** | Get real-time type diagnostics. Run before concluding a task to catch type errors the compiler would find. |
| **feature-dev** | Scaffold a new module following the route→controller→service→model pattern. |
| **code-review** | Review changed files before marking a feature done. |
| **pr-review-toolkit** | Review pull requests for correctness, security, and style. |
| **commit-commands** | Draft and create conventional commits. |
| **github** | Interact with GitHub issues and PRs from within the session. |

---

## Environment Variables

All variables are validated at startup in `src/config/env.ts`. See `.env.example` for the full list and descriptions.

---

## Shared Utilities (use these everywhere — do not reinvent)

| Utility | Location | Purpose |
|---|---|---|
| `sendSuccess` | `shared/apiResponse.ts` | Shape every success response. Signature: `sendSuccess(res, { statusCode?, message, data, meta? })`. |
| `ApiError` + subclasses | `shared/ApiError.ts` | `NotFoundError`, `BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`. Throw from services; the global error handler catches them. |
| `asyncHandler` | `shared/asyncHandler.ts` | Wrap every controller function. Eliminates try/catch boilerplate and forwards thrown errors to the error handler automatically. |
| `QueryBuilder` | `shared/queryBuilder/QueryBuilder.ts` | Chain `.search(fields).filter(excludes).sort().paginate()` on any Mongoose query, then call `.execute()` and `.countTotal()`. |

---

## HTTP Status Code Conventions

Every route must follow these codes consistently — never improvise:

| Code | When to use |
|---|---|
| `200` | Successful GET or PATCH |
| `201` | Successful POST — resource created |
| `204` | Successful DELETE — no response body |
| `400` | Validation error (field-level errors map in response) |
| `401` | Missing or invalid authentication |
| `403` | Authenticated but lacking the required permission |
| `404` | Resource not found |
| `409` | Conflict — duplicate key, or a business-rule conflict |
| `500` | Unhandled server error |

---

## API Response Shape

Every response must conform to one of these two shapes:

**Success:**
```json
{ "success": true, "message": "string", "data": {}, "meta": { "page": 1, "limit": 10, "total": 42 } }
```
(`meta` is only included on paginated list endpoints)

**Error:**
```json
{ "success": false, "message": "string", "errors": { "field": "reason" } }
```
(`errors` is only included when there are field-level validation errors)

---

## Socket Events

All events are emitted on the default namespace. Emission is centralised through
`emitStockUpdated` / `emitSaleCreated` in `src/config/socket.ts` — call those helpers,
never `getIO().emit()` directly, so adding room-based targeting later only requires
changing `socket.ts`, not every call site.

| Event | Emitted when | Payload |
|---|---|---|
| `stock:updated` | A sale commits successfully | `{ updates: [{ productId: string, newStock: number }] }` |
| `sale:created` | A sale commits successfully | `{ saleId: string, grandTotal: number, itemCount: number, createdAt: Date }` |

Events are emitted **after** the MongoDB transaction commits, so listeners always see
consistent data. A socket emission failure never rolls back the sale.

**Dashboard** is a passive listener of these events (frontend side only) — it emits no
events of its own. When `stock:updated` or `sale:created` arrive on the client, the
frontend should re-fetch `/api/dashboard/stats` or update its local state directly.

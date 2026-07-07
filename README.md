# Mini-ERP API

This repository contains the backend REST API for the Mini-ERP (Inventory & Sales Management System), developed using Node.js, Express, TypeScript, Mongoose, and Socket.io.

## Tech Stack
- **Runtime Environment:** Node.js
- **Framework:** Express
- **Language:** TypeScript
- **Database:** MongoDB (Requires Replica Set for Transactions)
- **ODM:** Mongoose
- **Validation:** Zod
- **Real-Time Engine:** Socket.io
- **Testing:** Vitest
- **Linting & Formatting:** ESLint & Prettier
- **API Documentation:** Swagger / OpenAPI

## Prerequisites
- Node.js (v18+)
- `pnpm` package manager
- **MongoDB Replica Set**: A replica set is strictly required because the sales module utilizes MongoDB ACID Transactions. You can start a local replica set using Docker Compose:
  ```bash
  docker-compose up -d
  ```

## Getting Started

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Configure Environment Variables:**
   Copy `.env.example` to `.env` and fill out your variables:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/mini-erp
   JWT_SECRET=your_secret_key
   JWT_EXPIRES_IN=1h
   JWT_REFRESH_SECRET=your_refresh_secret
   JWT_REFRESH_EXPIRES_IN=7d
   ```

3. **Seed Database:**
   To populate initial users, roles, and permissions (run this only once!):
   ```bash
   pnpm run seed
   ```

4. **Start the Development Server:**
   ```bash
   pnpm run dev
   ```

## Available Scripts
- `pnpm run dev`: Starts the server in watch mode using `tsx`.
- `pnpm run build`: Compiles TypeScript to the `dist` folder.
- `pnpm run start`: Runs the built application.
- `pnpm run test`: Runs the Vitest test suite.
- `pnpm run test:coverage`: Runs the test suite and generates a coverage report.
- `pnpm run lint`: Runs ESLint checks.
- `pnpm run typecheck`: Runs TypeScript type checking without emitting files.
- `pnpm run seed`: Seeds the database.

## API Documentation
Once the server is running, you can access the Swagger UI documentation at:
**[http://localhost:5000/api/docs](http://localhost:5000/api/docs)**

## Project Structure
This API utilizes a domain/feature-based modular architecture to ensure high cohesion and loose coupling.

```
src/
├── config/           # Environment, Database, and Socket configurations
├── docs/             # Swagger setup and configurations
├── middlewares/      # Global middlewares (Auth, Roles, Errors, Validation)
├── modules/          # Feature domains
│   ├── auth/         # Authentication and sessions
│   ├── dashboard/    # Aggregation statistics
│   ├── product/      # Product catalog and inventory
│   ├── role/         # Roles and permission management
│   ├── sale/         # Sales, transactions, and price snapshots
│   └── user/         # User management
├── scripts/          # Seeding and operational scripts
├── shared/           # Cross-domain utilities (ApiError, QueryBuilder, etc.)
└── tests/            # Global test setup files
```

## Socket.io Real-Time Events
The server emits the following real-time events to all connected clients:
- `stock:updated`: Fired when a sale is completed, carrying the updated `stockQuantity` of the purchased products.
- `sale:created`: Fired when a new sale transaction has been fully committed.

## Testing
We enforce a strict Test-Driven Development (TDD) cycle. The continuous integration workflows ensure tests maintain the following coverage thresholds:
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

Run `pnpm run test` or `pnpm run test:coverage` to execute the full suite.

## Known Limitations & Deployment Notes
- **Transactions:** Deployments *must* connect to a MongoDB cluster with a configured replica set. Standard standalone instances will throw transaction errors.
- **Image Uploads:** Currently, images are saved locally to the `/uploads` directory via multer. For production, consider swapping the multer configuration to use an S3/Cloud Storage provider.

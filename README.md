# Mini-ERP API

A robust RESTful backend API for the Mini-ERP application, providing inventory, sales, and role-based access management. Built with Node.js, Express, TypeScript, and MongoDB.

## Features
- **Authentication & Authorization**: Secure JWT-based authentication with robust role-based access control (RBAC).
- **Inventory Management**: Create, read, update, and delete products with image upload support.
- **Sales (POS)**: Process sales with atomic operations to ensure consistent stock deductions.
- **Real-Time Updates**: Socket.io integration to broadcast live stock changes and new sales across all connected clients.
- **API Documentation**: Interactive Swagger documentation to explore and test endpoints.
- **Automated Testing**: Comprehensive test suite using Vitest and MongoDB Memory Server.

## Technology Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB (Mongoose)
- **Validation**: Zod
- **Real-Time**: Socket.io
- **Testing**: Vitest, Supertest
- **File Uploads**: Multer

## Project Setup & Installation

### Prerequisites
- Node.js (v22+)
- pnpm (v11+)
- A MongoDB instance (e.g., MongoDB Atlas or a local MongoDB server)

### Installation
1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Configure environment variables:
   Create a `.env` file in the root of the project with the following configuration:
   ```env
   NODE_ENV=development
   PORT=8000
   MONGO_URI=mongodb://localhost:27017/mini-erp
   JWT_ACCESS_SECRET=your_access_secret_key
   JWT_REFRESH_SECRET=your_refresh_secret_key
   JWT_ACCESS_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d
   UPLOAD_DIR=uploads/
   MAX_UPLOAD_SIZE_MB=5
   CORS_ORIGIN=http://localhost:5173
   ```

3. Seed the database (Important):
   Run the seed script to create initial roles and the default admin and employee users:
   ```bash
   pnpm seed
   ```
   *Default Admin credentials:*
   - Email: `admin@mini-erp.dev`
   - Password: `Admin@1234!`

### Running the API

**Development Mode** (with hot-reload):
```bash
pnpm dev
```

**Production Build**:
```bash
pnpm build
pnpm start
```

### Documentation
Once the server is running, the Swagger API documentation is accessible at:
- `http://localhost:8000/api/docs`

### Testing
Run the test suite (requires no external DB, uses in-memory MongoDB):
```bash
pnpm test
pnpm test:coverage
```

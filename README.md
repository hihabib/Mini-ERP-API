# Mini-ERP API

A robust RESTful backend API for the Mini-ERP application, providing inventory, sales, and role-based user management. Built with Node.js, Express, TypeScript, and MongoDB.

## 🚀 Features
- **User & Role Management**: Complete user lifecycle management with robust Role-Based Access Control (RBAC). Three built-in roles:
  - **Admin**: Full access including user management (creation, deactivation) and dashboard statistics.
  - **Manager**: Can manage products, create sales, and view sale history.
  - **Employee**: Can view products, create sales, and view sale history.
- **Authentication & Security**: Secure JWT-based authentication (Access & Refresh tokens) with robust session handling.
- **Inventory Management**: Create, read, update, and delete products with image upload support.
- **Sales (POS)**: Process sales with atomic operations to ensure consistent stock deductions.
- **Real-Time Updates**: Socket.io integration to broadcast live stock changes and new sales across all connected clients.
- **API Documentation**: Interactive Swagger documentation to explore and test endpoints.
- **Automated Testing**: Comprehensive test suite using Vitest and MongoDB Memory Server.

## 🛠️ Technology Stack
- **Runtime**: Node.js (v22+)
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB (Mongoose)
- **Validation**: Zod
- **Real-Time**: Socket.io
- **Testing**: Vitest, Supertest
- **File Uploads**: Multer

## 📋 Project Setup & Installation Guide

### Prerequisites
- Node.js (v22 or higher)
- pnpm (v11 or higher)
- A MongoDB instance (e.g., MongoDB Atlas or a local MongoDB server)

### 1. Installation
Clone the repository and install the dependencies:
```bash
pnpm install
```

### 2. Configuration
Create a `.env` file in the root of the project by copying the example file:
```bash
cp .env.example .env
```
Ensure your `.env` contains the following configuration:
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

### 3. Database Seeding (Important)
Run the seed script to create initial roles (Admin, Manager, Employee) and their default users:
```bash
pnpm seed
```

**Default Credentials:**
- **Admin**: `admin@mini-erp.dev` / `Admin@1234!`
- **Manager**: `manager@mini-erp.dev` / `Manager@1234!`
- **Employee**: `employee@mini-erp.dev` / `Employee@1234!`

### 4. Running the API

**Development Mode** (with hot-reload):
```bash
pnpm dev
```

**Production Build**:
```bash
pnpm build
pnpm start
```

## 📖 API Documentation
Once the server is running, the interactive Swagger API documentation is available at:
👉 **[http://localhost:8000/api/docs](http://localhost:8000/api/docs)**

## 🧪 Testing
The project includes a comprehensive test suite (150 tests across 13 files) backed by an in-memory MongoDB replica set. No external database is required.

```bash
# Run all tests
pnpm test

# Run tests with coverage report
pnpm test:coverage
```

**Coverage (as of latest run):**

| Metric | Threshold | Actual |
|---|---|---|
| Statements | 80% | 98.34% |
| Branches | 75% | 88.30% |
| Functions | 80% | 100% |
| Lines | 80% | 99.00% |

Coverage is enforced — `pnpm test:coverage` fails if any metric drops below the threshold.

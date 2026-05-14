# SyncWave

Universal Cross-Platform Music Room

## 🚀 Tech Stack

### Frontend
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Zustand (Global State)
- Socket.IO Client

### Backend
- Node.js
- Express
- Socket.IO
- Prisma ORM

### Infrastructure
- Database: PostgreSQL (Neon)
- Cache: Redis (Upstash)
- Deployment: Vercel (Web), Railway/Render (Server)

## 🏗️ Monorepo Structure

- `apps/web`: Next.js frontend application
- `apps/server`: Node.js Express & Socket.IO backend
- `packages/shared`: Shared TypeScript types and constants
- `packages/ui`: Reusable UI components
- `packages/config`: ESLint, TypeScript configurations
- `prisma`: Database schema and migrations

## 🏃‍♂️ Getting Started

### Prerequisites
- Node.js 18+
- pnpm or npm
- PostgreSQL
- Redis

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Setup environment variables:
   Copy `.env.example` to `.env` and fill in the required values.

3. Setup Prisma:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. Start development servers:
   ```bash
   npm run dev
   ```

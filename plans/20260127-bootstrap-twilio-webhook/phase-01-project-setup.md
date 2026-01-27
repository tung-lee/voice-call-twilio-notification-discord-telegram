# Phase 1: Project Setup

## Context
Initialize a TypeScript Node.js project with all required dependencies and configuration files for the Twilio webhook server.

## Overview
Set up the project foundation including package.json, TypeScript configuration, ESLint, and environment variable management.

## Requirements
- Node.js 20+ installed
- npm or pnpm package manager
- Twilio trial account credentials

## Implementation Steps

### 1. Initialize Project
```bash
npm init -y
```

### 2. Install Dependencies
```bash
# Production dependencies
npm install express twilio dotenv pino pino-http zod

# Development dependencies
npm install -D typescript @types/node @types/express vitest tsx
```

### 3. Create TypeScript Configuration
Create `tsconfig.json` with strict mode, ES2022 target, and proper module resolution.

### 4. Create Environment Template
Create `.env.example` with all required variables documented.

### 5. Configure Package Scripts
Add scripts for dev, build, start, and test commands.

### 6. Create Directory Structure
```
src/
  config/
  middleware/
  routes/
  services/
  types/
  utils/
tests/
  unit/
  integration/
```

### 7. Setup Git Ignore
Add `.gitignore` for node_modules, dist, .env, and coverage.

## Todo

- [ ] Run `npm init -y`
- [ ] Install production dependencies (express, twilio, dotenv, pino, pino-http, zod)
- [ ] Install dev dependencies (typescript, @types/*, vitest, tsx)
- [ ] Create `tsconfig.json` with strict configuration
- [ ] Create `.env.example` with all required variables
- [ ] Update `package.json` with scripts (dev, build, start, test)
- [ ] Create source directory structure (`src/`)
- [ ] Create test directory structure (`tests/`)
- [ ] Create `.gitignore` file
- [ ] Verify TypeScript compiles with `npx tsc --noEmit`

## Success Criteria

- `npm run dev` starts the development server with hot reload
- `npm run build` compiles TypeScript to JavaScript
- TypeScript strict mode is enabled
- All directories exist and are properly structured
- Environment template documents all required variables

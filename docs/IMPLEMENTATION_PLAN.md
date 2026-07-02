# PlanFlow AI Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development if subagents are available, or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a two-day MVP for PlanFlow AI: create a learning goal, configure weekly availability, generate AI-style tasks, schedule them into a calendar, and export `.ics`.

**Architecture:** Keep the app modular even if the MVP is small. API routes stay thin; AI generation, scheduling, validation, and calendar export live in isolated modules with tests.

**Tech Stack:** React + TypeScript, Node + Express + TypeScript, Prisma + SQLite, Vitest, Supertest, `.ics` export.

---

## Chunk 1: Project Foundation

### Task 1: Scaffold TypeScript Web and API Apps

**Files:**

- Create root package and workspace configuration.
- Create frontend app under `apps/web`.
- Create backend app under `apps/api`.
- Create shared package under `packages/shared`.

- [ ] Create package scripts for dev, build, test, lint, and typecheck.
- [ ] Add TypeScript configs.
- [ ] Add shared types package.
- [ ] Run install.
- [ ] Run typecheck.
- [ ] Commit: `chore: scaffold typescript workspace`.

### Task 2: Add Prisma and Initial Schema

**Files:**

- Create `prisma/schema.prisma`.
- Create API database client module.

- [ ] Add schema from `docs/DATA_MODEL.md`.
- [ ] Generate Prisma client.
- [ ] Add seed or mock user strategy.
- [ ] Run migration locally.
- [ ] Commit: `feat: add prisma data model`.

## Chunk 2: Core Domain Logic

### Task 3: Availability Validation

**Files:**

- Create `packages/shared/src/availability.ts`.
- Create tests for validation.

- [ ] Write failing tests for valid weekday rules.
- [ ] Write failing tests for overlapping ranges.
- [ ] Write failing tests for invalid time order.
- [ ] Implement validation.
- [ ] Run tests.
- [ ] Commit: `feat: validate weekly availability`.

### Task 4: Scheduler

**Files:**

- Create `packages/scheduler/src/scheduler.ts`.
- Create scheduler tests.

- [ ] Write failing test for scheduling inside weekday availability.
- [ ] Write failing test for disabled weekdays.
- [ ] Write failing test for multiple ranges on one day.
- [ ] Write failing test for splitting long tasks.
- [ ] Write failing test for insufficient capacity.
- [ ] Implement deterministic earliest-slot scheduler.
- [ ] Run tests.
- [ ] Commit: `feat: schedule tasks by weekly availability`.

### Task 5: AI Planning Service

**Files:**

- Create `apps/api/src/services/aiPlanningService.ts`.
- Create mock AI provider.
- Create validation tests.

- [ ] Define input and output types.
- [ ] Implement mock task generation for demo.
- [ ] Validate generated tasks.
- [ ] Add provider interface for real AI later.
- [ ] Run tests.
- [ ] Commit: `feat: add ai planning service boundary`.

## Chunk 3: Backend API

### Task 6: Plan APIs

**Files:**

- Create plan routes and services in `apps/api/src`.
- Add Supertest coverage.

- [ ] Implement `POST /api/plans`.
- [ ] Implement `POST /api/plans/:planId/generate`.
- [ ] Implement `GET /api/plans/:planId`.
- [ ] Persist plan, availability, tasks, and sessions.
- [ ] Run API tests.
- [ ] Commit: `feat: add plan generation api`.

### Task 7: Status and Calendar Export APIs

**Files:**

- Add task/session status routes.
- Add calendar export service.

- [ ] Implement task status update.
- [ ] Implement session status update.
- [ ] Implement `.ics` export.
- [ ] Test export with scheduled sessions.
- [ ] Commit: `feat: add progress tracking and calendar export`.

## Chunk 4: Frontend MVP

### Task 8: Plan Creation and Availability UI

**Files:**

- Create React pages and components in `apps/web/src`.

- [ ] Build plan creation form.
- [ ] Build weekday availability editor.
- [ ] Add time range add/remove controls.
- [ ] Show validation feedback.
- [ ] Connect to create/generate API.
- [ ] Commit: `feat: add plan creation flow`.

### Task 9: Plan Dashboard

**Files:**

- Create dashboard, calendar, task list, and summary components.

- [ ] Show plan summary.
- [ ] Show today's sessions.
- [ ] Show weekly calendar view.
- [ ] Show task list and statuses.
- [ ] Add complete action.
- [ ] Add export calendar action.
- [ ] Commit: `feat: add learning plan dashboard`.

## Chunk 5: Verification and Delivery

### Task 10: End-to-End Demo Verification

- [ ] Run all tests.
- [ ] Run typecheck.
- [ ] Run build.
- [ ] Start dev server.
- [ ] Verify desktop flow in browser.
- [ ] Verify mobile layout in browser.
- [ ] Fix visible layout issues.
- [ ] Commit: `test: verify mvp flow`.

### Task 11: Delivery Docs

**Files:**

- Update `README.md`.
- Create deployment notes if needed.
- Create interview notes if needed.

- [ ] Document setup commands.
- [ ] Document demo script.
- [ ] Document architecture.
- [ ] Document future Feishu integration.
- [ ] Commit: `docs: add delivery guide`.

## Two-Day Execution Order

Day 1:

- Scaffold workspace.
- Add data model.
- Implement availability validation.
- Implement scheduler.
- Implement mock AI service.
- Add core API.

Day 2:

- Build frontend creation flow.
- Build dashboard and calendar view.
- Add `.ics` export.
- Run verification.
- Polish README and interview explanation.

# AGENTS.md

PlanFlow AI is currently a documentation-first TypeScript full-stack project. Application code has not been scaffolded yet.

## Current Repository State

- Git is initialized.
- Planning docs live in `docs/`.
- The intended stack is documented as React + TypeScript, Node + Express + TypeScript, Prisma + SQLite.
- No `package.json`, lockfile, build script, lint script, test runner, or source tree exists yet.

## Working Rules

- Do not invent commands that are not present in repository configuration.
- Before implementation, read:
  - `docs/PRD.md`
  - `docs/TECH_DESIGN.md`
  - `docs/API_SPEC.md`
  - `docs/DATA_MODEL.md`
  - `docs/IMPLEMENTATION_PLAN.md`
  - `docs/TEST_PLAN.md`
- Keep AI planning, scheduling, calendar export, API routes, and UI components separated by responsibility.
- Treat `.ics` export as the MVP calendar integration.
- Treat real Feishu Calendar sync as a future enhancement unless the user explicitly reprioritizes it.

## Commands

No verified project commands exist yet. Add this section after scaffolding `package.json` and lockfiles.

## Git Guidance

- Keep commits small and stage-based.
- Suggested commit boundaries:
  - documentation/spec changes
  - project scaffolding
  - data model
  - scheduler
  - AI planning service
  - backend API
  - frontend flow
  - verification and delivery docs

## Testing Guidance

When implementation starts, prioritize tests for:

- Weekly availability validation
- Scheduling across uneven weekday availability
- Task splitting across sessions
- Capacity shortage behavior
- AI output validation
- API contracts
- Calendar export

## Notes for Future Updates

After scaffolding, update this file with factual commands copied from real scripts and config files.

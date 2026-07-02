# PlanFlow AI

PlanFlow AI is an AI learning plan and calendar scheduling assistant. Users enter a learning goal, configure weekly availability, generate structured learning tasks, and schedule those tasks into realistic calendar sessions.

## MVP Direction

The first version focuses on:

- Learning goal creation
- Weekday-based availability rules
- AI-style task decomposition
- Deterministic scheduling
- Calendar dashboard
- `.ics` calendar export

Real Feishu Calendar sync is a later enhancement. The MVP should remain useful and demonstrable with `.ics` export.

## Planned Stack

- React + TypeScript
- Node + Express + TypeScript
- Prisma + SQLite
- Vitest and Supertest

## Current Status

The project is in the documentation and planning phase. No application code has been scaffolded yet.

## Documentation

- [PRD](docs/PRD.md)
- [Technical Design](docs/TECH_DESIGN.md)
- [API Spec](docs/API_SPEC.md)
- [Data Model](docs/DATA_MODEL.md)
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md)
- [Test Plan](docs/TEST_PLAN.md)

## Interview Positioning

PlanFlow AI is not a generic todo app. It demonstrates how to turn a natural language learning goal into structured tasks, schedule those tasks around uneven weekly availability, and export the result into a real calendar workflow.

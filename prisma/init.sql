-- ============================================================
-- PlanFlow AI — PostgreSQL Database Schema (幂等版本)
-- ============================================================
-- 可反复执行，不会因对象已存在而报错
-- Navicat: 右键 planflow 数据库 → Execute SQL File → 选择此文件
-- psql:   psql -U planflow -d planflow -f init.sql
-- ============================================================

-- 1. 枚举类型（ENUMs）—— 仅在不存在时创建
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlanStatus') THEN
        CREATE TYPE "PlanStatus" AS ENUM ('draft', 'generated', 'archived');
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskStatus') THEN
        CREATE TYPE "TaskStatus" AS ENUM ('not_started', 'in_progress', 'completed', 'delayed');
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SessionStatus') THEN
        CREATE TYPE "SessionStatus" AS ENUM ('scheduled', 'completed', 'missed', 'rescheduled', 'conflicted');
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReviewResult') THEN
        CREATE TYPE "ReviewResult" AS ENUM ('completed', 'partial', 'not_completed', 'skipped');
    END IF;
END$$;

-- 2. updated_at 自动触发器函数（可反复执行）
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. 数据表（全部使用 IF NOT EXISTS）
-- ============================================================

-- 3.1 用户表
CREATE TABLE IF NOT EXISTS "User" (
    "id"        TEXT        NOT NULL PRIMARY KEY,
    "email"     TEXT        NOT NULL,
    "name"      TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

DROP TRIGGER IF EXISTS "User_updatedAt" ON "User";
CREATE TRIGGER "User_updatedAt"
    BEFORE UPDATE ON "User"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3.2 学习计划表
CREATE TABLE IF NOT EXISTS "LearningPlan" (
    "id"                      TEXT          NOT NULL PRIMARY KEY,
    "userId"                  TEXT          NOT NULL,
    "title"                   TEXT          NOT NULL,
    "goal"                    TEXT          NOT NULL,
    "totalMinutes"            INTEGER       NOT NULL,
    "startDate"               TIMESTAMP(3)  NOT NULL,
    "deadline"                TIMESTAMP(3)  NOT NULL,
    "rescheduleBufferMinutes" INTEGER       NOT NULL DEFAULT 15,
    "status"                  "PlanStatus"  NOT NULL DEFAULT 'draft',
    "createdAt"               TIMESTAMP(3)  NOT NULL DEFAULT now(),
    "updatedAt"               TIMESTAMP(3)  NOT NULL DEFAULT now(),

    CONSTRAINT "LearningPlan_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "LearningPlan_userId_idx" ON "LearningPlan"("userId");
CREATE INDEX IF NOT EXISTS "LearningPlan_status_idx" ON "LearningPlan"("status");

DROP TRIGGER IF EXISTS "LearningPlan_updatedAt" ON "LearningPlan";
CREATE TRIGGER "LearningPlan_updatedAt"
    BEFORE UPDATE ON "LearningPlan"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3.3 可用时间规则表
CREATE TABLE IF NOT EXISTS "AvailabilityRule" (
    "id"        TEXT        NOT NULL PRIMARY KEY,
    "planId"    TEXT        NOT NULL,
    "weekday"   INTEGER     NOT NULL,
    "startTime" TEXT        NOT NULL,
    "endTime"   TEXT        NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),

    CONSTRAINT "AvailabilityRule_planId_fkey"
        FOREIGN KEY ("planId") REFERENCES "LearningPlan"("id")
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "AvailabilityRule_planId_idx" ON "AvailabilityRule"("planId");

DROP TRIGGER IF EXISTS "AvailabilityRule_updatedAt" ON "AvailabilityRule";
CREATE TRIGGER "AvailabilityRule_updatedAt"
    BEFORE UPDATE ON "AvailabilityRule"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3.4 学习任务表
CREATE TABLE IF NOT EXISTS "LearningTask" (
    "id"                 TEXT          NOT NULL PRIMARY KEY,
    "planId"             TEXT          NOT NULL,
    "phase"              TEXT          NOT NULL,
    "title"              TEXT          NOT NULL,
    "description"        TEXT          NOT NULL,
    "estimatedMinutes"   INTEGER       NOT NULL,
    "priority"           INTEGER       NOT NULL,
    "status"             "TaskStatus"  NOT NULL DEFAULT 'not_started',
    "acceptanceCriteria" JSONB         NOT NULL DEFAULT '[]'::jsonb,
    "orderIndex"         INTEGER       NOT NULL,
    "createdAt"          TIMESTAMP(3)  NOT NULL DEFAULT now(),
    "updatedAt"          TIMESTAMP(3)  NOT NULL DEFAULT now(),

    CONSTRAINT "LearningTask_planId_fkey"
        FOREIGN KEY ("planId") REFERENCES "LearningPlan"("id")
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "LearningTask_planId_idx" ON "LearningTask"("planId");
CREATE INDEX IF NOT EXISTS "LearningTask_status_idx" ON "LearningTask"("status");
CREATE INDEX IF NOT EXISTS "LearningTask_phase_order_idx" ON "LearningTask"("planId", "phase", "orderIndex");

DROP TRIGGER IF EXISTS "LearningTask_updatedAt" ON "LearningTask";
CREATE TRIGGER "LearningTask_updatedAt"
    BEFORE UPDATE ON "LearningTask"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3.5 排程会话表
CREATE TABLE IF NOT EXISTS "ScheduledSession" (
    "id"              TEXT            NOT NULL PRIMARY KEY,
    "planId"          TEXT            NOT NULL,
    "taskId"          TEXT            NOT NULL,
    "startAt"         TIMESTAMP(3)    NOT NULL,
    "endAt"           TIMESTAMP(3)    NOT NULL,
    "durationMinutes" INTEGER         NOT NULL,
    "status"          "SessionStatus" NOT NULL DEFAULT 'scheduled',
    "externalEventId" TEXT,
    "createdAt"       TIMESTAMP(3)    NOT NULL DEFAULT now(),
    "updatedAt"       TIMESTAMP(3)    NOT NULL DEFAULT now(),

    CONSTRAINT "ScheduledSession_planId_fkey"
        FOREIGN KEY ("planId") REFERENCES "LearningPlan"("id")
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT "ScheduledSession_taskId_fkey"
        FOREIGN KEY ("taskId") REFERENCES "LearningTask"("id")
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ScheduledSession_planId_idx" ON "ScheduledSession"("planId");
CREATE INDEX IF NOT EXISTS "ScheduledSession_taskId_idx" ON "ScheduledSession"("taskId");
CREATE INDEX IF NOT EXISTS "ScheduledSession_status_idx" ON "ScheduledSession"("status");
CREATE INDEX IF NOT EXISTS "ScheduledSession_startAt_idx" ON "ScheduledSession"("startAt");

DROP TRIGGER IF EXISTS "ScheduledSession_updatedAt" ON "ScheduledSession";
CREATE TRIGGER "ScheduledSession_updatedAt"
    BEFORE UPDATE ON "ScheduledSession"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3.6 忙碌时间段表
CREATE TABLE IF NOT EXISTS "BusySlot" (
    "id"              TEXT        NOT NULL PRIMARY KEY,
    "planId"          TEXT        NOT NULL,
    "source"          TEXT        NOT NULL,
    "externalEventId" TEXT,
    "title"           TEXT        NOT NULL,
    "startAt"         TIMESTAMP(3) NOT NULL,
    "endAt"           TIMESTAMP(3) NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT now(),
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT now(),

    CONSTRAINT "BusySlot_planId_fkey"
        FOREIGN KEY ("planId") REFERENCES "LearningPlan"("id")
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "BusySlot_planId_idx" ON "BusySlot"("planId");
CREATE INDEX IF NOT EXISTS "BusySlot_startAt_idx" ON "BusySlot"("startAt");

DROP TRIGGER IF EXISTS "BusySlot_updatedAt" ON "BusySlot";
CREATE TRIGGER "BusySlot_updatedAt"
    BEFORE UPDATE ON "BusySlot"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3.7 会话复盘表
CREATE TABLE IF NOT EXISTS "SessionReview" (
    "id"               TEXT           NOT NULL PRIMARY KEY,
    "sessionId"        TEXT           NOT NULL,
    "taskId"           TEXT           NOT NULL,
    "result"           "ReviewResult" NOT NULL,
    "actualMinutes"    INTEGER        NOT NULL,
    "remainingMinutes" INTEGER        NOT NULL,
    "reason"           TEXT,
    "continueTask"     BOOLEAN        NOT NULL DEFAULT true,
    "createdAt"        TIMESTAMP(3)   NOT NULL DEFAULT now(),

    CONSTRAINT "SessionReview_sessionId_fkey"
        FOREIGN KEY ("sessionId") REFERENCES "ScheduledSession"("id")
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT "SessionReview_taskId_fkey"
        FOREIGN KEY ("taskId") REFERENCES "LearningTask"("id")
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "SessionReview_sessionId_key" ON "SessionReview"("sessionId");
CREATE INDEX IF NOT EXISTS "SessionReview_taskId_idx" ON "SessionReview"("taskId");

-- ============================================================
-- 完成！共 4 个枚举类型 + 7 张数据表
-- 可反复执行，不会报错
-- ============================================================

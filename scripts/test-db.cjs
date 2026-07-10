/**
 * 数据库连接测试脚本
 * 用法：node scripts/test-db.cjs
 *
 * 测试内容：
 *   1. 手动加载 .env 文件
 *   2. Prisma 客户端能否连接 PostgreSQL
 *   3. 所有表是否存在（列出表名和行数）
 *   4. 枚举类型是否正确注册
 */

/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unused-expressions */

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function ok(label) {
  console.log(`  ${GREEN}✓${RESET} ${label}`);
}

function fail(label, detail) {
  console.log(`  ${RED}✗${RESET} ${label}`);
  if (detail) console.log(`    ${RED}→ ${detail}${RESET}`);
}

function section(title) {
  console.log(`\n${BOLD}${CYAN}── ${title}${RESET}`);
}

// ── 手动解析 .env 文件 ──
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const lines = fs.readFileSync(filePath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    let value = trimmed.slice(eqIdx + 1);
    // 去掉引号
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
  return true;
}

async function main() {
  console.log(`${BOLD}PlanFlow AI — 数据库连接测试${RESET}\n`);

  // ── 1. 加载 .env ──
  section("1. 加载 .env");
  const envPath = path.resolve(__dirname, "..", ".env");
  if (loadEnvFile(envPath)) {
    ok(`已加载: ${envPath}`);
  } else {
    fail(".env 文件不存在");
    console.log(`\n${YELLOW}请创建 .env 文件：${RESET}`);
    console.log(`  cp .env.example .env`);
    console.log(`  然后修改 .env 中的用户名和密码`);
    process.exit(1);
  }

  // ── 2. 检查 DATABASE_URL ──
  section("2. 检查 DATABASE_URL");
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    fail("DATABASE_URL 未在 .env 中配置");
    process.exit(1);
  }
  const masked = dbUrl.replace(/(:\/\/[^:]+:).*(@)/, "$1****$2");
  ok(`DATABASE_URL = ${masked}`);

  // ── 3. 测试连接 ──
  section("3. 测试 PostgreSQL 连接");
  const prisma = new PrismaClient({ log: ["error"] });
  try {
    await prisma.$connect();
    ok("Prisma 客户端连接成功");
  } catch (err) {
    fail("连接失败", err.message);
    console.log(`\n${YELLOW}常见原因：${RESET}`);
    console.log("  - PostgreSQL 服务未启动");
    console.log("  - 用户名/密码/端口不正确");
    console.log("  - planflow 数据库不存在");
    console.log("  - pg_hba.conf 未允许本地连接");
    process.exit(1);
  }

  // ── 4. 检查表 ──
  section("4. 检查数据库表");

  const expectedTables = [
    "User",
    "LearningPlan",
    "AvailabilityRule",
    "LearningTask",
    "ScheduledSession",
    "BusySlot",
    "SessionReview",
  ];

  const tablesResult = await prisma.$queryRawUnsafe(
    `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  const existingTables = new Set(tablesResult.map((r) => r.tablename));

  let missing = 0;
  for (const table of expectedTables) {
    if (existingTables.has(table)) {
      const countResult = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) AS count FROM "${table}"`
      );
      const rowCount = Number(countResult[0]?.count ?? 0);
      ok(`${table}  (${rowCount} 行)`);
    } else {
      missing++;
      fail(`${table}  — 表不存在`);
    }
  }

  if (missing > 0) {
    console.log(`\n${YELLOW}缺少 ${missing} 张表，请在 Navicat 中执行 prisma/init.sql${RESET}`);
  }

  // ── 5. 检查枚举 ──
  section("5. 检查枚举类型");

  const enumsResult = await prisma.$queryRawUnsafe(
    `SELECT typname FROM pg_type WHERE typname IN ('PlanStatus', 'TaskStatus', 'SessionStatus', 'ReviewResult') ORDER BY typname`
  );
  const existingEnums = new Set(enumsResult.map((r) => r.typname));

  for (const e of ["PlanStatus", "TaskStatus", "SessionStatus", "ReviewResult"]) {
    existingEnums.has(e) ? ok(e) : fail(`${e}  — 不存在`);
  }

  // ── 6. 结论 ──
  section("6. 结论");

  const allTablesOk = expectedTables.every((t) => existingTables.has(t));
  const allEnumsOk = ["PlanStatus", "TaskStatus", "SessionStatus", "ReviewResult"].every((e) => existingEnums.has(e));

  if (allTablesOk && allEnumsOk) {
    console.log(`  ${GREEN}${BOLD}✓ 数据库配置正确，可以开始开发！${RESET}\n`);
    console.log("  启动开发服务器：npm run dev");
    console.log("  控制台应输出：[repository] Using Prisma (PostgreSQL) repository");
  } else {
    console.log(`  ${YELLOW}${BOLD}⚠ 数据库配置不完整，请按上述提示修复${RESET}\n`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(`${RED}测试异常:${RESET}`, err);
  process.exit(1);
});

#!/usr/bin/env node
// 校验提交信息是否符合 Conventional Commits 规范。
// 判定顺序：
//   1. 首行以 Merge / Revert 前缀开头的系统生成信息直接放行
//   2. 否则校验格式：<type>(<scope>)?(!)?: <subject>
//   3. 再校验首行长度 ≤72：ASCII 前缀（type/scope/!）按字节计，subject 按 Unicode 字符数计
import fs from "node:fs";

const TYPES = ["feat", "fix", "refactor", "test", "docs", "chore", "ci"];
const MAX_LEN = 72;

const msgFile = process.argv[2];
if (!msgFile) {
  console.error("commit-msg: 缺少提交信息文件路径参数");
  process.exit(1);
}

const message = fs.readFileSync(msgFile, "utf8");
const firstLine = (message.split("\n")[0] || "").trim();

if (!firstLine) {
  console.error("commit-msg: 提交信息首行为空");
  process.exit(1);
}

// 1. Merge / Revert 前缀放行（git 自动生成的合并/回滚信息）
if (/^(Merge|Revert)\b/.test(firstLine)) {
  process.exit(0);
}

// 2. 格式校验：<type>(<scope>)?(<bang>)?: <subject>
const m = firstLine.match(
  /^(feat|fix|refactor|test|docs|chore|ci)(\([^)]*\))?(!)?: (.+)$/
);
if (!m) {
  console.error(`commit-msg: 提交信息不符合 Conventional Commits 规范。
期望格式: <type>(<scope>)?(<bang>)?: <subject>
type 取值: ${TYPES.join(" | ")}
示例:
  feat: 新增登录接口
  fix(api): 修复超时问题
  feat!: 破坏性变更
当前提交信息: ${firstLine}`);
  process.exit(1);
}

// 3. 长度校验：ASCII 前缀按字节 + subject 按 Unicode 字符数
const [, type, scope, bang, subject] = m;
const prefix = `${type}${scope ?? ""}${bang ?? ""}:`;
const prefixBytes = Buffer.byteLength(prefix, "utf8"); // 前缀均为 ASCII，字节数即字符数
const subjectChars = [...subject].length; // 按 Unicode 码点计数，避免中文被按字节误判
const total = prefixBytes + subjectChars;

if (total > MAX_LEN) {
  console.error(
    `commit-msg: 提交信息首行长度 ${total} 超过上限 ${MAX_LEN}（前缀按字节 ${prefixBytes}，subject 按字符 ${subjectChars}）。\n当前: ${firstLine}`
  );
  process.exit(1);
}

process.exit(0);

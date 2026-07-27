#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { normalizeRepoPath, validateChangeSet } from "./change-record-contract.mjs";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function git(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trimEnd();
}

const root = git(["rev-parse", "--show-toplevel"]);
const requestedBase = argument("--base") ?? process.env.GITHUB_BASE_SHA;
const requestedHead = argument("--head") ?? process.env.GITHUB_SHA;
let base = requestedBase;
if (!base) {
  try {
    base = git(["merge-base", "HEAD", "origin/main"], { cwd: root });
  } catch {
    base = "HEAD";
  }
}
const head = requestedHead ?? null;
const range = head ? `${base}..${head}` : base;
const diff = git(["diff", "--name-status", "--find-renames", range, "--"], { cwd: root });
const changes = diff
  ? diff.split("\n").flatMap((line) => {
      const columns = line.split("\t");
      const rawStatus = columns[0];
      if (rawStatus.startsWith("R")) {
        return [
          { status: "D", path: normalizeRepoPath(columns[1]) },
          { status: "A", path: normalizeRepoPath(columns[2]) },
        ];
      }
      return [{ status: rawStatus[0], path: normalizeRepoPath(columns[1]) }];
    })
  : [];
if (!head) {
  const untracked = git(["ls-files", "--others", "--exclude-standard"], { cwd: root });
  for (const filePath of untracked ? untracked.split("\n") : []) {
    changes.push({ status: "A", path: normalizeRepoPath(filePath) });
  }
}

const relevantPaths = new Set([
  "CHANGELOG.md",
  ...changes.map((change) => change.path),
]);
const baseFiles = {};
const proposedFiles = {};
for (const filePath of relevantPaths) {
  try {
    baseFiles[filePath] = git(["show", `${base}:${filePath}`], { cwd: root });
  } catch {
    // Absent from predecessor state.
  }
  if (head) {
    try {
      proposedFiles[filePath] = git(["show", `${head}:${filePath}`], { cwd: root });
    } catch {
      // Absent from proposed commit.
    }
  } else {
    const absolutePath = path.join(root, filePath);
    if (fs.existsSync(absolutePath)) proposedFiles[filePath] = fs.readFileSync(absolutePath, "utf8");
  }
}

const errors = validateChangeSet({ baseFiles, proposedFiles, changes });
if (errors.length) {
  console.error("Change-record validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Change-record validation passed (${base.slice(0, 12)} -> ${head?.slice(0, 12) ?? "working tree"}).`);

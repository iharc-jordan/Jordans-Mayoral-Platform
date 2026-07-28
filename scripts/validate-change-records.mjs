#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { isDeepStrictEqual } from "node:util";
import { pathToFileURL } from "node:url";

const RULES_PATH = "data/campaign-rules.json";
const RULE_DOCUMENT_KEYS = ["schemaVersion", "rules"];
const RULE_KEYS = [
  "id",
  "number",
  "title",
  "statement",
  "statementStyle",
  "detail",
  "evidence",
  "surfaces",
];
const RECORD_KEYS = [
  "id",
  "date",
  "title",
  "classification",
  "affectedRuleIds",
  "affectedPolicyIds",
  "affectedSurfaces",
  "summary",
  "reason",
  "previousValues",
  "newValues",
  "whatDidNotChange",
  "supportingLinks",
];
const CLASSIFICATIONS = new Set([
  "clarification",
  "evidence-update",
  "cost-or-timeline-update",
  "scope-expansion",
  "scope-reduction",
  "position-change",
  "policy-withdrawal",
  "administrative-correction",
]);
const INFRASTRUCTURE_PATHS = [
  /^scripts\//,
  /^tests\//,
  /^\.github\/workflows\//,
  /^package(?:-lock)?\.json$/,
  /^(?:schemas?|schema)\//,
  /^AGENTS\.md$/,
  /^METHODOLOGY\.md$/,
  /^REPOSITORY-SETTINGS\.md$/,
];

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, expected, label, errors) {
  if (!object(value)) {
    errors.push(`${label} must be an object.`);
    return false;
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (!isDeepStrictEqual(actual, wanted)) {
    errors.push(`${label} must contain exactly: ${wanted.join(", ")}.`);
    return false;
  }
  return true;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function stringArray(value, { nonempty = false } = {}) {
  return Array.isArray(value)
    && (!nonempty || value.length > 0)
    && value.every(nonEmptyString)
    && new Set(value).size === value.length;
}

function publicPath(value) {
  return typeof value === "string" && /^\/(?:[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*)?$/.test(value);
}

function publicHttps(value) {
  if (!nonEmptyString(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && Boolean(url.hostname)
      && !url.username
      && !url.password
      && url.hostname !== "localhost"
      && !url.hostname.endsWith(".local")
      && url.hostname !== "127.0.0.1"
      && url.hostname !== "[::1]";
  } catch {
    return false;
  }
}

function parseJson(source, label, errors) {
  try {
    return JSON.parse(source);
  } catch (error) {
    errors.push(`${label} is not valid JSON: ${error.message}`);
    return null;
  }
}

export function validateRulesDocument(document) {
  const errors = [];
  if (!exactKeys(document, RULE_DOCUMENT_KEYS, "Campaign rules document", errors)) return errors;
  if (document.schemaVersion !== 1) errors.push("Campaign rules schemaVersion must be 1.");
  if (!Array.isArray(document.rules) || document.rules.length !== 18) {
    errors.push("Campaign rules must contain exactly 18 rules.");
    return errors;
  }

  for (const [index, rule] of document.rules.entries()) {
    const label = `Rule ${index + 1}`;
    if (!exactKeys(rule, RULE_KEYS, label, errors)) continue;
    const number = index + 1;
    if (rule.id !== `rule-${number}`) errors.push(`${label} id must be rule-${number}.`);
    if (rule.number !== number) errors.push(`${label} number must be ${number}.`);
    if (!nonEmptyString(rule.title)) errors.push(`${label} title must be a non-empty string.`);
    if (!nonEmptyString(rule.statement)) errors.push(`${label} statement must be a non-empty string.`);
    if (!new Set(["paragraph", "quote"]).has(rule.statementStyle)) {
      errors.push(`${label} statementStyle must be paragraph or quote.`);
    }
    if (!Array.isArray(rule.detail)) {
      errors.push(`${label} detail must be an array.`);
    } else {
      for (const [detailIndex, item] of rule.detail.entries()) {
        const itemLabel = `${label} detail item ${detailIndex + 1}`;
        if (!object(item) || !new Set(["paragraph", "ordered-list", "unordered-list"]).has(item.type)) {
          errors.push(`${itemLabel} has an invalid type.`);
          continue;
        }
        const keys = item.type === "paragraph" ? ["type", "text"] : ["type", "items"];
        if (!exactKeys(item, keys, itemLabel, errors)) continue;
        if (item.type === "paragraph" && !nonEmptyString(item.text)) {
          errors.push(`${itemLabel} text must be a non-empty string.`);
        }
        if (item.type !== "paragraph" && !stringArray(item.items, { nonempty: true })) {
          errors.push(`${itemLabel} items must be a non-empty array of unique strings.`);
        }
      }
    }
    if (rule.evidence !== null && !nonEmptyString(rule.evidence)) {
      errors.push(`${label} evidence must be a non-empty string or null.`);
    }
    if (!stringArray(rule.surfaces, { nonempty: true }) || !rule.surfaces.every(publicPath)) {
      errors.push(`${label} surfaces must be a non-empty array of unique public paths.`);
    }
  }
  return errors;
}

function rulesById(document) {
  return new Map((document?.rules ?? []).map((rule) => [rule.id, rule]));
}

export function changedRuleIds(baseDocument, proposedDocument) {
  const before = rulesById(baseDocument);
  const after = rulesById(proposedDocument);
  return [...new Set([...before.keys(), ...after.keys()])]
    .filter((id) => !isDeepStrictEqual(before.get(id), after.get(id)))
    .sort((left, right) => Number(left.slice(5)) - Number(right.slice(5)));
}

function expectedValues(ids, document) {
  const rules = rulesById(document);
  return Object.fromEntries(ids.map((id) => [id, rules.get(id) ?? null]));
}

function expectedSurfaces(ids, baseDocument, proposedDocument) {
  const before = rulesById(baseDocument);
  const after = rulesById(proposedDocument);
  return [...new Set(ids.flatMap((id) => [
    ...(before.get(id)?.surfaces ?? []),
    ...(after.get(id)?.surfaces ?? []),
  ]))].sort();
}

function validateRecord(record, recordPath, context) {
  const errors = [];
  if (!exactKeys(record, RECORD_KEYS, "Change record", errors)) return errors;
  const stem = path.posix.basename(recordPath, ".json");
  if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.id) || record.id !== stem) {
    errors.push("Change record id must equal its date-prefixed filename stem.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date) || !record.id.startsWith(`${record.date}-`)) {
    errors.push("Change record date must be YYYY-MM-DD and match its id prefix.");
  } else if (new Date(`${record.date}T00:00:00Z`).toISOString().slice(0, 10) !== record.date) {
    errors.push("Change record date must be a real calendar date.");
  }
  for (const field of ["title", "summary", "reason", "whatDidNotChange"]) {
    if (!nonEmptyString(record[field])) errors.push(`Change record ${field} must be a non-empty string.`);
  }
  if (!CLASSIFICATIONS.has(record.classification)) errors.push("Change record classification is invalid.");
  if (!isDeepStrictEqual(record.affectedRuleIds, context.ruleIds)) {
    errors.push("Change record affectedRuleIds must exactly equal the changed rule IDs.");
  }
  if (!isDeepStrictEqual(record.affectedPolicyIds, context.policyIds)) {
    errors.push("Change record affectedPolicyIds must exactly equal the changed policy IDs.");
  }
  if (!isDeepStrictEqual(record.affectedSurfaces, context.surfaces)) {
    errors.push("Change record affectedSurfaces must exactly equal the changed rules' surface union.");
  }
  if (!isDeepStrictEqual(record.previousValues, expectedValues(context.ruleIds, context.baseDocument))) {
    errors.push("Change record previousValues must deep-equal the previous rule objects.");
  }
  if (!isDeepStrictEqual(record.newValues, expectedValues(context.ruleIds, context.proposedDocument))) {
    errors.push("Change record newValues must deep-equal the proposed rule objects.");
  }
  if (!Array.isArray(record.supportingLinks)) {
    errors.push("Change record supportingLinks must be an array.");
  } else {
    for (const [index, link] of record.supportingLinks.entries()) {
      const label = `Supporting link ${index + 1}`;
      if (!exactKeys(link, ["title", "url"], label, errors)) continue;
      if (!nonEmptyString(link.title) || !publicHttps(link.url)) {
        errors.push(`${label} requires a title and public HTTPS URL.`);
      }
    }
  }
  return errors;
}

function policyId(filePath) {
  const match = filePath.match(/^platform\/([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/);
  return match && match[1] !== "README" ? match[1] : null;
}

function recordPath(filePath) {
  return /^changes\/[^/]+\.(?:md|json)$/.test(filePath);
}

export function normalizeRepoPath(value) {
  return String(value ?? "").replaceAll("\\", "/").replace(/^\.\//, "");
}

export function validateChangeSet({ baseFiles = {}, proposedFiles = {}, changes = [] }) {
  const errors = [];
  const normalizedChanges = changes.map((change) => ({
    status: change.status,
    path: normalizeRepoPath(change.path),
  }));
  const baseSource = baseFiles[RULES_PATH];
  const proposedSource = proposedFiles[RULES_PATH];
  const baseDocument = baseSource === undefined ? null : parseJson(baseSource, "Base campaign rules", errors);
  const proposedDocument = proposedSource === undefined ? null : parseJson(proposedSource, "Proposed campaign rules", errors);
  if (proposedDocument === null) errors.push(`Proposed repository must contain ${RULES_PATH}.`);
  else errors.push(...validateRulesDocument(proposedDocument));
  if (baseDocument !== null) errors.push(...validateRulesDocument(baseDocument).map((error) => `Base: ${error}`));

  for (const change of normalizedChanges) {
    if (recordPath(change.path) && baseFiles[change.path] !== undefined && change.status !== "A") {
      errors.push(`Existing change records cannot be modified or deleted: ${change.path}.`);
    }
    if (change.path === "CAMPAIGN-RULES.md") {
      errors.push("CAMPAIGN-RULES.md is historical migration evidence and must remain unchanged.");
    }
  }

  const newJsonRecords = normalizedChanges.filter(
    (change) => change.status === "A" && /^changes\/\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(change.path),
  );
  const invalidNewRecords = normalizedChanges.filter(
    (change) => change.status === "A" && /^changes\//.test(change.path) && change.path !== "changes/.gitkeep" && !newJsonRecords.includes(change),
  );
  for (const change of invalidNewRecords) errors.push(`New change records must use changes/YYYY-MM-DD-slug.json: ${change.path}.`);

  const migration = baseSource === undefined && proposedSource !== undefined;
  const changedPolicies = normalizedChanges.map((change) => policyId(change.path)).filter(Boolean).sort();
  const uniquePolicyIds = [...new Set(changedPolicies)];
  if (migration) {
    if (uniquePolicyIds.length) errors.push("Initial structured-rule migration cannot change platform policy Markdown.");
    if (newJsonRecords.length) errors.push("Initial structured-rule migration must not add a public change record.");
    return errors;
  }

  if (baseDocument === null || proposedDocument === null) return errors;
  const ruleIds = changedRuleIds(baseDocument, proposedDocument);
  const politicalChange = ruleIds.length > 0 || uniquePolicyIds.length > 0;
  const infrastructureChanges = normalizedChanges
    .map((change) => change.path)
    .filter((filePath) => INFRASTRUCTURE_PATHS.some((pattern) => pattern.test(filePath)));
  if (politicalChange && infrastructureChanges.length) {
    errors.push(`Political data changes cannot be mixed with infrastructure or governance changes: ${infrastructureChanges.join(", ")}.`);
  }
  if (!politicalChange) {
    if (newJsonRecords.length) errors.push("A change record may be added only with a political data change.");
    return errors;
  }
  if (newJsonRecords.length !== 1) {
    errors.push("Political data changes require exactly one new JSON change record.");
    return errors;
  }

  const source = proposedFiles[newJsonRecords[0].path];
  if (source === undefined) {
    errors.push(`Missing proposed change-record content: ${newJsonRecords[0].path}.`);
    return errors;
  }
  const record = parseJson(source, newJsonRecords[0].path, errors);
  if (record !== null) {
    errors.push(...validateRecord(record, newJsonRecords[0].path, {
      ruleIds,
      policyIds: uniquePolicyIds,
      surfaces: expectedSurfaces(ruleIds, baseDocument, proposedDocument),
      baseDocument,
      proposedDocument,
    }));
  }
  return errors;
}

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

function readGitFile(root, revision, filePath) {
  try {
    return git(["show", `${revision}:${filePath}`], { cwd: root });
  } catch {
    return undefined;
  }
}

export function runCli() {
  const root = path.resolve(argument("--repo-root") ?? git(["rev-parse", "--show-toplevel"]));
  const head = argument("--head") ?? process.env.GITHUB_SHA;
  let base = argument("--base") ?? process.env.GITHUB_BASE_SHA;
  if (!base) {
    try {
      base = git(["merge-base", "HEAD", "origin/main"], { cwd: root });
    } catch {
      base = "HEAD";
    }
  }
  const range = head ? `${base}..${head}` : base;
  const diff = git(["diff", "--name-status", "--find-renames", range, "--"], { cwd: root });
  const changes = diff ? diff.split("\n").flatMap((line) => {
    const columns = line.split("\t");
    if (columns[0].startsWith("R")) {
      return [{ status: "D", path: columns[1] }, { status: "A", path: columns[2] }];
    }
    return [{ status: columns[0][0], path: columns[1] }];
  }) : [];
  if (!head) {
    const untracked = git(["ls-files", "--others", "--exclude-standard"], { cwd: root });
    for (const filePath of untracked ? untracked.split("\n") : []) changes.push({ status: "A", path: filePath });
  }

  const paths = new Set([RULES_PATH, ...changes.map((change) => normalizeRepoPath(change.path))]);
  const baseFiles = {};
  const proposedFiles = {};
  for (const filePath of paths) {
    const baseValue = readGitFile(root, base, filePath);
    if (baseValue !== undefined) baseFiles[filePath] = baseValue;
    if (head) {
      const proposedValue = readGitFile(root, head, filePath);
      if (proposedValue !== undefined) proposedFiles[filePath] = proposedValue;
    } else {
      const absolutePath = path.join(root, filePath);
      if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
        proposedFiles[filePath] = fs.readFileSync(absolutePath, "utf8");
      }
    }
  }

  const errors = validateChangeSet({ baseFiles, proposedFiles, changes });
  if (errors.length) {
    console.error("Change-record validation failed:");
    for (const error of errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`Change-record validation passed (${base.slice(0, 12)} -> ${head?.slice(0, 12) ?? "working tree"}).`);
  return 0;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = runCli();
}

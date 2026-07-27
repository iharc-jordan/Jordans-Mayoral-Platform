import path from "node:path";

export const BASELINE_COMMIT = "573d624fdd000da86eca654f882f02c01f6fa29c";
export const TRACKING_BOUNDARY = "2026-07-24T09:00:00-04:00";

export const CLASSIFICATIONS = Object.freeze([
  "clarification",
  "evidence-update",
  "cost-or-timeline-update",
  "scope-expansion",
  "scope-reduction",
  "position-change",
  "policy-withdrawal",
  "administrative-correction",
]);

export const COMMITMENT_EFFECTS = Object.freeze([
  "no-material-change",
  "expands",
  "reduces",
  "changes-position",
  "withdraws",
]);

export const COMPATIBLE_EFFECTS = Object.freeze({
  clarification: ["no-material-change"],
  "evidence-update": ["no-material-change"],
  "cost-or-timeline-update": ["no-material-change", "expands", "reduces"],
  "scope-expansion": ["expands"],
  "scope-reduction": ["reduces"],
  "position-change": ["changes-position"],
  "policy-withdrawal": ["withdraws"],
  "administrative-correction": ["no-material-change"],
});

export const REQUIRED_FIELDS = Object.freeze([
  "id",
  "date",
  "effective_date",
  "version",
  "classification",
  "effect_on_commitment",
  "affected_records",
  "affected_website_pages",
  "affected_public_artifacts",
]);

export const REQUIRED_SECTIONS = Object.freeze([
  "What changed",
  "Why it changed",
  "Previous wording",
  "New wording",
  "Effect on the commitment",
  "What did not change",
  "Supporting evidence",
  "Public implementation",
]);

export const NEW_COMMITMENT_MARKER = "Not applicable: new commitment";
export const WITHDRAWAL_MARKER = "Not applicable: commitment withdrawn";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ID_PATTERN = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION_PATTERN = /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;
const ROUTE_PATTERN = /^\/(?!\/)(?:[a-z0-9][a-z0-9-]*)(?:\/[a-z0-9][a-z0-9-]*)*$/;
const ARTIFACT_PATTERN = /^\/(?!\/)(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/;
const RECORD_PATTERN = /^(?:CAMPAIGN-RULES\.md|platform\/[a-z0-9]+(?:-[a-z0-9]+)*\.md)$/;
const RECORD_FILE_PATTERN = /^changes\/[^/]+\.md$/;

function isValidDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseFrontMatter(source) {
  const normalized = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (!normalized.startsWith("---\n")) {
    throw new Error("Change record must begin with YAML front matter.");
  }
  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) {
    throw new Error("Change record front matter is not closed.");
  }

  const frontMatter = normalized.slice(4, end);
  const data = {};
  let currentArray = null;

  for (const [index, rawLine] of frontMatter.split("\n").entries()) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) continue;
    const item = rawLine.match(/^\s{2}-\s+(.+)$/);
    if (item) {
      if (!currentArray) {
        throw new Error(`Unexpected YAML list item on front matter line ${index + 1}.`);
      }
      data[currentArray].push(unquote(item[1]));
      continue;
    }

    const field = rawLine.match(/^([a-z_]+):(?:\s*(.*))?$/);
    if (!field) {
      throw new Error(`Unsupported YAML syntax on front matter line ${index + 1}.`);
    }
    const [, key, rawValue = ""] = field;
    if (Object.hasOwn(data, key)) throw new Error(`Duplicate front matter field: ${key}.`);
    const value = rawValue.trim();
    if (value === "") {
      data[key] = [];
      currentArray = key;
    } else if (value === "[]") {
      data[key] = [];
      currentArray = null;
    } else {
      data[key] = unquote(value);
      currentArray = null;
    }
  }

  return { data, body: normalized.slice(end + 5) };
}

export function parseSections(body) {
  const titleMatch = body.match(/^#\s+(.+)$/m);
  if (!titleMatch) throw new Error("Change record requires one human-readable H1 title.");
  const sections = {};
  const headingPattern = /^##\s+(.+)\s*$/gm;
  const headings = [...body.matchAll(headingPattern)];
  for (const [index, heading] of headings.entries()) {
    const name = heading[1].trim();
    if (Object.hasOwn(sections, name)) throw new Error(`Duplicate section: ${name}.`);
    const start = heading.index + heading[0].length;
    const end = headings[index + 1]?.index ?? body.length;
    sections[name] = body.slice(start, end).trim();
  }
  return { title: titleMatch[1].trim(), sections };
}

export function normalizeMarkdown(value) {
  return value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/<!--[^]*?-->/g, " ")
    .replace(/```[^\n]*\n([^]*?)```/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(?:#{1,6}|>|[-+*]|\d+[.)])\s+/gm, "")
    .replace(/[*_~`]/g, "")
    .replace(/\\([\\`*_[\]{}()#+.!>-])/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en-CA");
}

export function semanticBlocks(value) {
  const normalized = value.replace(/\r\n?/g, "\n");
  const blocks = [];
  let paragraph = [];
  const flush = () => {
    const block = normalizeMarkdown(paragraph.join(" "));
    if (block) blocks.push(block);
    paragraph = [];
  };
  for (const line of normalized.split("\n")) {
    if (!line.trim()) {
      flush();
    } else if (/^\s{0,3}(?:#{1,6}|>|[-+*]|\d+[.)])\s+/.test(line)) {
      flush();
      const block = normalizeMarkdown(line);
      if (block) blocks.push(block);
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

function contentBlocks(value) {
  const normalized = value.replace(/\r\n?/g, "\n");
  const withoutFrontMatter = normalized.startsWith("---\n")
    ? normalized.replace(/^---\n[^]*?\n---\n/, "")
    : normalized;
  return semanticBlocks(withoutFrontMatter);
}

export function semanticDelta(previous, proposed) {
  const before = contentBlocks(previous);
  const after = contentBlocks(proposed);
  const lengths = Array.from({ length: before.length + 1 }, () => new Uint32Array(after.length + 1));

  for (let left = before.length - 1; left >= 0; left -= 1) {
    for (let right = after.length - 1; right >= 0; right -= 1) {
      lengths[left][right] =
        before[left] === after[right]
          ? lengths[left + 1][right + 1] + 1
          : Math.max(lengths[left + 1][right], lengths[left][right + 1]);
    }
  }

  const removed = [];
  const added = [];
  let left = 0;
  let right = 0;
  while (left < before.length && right < after.length) {
    if (before[left] === after[right]) {
      left += 1;
      right += 1;
    } else if (lengths[left + 1][right] >= lengths[left][right + 1]) {
      removed.push(before[left]);
      left += 1;
    } else {
      added.push(after[right]);
      right += 1;
    }
  }
  removed.push(...before.slice(left));
  added.push(...after.slice(right));
  return { removed, added };
}

export function isTrackedPoliticalRecord(filePath) {
  return RECORD_PATTERN.test(filePath);
}

function validateExactScope(recordPaths, changedTrackedPaths, errors) {
  const declared = [...new Set(recordPaths)].sort();
  const changed = [...new Set(changedTrackedPaths)].sort();
  if (declared.length !== recordPaths.length) errors.push("affected_records contains a duplicate path.");
  const omitted = changed.filter((item) => !declared.includes(item));
  const unrelated = declared.filter((item) => !changed.includes(item));
  if (omitted.length) errors.push(`affected_records omits changed record(s): ${omitted.join(", ")}.`);
  if (unrelated.length) errors.push(`affected_records lists unchanged record(s): ${unrelated.join(", ")}.`);
}

function blocksMatch(claim, changedBlock) {
  return changedBlock.includes(claim) || claim.includes(changedBlock);
}

function validateChangedWording({ previous, next, affectedRecords, baseFiles, proposedFiles, isAddition, isWithdrawal, errors }) {
  const previousClaims = isAddition ? [] : semanticBlocks(previous);
  const nextClaims = isWithdrawal ? [] : semanticBlocks(next);
  if (!isAddition && !previousClaims.length) errors.push("Previous wording must contain substantive wording.");
  if (!isWithdrawal && !nextClaims.length) errors.push("New wording must contain substantive wording.");

  const deltas = affectedRecords.map((recordPath) => ({
    recordPath,
    ...semanticDelta(baseFiles[recordPath] ?? "", proposedFiles[recordPath] ?? ""),
  }));

  for (const delta of deltas) {
    const previousMatches = previousClaims.filter((claim) => delta.removed.some((block) => blocksMatch(claim, block)));
    const nextMatches = nextClaims.filter((claim) => delta.added.some((block) => blocksMatch(claim, block)));
    if (!delta.removed.length && !delta.added.length) {
      errors.push(`Affected record has no semantic Markdown change: ${delta.recordPath}.`);
    } else if (isAddition && !nextMatches.length) {
      errors.push(`No claimed new wording is tied to the semantic addition in ${delta.recordPath}.`);
    } else if (isWithdrawal && !previousMatches.length) {
      errors.push(`No claimed previous wording is tied to the semantic withdrawal in ${delta.recordPath}.`);
    } else if (!isAddition && !isWithdrawal && (!previousMatches.length || !nextMatches.length)) {
      errors.push(`Claimed previous and new wording must both be tied to the semantic change in ${delta.recordPath}.`);
    }
  }

  for (const claim of previousClaims) {
    if (!deltas.some((delta) => delta.removed.some((block) => blocksMatch(claim, block)))) {
      errors.push(`Previous wording is present but is not part of the actual semantic change: ${claim.slice(0, 80)}.`);
    }
  }
  for (const claim of nextClaims) {
    if (!deltas.some((delta) => delta.added.some((block) => blocksMatch(claim, block)))) {
      errors.push(`New wording is present but is not part of the actual semantic change: ${claim.slice(0, 80)}.`);
    }
  }
}

function evidenceItems(section) {
  const links = [];
  const pattern = /^\s*[-*]\s+\[([^\]]+)\]\((https:\/\/[^\s)]+)\)\s*(?:[-–—:]\s*)(.+)$/gm;
  for (const match of section.matchAll(pattern)) {
    links.push({ label: match[1].trim(), href: match[2], explanation: match[3].trim() });
  }
  return links;
}

function validatePrivateContent(source, errors) {
  const prohibited = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
    /\b(?:password|api[_ -]?key|secret|access[_ -]?token)\s*[:=]\s*\S+/i,
    /\b(?:internal|private):\/\//i,
    /https:\/\/github\.com\/[^\s)]+\/(?:issues|pull)\/\d+\?private=true/i,
  ];
  if (prohibited.some((pattern) => pattern.test(source))) {
    errors.push("Change record contains a prohibited private or credential-like value.");
  }
}

export function validateRecord({ recordPath, source, baseFiles, proposedFiles, changedTrackedPaths }) {
  const errors = [];
  let parsed;
  let document;
  try {
    parsed = parseFrontMatter(source);
    document = parseSections(parsed.body);
  } catch (error) {
    return [error.message];
  }

  const { data } = parsed;
  for (const field of REQUIRED_FIELDS) {
    if (!Object.hasOwn(data, field)) errors.push(`Missing required front matter field: ${field}.`);
  }
  for (const field of Object.keys(data)) {
    if (!REQUIRED_FIELDS.includes(field)) errors.push(`Unexpected front matter field: ${field}.`);
  }
  for (const section of REQUIRED_SECTIONS) {
    if (!document.sections[section]?.trim()) errors.push(`Missing or empty required section: ${section}.`);
  }
  for (const section of Object.keys(document.sections)) {
    if (!REQUIRED_SECTIONS.includes(section)) errors.push(`Unexpected H2 section: ${section}.`);
  }
  if (errors.length) return errors;

  const arrays = ["affected_records", "affected_website_pages", "affected_public_artifacts"];
  for (const field of arrays) {
    if (!Array.isArray(data[field])) errors.push(`${field} must be a YAML list.`);
  }
  for (const field of REQUIRED_FIELDS.filter((item) => !arrays.includes(item))) {
    if (typeof data[field] !== "string" || !data[field].trim()) errors.push(`${field} must be a non-empty string.`);
  }
  if (errors.length) return errors;

  const expectedPath = `changes/${data.id}.md`;
  if (!ID_PATTERN.test(data.id)) errors.push("id must be a dated, lowercase, URL-safe identifier.");
  if (recordPath !== expectedPath) errors.push(`Record path must be ${expectedPath}.`);
  if (!isValidDate(data.date)) errors.push("date must be a valid YYYY-MM-DD date.");
  if (!isValidDate(data.effective_date)) errors.push("effective_date must be a valid YYYY-MM-DD date.");
  if (isValidDate(data.date) && !data.id.startsWith(`${data.date}-`)) errors.push("id must begin with the record date.");
  if (!VERSION_PATTERN.test(data.version) || data.version === "v1.0.0") errors.push("version must be a later semantic version such as v1.0.1 or v1.1.0.");
  if (!CLASSIFICATIONS.includes(data.classification)) errors.push(`Invalid classification: ${data.classification}.`);
  if (!COMMITMENT_EFFECTS.includes(data.effect_on_commitment)) errors.push(`Invalid effect_on_commitment: ${data.effect_on_commitment}.`);
  if (!COMPATIBLE_EFFECTS[data.classification]?.includes(data.effect_on_commitment)) {
    errors.push(`Incompatible classification/effect pair: ${data.classification}/${data.effect_on_commitment}.`);
  }
  if (!data.affected_records.length) errors.push("affected_records must list at least one political record.");
  for (const item of data.affected_records) {
    if (!RECORD_PATTERN.test(item)) errors.push(`Affected record is not allowlisted: ${item}.`);
  }
  for (const item of data.affected_website_pages) {
    if (!ROUTE_PATTERN.test(item)) errors.push(`Malformed website route: ${item}.`);
  }
  for (const item of data.affected_public_artifacts) {
    if (!ARTIFACT_PATTERN.test(item) || item.split("/").some((segment) => segment === "." || segment === "..")) {
      errors.push(`Malformed public artifact path: ${item}.`);
    }
  }
  validateExactScope(data.affected_records, changedTrackedPaths, errors);

  const previous = document.sections["Previous wording"];
  const next = document.sections["New wording"];
  const isAddition = previous === NEW_COMMITMENT_MARKER;
  const isWithdrawal = next === WITHDRAWAL_MARKER;
  if (previous.includes("Not applicable:") && !isAddition) errors.push(`Previous wording may use only: ${NEW_COMMITMENT_MARKER}.`);
  if (next.includes("Not applicable:") && !isWithdrawal) errors.push(`New wording may use only: ${WITHDRAWAL_MARKER}.`);
  if (isAddition && !(data.classification === "scope-expansion" && data.effect_on_commitment === "expands")) {
    errors.push("A new commitment must be classified as scope-expansion with effect expands.");
  }
  if (isWithdrawal && !(data.classification === "policy-withdrawal" && data.effect_on_commitment === "withdraws")) {
    errors.push("A withdrawal must be classified as policy-withdrawal with effect withdraws.");
  }
  if (isAddition && isWithdrawal) errors.push("A record cannot be both an addition and a withdrawal.");

  const priorAffected = Object.fromEntries(data.affected_records.map((item) => [item, baseFiles[item] ?? ""]));
  const nextAffected = Object.fromEntries(data.affected_records.map((item) => [item, proposedFiles[item] ?? ""]));
  validateChangedWording({
    previous,
    next,
    affectedRecords: data.affected_records,
    baseFiles: priorAffected,
    proposedFiles: nextAffected,
    isAddition,
    isWithdrawal,
    errors,
  });
  if (isAddition) {
    const priorContents = Object.values(priorAffected).map(normalizeMarkdown);
    if (semanticBlocks(next).some((block) => priorContents.some((content) => content.includes(block)))) {
      errors.push("The new-commitment marker is invalid because the declared new wording already exists in the predecessor state.");
    }
  }

  const evidence = evidenceItems(document.sections["Supporting evidence"]);
  if (!evidence.length) errors.push("Supporting evidence must include at least one public HTTPS Markdown link with an explanation.");
  const linkCount = [...document.sections["Supporting evidence"].matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].length;
  if (linkCount !== evidence.length) errors.push("Every supporting-evidence link must use HTTPS and include explanatory text.");

  const implementation = normalizeMarkdown(document.sections["Public implementation"]);
  for (const item of [...data.affected_website_pages, ...data.affected_public_artifacts]) {
    if (!implementation.includes(normalizeMarkdown(item))) errors.push(`Public implementation does not identify ${item}.`);
  }
  if (![...data.affected_website_pages, ...data.affected_public_artifacts].length && !/no public (?:website page|artifact|implementation)/i.test(document.sections["Public implementation"])) {
    errors.push("Public implementation must explicitly state when no public page or artifact change is required.");
  }
  if (/^everything else\.?$/i.test(document.sections["What did not change"].trim())) {
    errors.push("What did not change must be specific rather than boilerplate.");
  }
  validatePrivateContent(source, errors);
  return errors;
}

export function validateChangeSet({ baseFiles, proposedFiles, changes }) {
  const errors = [];
  const changedPaths = [...new Set(changes.map((change) => change.path))];
  const changedTrackedPaths = changedPaths.filter(isTrackedPoliticalRecord);
  const newRecords = changes.filter((change) => change.status === "A" && RECORD_FILE_PATTERN.test(change.path));
  const historicalRecordChanges = changes.filter((change) => change.status !== "A" && RECORD_FILE_PATTERN.test(change.path));

  if (historicalRecordChanges.length) {
    errors.push(`Historical change records are immutable: ${historicalRecordChanges.map((item) => item.path).join(", ")}.`);
  }
  if (changedTrackedPaths.length && newRecords.length !== 1) {
    errors.push(`A political change requires exactly one new immutable record; found ${newRecords.length}.`);
  }
  if (!changedTrackedPaths.length && newRecords.length) {
    errors.push("A change record cannot be added without a tracked political-record change.");
  }
  if (!changedTrackedPaths.length || newRecords.length !== 1) return errors;

  const recordPath = newRecords[0].path;
  const source = proposedFiles[recordPath];
  if (typeof source !== "string") {
    errors.push(`Unable to read new change record: ${recordPath}.`);
    return errors;
  }
  errors.push(...validateRecord({ recordPath, source, baseFiles, proposedFiles, changedTrackedPaths }));
  if (!changedPaths.includes("CHANGELOG.md")) errors.push("A political change must update CHANGELOG.md.");
  else {
    try {
      const { data } = parseFrontMatter(source);
      const changelog = proposedFiles["CHANGELOG.md"] ?? "";
      if (!changelog.includes(data.version)) errors.push(`CHANGELOG.md does not include ${data.version}.`);
      if (!changelog.includes(`changes/${data.id}.md`)) errors.push(`CHANGELOG.md does not link to changes/${data.id}.md.`);
    } catch {
      // The record parser already reports the actionable error.
    }
  }
  return errors;
}

export function normalizeRepoPath(value) {
  return value.split(path.sep).join("/");
}

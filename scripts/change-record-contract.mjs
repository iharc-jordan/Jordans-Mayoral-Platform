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

export const OPTIONAL_FIELDS = Object.freeze(["affected_rule_sections"]);

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
const ROUTE_PATTERN = /^(?:\/|\/(?!\/)(?:[a-z0-9][a-z0-9-]*)(?:\/[a-z0-9][a-z0-9-]*)*)$/;
const ARTIFACT_PATTERN = /^\/(?!\/)(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/;
const RECORD_PATTERN = /^(?:CAMPAIGN-RULES\.md|platform\/[a-z0-9]+(?:-[a-z0-9]+)*\.md)$/;
const RECORD_FILE_PATTERN = /^changes\/[^/]+\.md$/;
const RULE_SECTION_PATTERN = /^rule-(?:[1-9]|1[0-8])$/;
export const PLATFORM_DOCUMENTATION_ALLOWLIST = Object.freeze(["platform/README.md"]);
export const ADMINISTRATIVE_FRONT_MATTER_ALLOWLIST = Object.freeze([]);
export const MAX_SEMANTIC_BLOCKS = 512;
export const MAX_SEMANTIC_COMPARISONS = 100_000;
const VALIDATION_MACHINERY_PATTERNS = Object.freeze([
  /^scripts\//,
  /^tests\//,
  /^\.github\/workflows\//,
  /^package(?:-lock)?\.json$/,
  /^AGENTS\.md$/,
  /^METHODOLOGY\.md$/,
  /^REPOSITORY-SETTINGS\.md$/,
  /^\.github\/pull_request_template\.md$/,
]);
const PATCH_CLASSIFICATIONS = new Set(["clarification", "administrative-correction"]);
const MINOR_CLASSIFICATIONS = new Set([
  "evidence-update",
  "cost-or-timeline-update",
  "scope-expansion",
  "scope-reduction",
  "position-change",
  "policy-withdrawal",
]);
const CLASSIFICATION_LABELS = Object.freeze({
  clarification: "Clarification",
  "evidence-update": "Evidence update",
  "cost-or-timeline-update": "Cost or timeline update",
  "scope-expansion": "Scope expansion",
  "scope-reduction": "Scope reduction",
  "position-change": "Position change",
  "policy-withdrawal": "Policy withdrawal",
  "administrative-correction": "Administrative correction",
});

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

export function renderedMarkdown(source) {
  const withoutComments = source.replace(/<!--[^]*?-->/g, "");
  const visible = [];
  let fence = null;
  let htmlBlock = null;
  const htmlBlockStart = /^\s{0,3}<(address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|>|\/|$)/i;
  for (const line of withoutComments.replace(/\r\n?/g, "\n").split("\n")) {
    if (htmlBlock && !line.trim()) htmlBlock = null;
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (marker) {
      const character = marker[1][0];
      if (!fence) fence = { character, length: marker[1].length };
      else if (fence.character === character && marker[1].length >= fence.length) fence = null;
      visible.push("");
      continue;
    }
    if (!fence && !htmlBlock) htmlBlock = line.match(htmlBlockStart)?.[1]?.toLowerCase() ?? null;
    if (fence || htmlBlock || /^(?: {4}|\t)/.test(line)) visible.push("");
    else visible.push(line);
    if (htmlBlock && new RegExp(`</${htmlBlock}\\s*>`, "i").test(line)) htmlBlock = null;
  }
  return visible.join("\n");
}

export function parseSections(body) {
  const rendered = renderedMarkdown(body);
  const titleMatch = rendered.match(/^#\s+(.+)$/m);
  if (!titleMatch) throw new Error("Change record requires one human-readable H1 title.");
  const sections = {};
  const headingPattern = /^##\s+(.+)\s*$/gm;
  const headings = [...rendered.matchAll(headingPattern)];
  for (const [index, heading] of headings.entries()) {
    const name = heading[1].trim();
    if (Object.hasOwn(sections, name)) throw new Error(`Duplicate section: ${name}.`);
    const start = heading.index + heading[0].length;
    const end = headings[index + 1]?.index ?? rendered.length;
    sections[name] = rendered.slice(start, end).trim();
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
  let body = normalized;
  const frontMatterBlocks = [];
  if (normalized.startsWith("---\n")) {
    const end = normalized.indexOf("\n---\n", 4);
    if (end !== -1) {
      const lines = normalized.slice(4, end).split("\n");
      let field = null;
      let values = [];
      const flush = () => {
        if (field && !ADMINISTRATIVE_FRONT_MATTER_ALLOWLIST.includes(field)) {
          const block = normalizeMarkdown(`${field}: ${values.join(" ")}`);
          if (block) frontMatterBlocks.push(block);
        }
        field = null;
        values = [];
      };
      for (const rawLine of lines) {
        if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) continue;
        const nextField = rawLine.match(/^([A-Za-z_][A-Za-z0-9_-]*):(?:\s*(.*))?$/);
        if (nextField) {
          flush();
          field = nextField[1];
          values = nextField[2]?.trim() ? [unquote(nextField[2])] : [];
        } else if (field) {
          values.push(rawLine.trim().replace(/^[-*]\s+/, ""));
        }
      }
      flush();
      body = normalized.slice(end + 5);
    }
  }
  return [...frontMatterBlocks.sort(), ...semanticBlocks(body)];
}

export function semanticDelta(previous, proposed) {
  const before = contentBlocks(previous);
  const after = contentBlocks(proposed);
  if (
    before.length > MAX_SEMANTIC_BLOCKS
    || after.length > MAX_SEMANTIC_BLOCKS
    || before.length * after.length > MAX_SEMANTIC_COMPARISONS
  ) {
    return {
      removed: [],
      added: [],
      complexityError: `Semantic comparison exceeds the explicit limit of ${MAX_SEMANTIC_BLOCKS} blocks and ${MAX_SEMANTIC_COMPARISONS} comparisons.`,
    };
  }
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

function campaignRuleSections(source) {
  const normalized = source
    .replace(/\r\n?/g, "\n")
    .replace(/<!--[^]*?-->/g, (comment) => comment.replace(/[^\n]/g, ""));
  const sections = new Map();
  const unscoped = [];
  let current = null;
  let fence = null;
  let htmlBlock = null;
  let visibleHeadingCount = 0;
  const htmlBlockStart = /^\s{0,3}<(address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|>|\/|$)/i;
  const lines = normalized.split("\n");
  for (const line of lines) {
    if (htmlBlock && !line.trim()) htmlBlock = null;
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    const hidden = Boolean(fence || htmlBlock || /^(?: {4}|\t)/.test(line));
    const setextBoundary = !hidden && !marker && /^ {0,3}(?:=+|-+)\s*$/.test(line);
    if (setextBoundary) {
      const active = current ? sections.get(current) : unscoped;
      let start = active.length;
      while (start && active[start - 1].trim()) start -= 1;
      if (start < active.length && !/^\s{0,3}#{1,6}(?:\s|$)/.test(active[start])) {
        unscoped.push(...active.splice(start), line);
        current = null;
        continue;
      }
    }
    const htmlHeading = !fence && !htmlBlock && /^\s{0,3}<h[12](?:\s|>|\/|$)/i.test(line);
    if (htmlHeading) current = null;
    const heading = !hidden && !marker ? line.match(/^(#{1,2})(?:[ \t]+(.*))?[ \t]*$/) : null;
    if (heading) {
      visibleHeadingCount += 1;
      if (visibleHeadingCount > MAX_SEMANTIC_BLOCKS) {
        throw new Error(`Campaign-rule section parsing exceeds the explicit limit of ${MAX_SEMANTIC_BLOCKS} headings.`);
      }
      const numbered = heading[1] === "##" && heading[2].match(/^([1-9]|1[0-8])\.\s+.+$/);
      if (numbered) {
        const id = `rule-${numbered[1]}`;
        if (sections.has(id)) throw new Error(`Duplicate campaign-rule section: ${id}.`);
        current = id;
        sections.set(id, []);
      } else {
        current = null;
      }
    }
    (current ? sections.get(current) : unscoped).push(line);
    if (marker) {
      const character = marker[1][0];
      if (!fence) fence = { character, length: marker[1].length };
      else if (fence.character === character && marker[1].length >= fence.length) fence = null;
    } else {
      if (!fence && !htmlBlock) htmlBlock = line.match(htmlBlockStart)?.[1]?.toLowerCase() ?? null;
      if (htmlBlock && new RegExp(`</${htmlBlock}\\s*>`, "i").test(line)) htmlBlock = null;
    }
  }
  return {
    sections: new Map([...sections].map(([id, lines]) => [id, lines.join("\n").trim()])),
    unscoped: unscoped.join("\n")
  };
}

export function changedCampaignRuleSections(previous, proposed) {
  let before;
  let after;
  try {
    before = campaignRuleSections(previous);
    after = campaignRuleSections(proposed);
  } catch (error) {
    return { changed: [], errors: [error.message] };
  }
  const ids = [...new Set([...before.sections.keys(), ...after.sections.keys()])]
    .sort((left, right) => Number(left.slice(5)) - Number(right.slice(5)));
  const changed = [];
  const errors = [];
  for (const id of ids) {
    const delta = semanticDelta(before.sections.get(id) ?? "", after.sections.get(id) ?? "");
    if (delta.complexityError) errors.push(`${id}: ${delta.complexityError}`);
    else if (delta.removed.length || delta.added.length) changed.push(id);
  }
  const unscopedDelta = semanticDelta(before.unscoped, after.unscoped);
  if (unscopedDelta.complexityError) errors.push(`CAMPAIGN-RULES.md outside numbered rules: ${unscopedDelta.complexityError}`);
  else if (unscopedDelta.removed.length || unscopedDelta.added.length) {
    errors.push("CAMPAIGN-RULES.md has a semantic change outside numbered rule sections.");
  }
  return { changed, errors };
}

function validateCampaignRuleScope(data, baseFiles, proposedFiles, errors) {
  const affectsCampaignRules = data.affected_records.includes("CAMPAIGN-RULES.md");
  if (!affectsCampaignRules) {
    if (Object.hasOwn(data, "affected_rule_sections")) {
      errors.push("affected_rule_sections is allowed only when CAMPAIGN-RULES.md is affected.");
    }
    return;
  }
  if (!Object.hasOwn(data, "affected_rule_sections")) {
    errors.push("Missing required front matter field for CAMPAIGN-RULES.md: affected_rule_sections.");
    return;
  }
  if (!Array.isArray(data.affected_rule_sections)) {
    errors.push("affected_rule_sections must be a YAML list.");
    return;
  }
  const declared = data.affected_rule_sections;
  if (!declared.length) errors.push("affected_rule_sections must list at least one numbered rule section.");
  if (new Set(declared).size !== declared.length) errors.push("affected_rule_sections contains a duplicate section.");
  for (const section of declared) {
    if (typeof section !== "string" || !RULE_SECTION_PATTERN.test(section)) {
      errors.push(`Invalid campaign-rule section identifier: ${section}.`);
    }
  }
  const derived = changedCampaignRuleSections(
    baseFiles["CAMPAIGN-RULES.md"] ?? "",
    proposedFiles["CAMPAIGN-RULES.md"] ?? "",
  );
  errors.push(...derived.errors);
  const omitted = derived.changed.filter((section) => !declared.includes(section));
  const unchanged = declared.filter((section) => !derived.changed.includes(section));
  if (omitted.length) errors.push(`affected_rule_sections omits changed section(s): ${omitted.join(", ")}.`);
  if (unchanged.length) errors.push(`affected_rule_sections lists unchanged or incorrect section(s): ${unchanged.join(", ")}.`);
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
  return claim === changedBlock;
}

function sameMultiset(left, right) {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
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
    if (delta.complexityError) {
      errors.push(`${delta.recordPath}: ${delta.complexityError}`);
      continue;
    }
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
    for (const block of delta.removed) {
      if (!previousClaims.some((claim) => blocksMatch(claim, block))) {
        errors.push(`Unaccounted removed semantic block in ${delta.recordPath}: ${block.slice(0, 80)}.`);
      }
    }
    for (const block of delta.added) {
      const explicitWithdrawalStatus = isWithdrawal && /^status: (?:withdrawn|retired)$/.test(block);
      if (!explicitWithdrawalStatus && !nextClaims.some((claim) => blocksMatch(claim, block))) {
        errors.push(`Unaccounted added semantic block in ${delta.recordPath}: ${block.slice(0, 80)}.`);
      }
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
  const removedBlocks = deltas.flatMap((delta) => delta.complexityError ? [] : delta.removed);
  const addedBlocks = deltas.flatMap((delta) => delta.complexityError
    ? []
    : delta.added.filter((block) => !(isWithdrawal && /^status: (?:withdrawn|retired)$/.test(block))));
  if (!deltas.some((delta) => delta.complexityError) && !sameMultiset(previousClaims, removedBlocks)) {
    errors.push("Declared previous wording must exactly cover every removed political semantic block, including duplicate occurrences.");
  }
  if (!deltas.some((delta) => delta.complexityError) && !sameMultiset(nextClaims, addedBlocks)) {
    errors.push("Declared new wording must exactly cover every added political semantic block, including duplicate occurrences.");
  }
}

function evidenceItems(section) {
  const links = [];
  const pattern = /^\s*[-*]\s+\[([^\]]+)\]\(([^\s)]+)\)\s*(?:[-–—:]\s*)(.+)$/gm;
  for (const match of section.matchAll(pattern)) {
    links.push({ label: match[1].trim(), href: match[2], explanation: match[3].trim() });
  }
  return links;
}

function isPublicHttpsUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (
    host === "::1" ||
    host === "::" ||
    host.startsWith("::ffff:") ||
    /^f[cd][0-9a-f]:/i.test(host) ||
    /^fe[89ab][0-9a-f]:/i.test(host) ||
    /^2001:db8:/i.test(host)
  ) return false;
  const octets = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)?.slice(1).map(Number);
  if (octets) {
    if (octets.some((part) => part > 255)) return false;
    const [a, b, c] = octets;
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && ((b === 0 && (c === 0 || c === 2)) || b === 168)) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    ) return false;
  } else if (!host.includes(".")) {
    return false;
  }
  return true;
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

function parseVersion(value) {
  const match = value?.match(/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  return match ? match.slice(1).map(Number) : null;
}

function visibleChangelogEntries(source) {
  const rendered = renderedMarkdown(source);
  const headings = [...rendered.matchAll(/^## \[(v\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})\s*$/gm)];
  return headings.map((heading, index) => ({
    version: heading[1],
    date: heading[2],
    body: rendered.slice(heading.index + heading[0].length, headings[index + 1]?.index ?? rendered.length).trim(),
  }));
}

function validateVersion(version, classification, baseChangelog, errors) {
  const candidate = parseVersion(version);
  if (!candidate) {
    errors.push("version must be a valid semantic version.");
    return;
  }
  const entries = visibleChangelogEntries(baseChangelog);
  const versions = entries.map((entry) => ({ text: entry.version, parts: parseVersion(entry.version) })).filter((entry) => entry.parts);
  if (!versions.length) {
    errors.push("Unable to determine the predecessor public version from CHANGELOG.md.");
    return;
  }
  if (versions.some((entry) => entry.text === version)) errors.push(`Version ${version} already exists in the predecessor changelog.`);
  versions.sort((left, right) => {
    for (let index = 0; index < 3; index += 1) {
      if (left.parts[index] !== right.parts[index]) return right.parts[index] - left.parts[index];
    }
    return 0;
  });
  const predecessor = versions[0].parts;
  let expected;
  let kind;
  if (PATCH_CLASSIFICATIONS.has(classification)) {
    expected = [predecessor[0], predecessor[1], predecessor[2] + 1];
    kind = "patch";
  } else if (MINOR_CLASSIFICATIONS.has(classification)) {
    expected = [predecessor[0], predecessor[1] + 1, 0];
    kind = "minor";
  } else {
    return;
  }
  const expectedText = `v${expected.join(".")}`;
  if (candidate.some((part, index) => part !== expected[index])) {
    errors.push(`${classification} requires the next ${kind} version; expected ${expectedText} after v${predecessor.join(".")}.`);
  }
}

function validateChangelogEntry({ baseChangelog, proposedChangelog, data, title, errors }) {
  const baseEntries = visibleChangelogEntries(baseChangelog);
  const proposedEntries = visibleChangelogEntries(proposedChangelog);
  if (baseEntries.some((entry) => entry.version === data.version)) {
    errors.push(`CHANGELOG.md must add a newly added version; ${data.version} already exists.`);
  }
  const matches = proposedEntries.filter((entry) => entry.version === data.version && entry.date === data.date);
  if (matches.length !== 1) {
    errors.push(`CHANGELOG.md requires one newly added visible changelog entry for ${data.version} dated ${data.date}.`);
    return;
  }
  const body = matches[0].body;
  const titleMatch = body.match(/^###\s+(.+)$/m);
  if (titleMatch?.[1].trim() !== title) errors.push(`CHANGELOG.md entry title must exactly match "${title}".`);
  if (!new RegExp(`^[-*] Classification: ${CLASSIFICATION_LABELS[data.classification]}\\s*$`, "m").test(body)) {
    errors.push(`CHANGELOG.md entry must identify classification ${CLASSIFICATION_LABELS[data.classification]}.`);
  }
  const affectedLine = body.match(/^[-*] Affected records:\s*(.+)$/m)?.[1] ?? "";
  const affected = [...affectedLine.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
  if (affected.length !== data.affected_records.length || affected.some((item) => !data.affected_records.includes(item))) {
    errors.push("CHANGELOG.md entry must list the exact affected records.");
  }
  const expectedLink = `changes/${data.id}.md`;
  const links = [...body.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
  if (!links.includes(expectedLink)) errors.push(`CHANGELOG.md entry must link to ${expectedLink}.`);
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
    if (![...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].includes(field)) errors.push(`Unexpected front matter field: ${field}.`);
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
  if (!VERSION_PATTERN.test(data.version)) errors.push("version must be a valid semantic version.");
  if (!CLASSIFICATIONS.includes(data.classification)) errors.push(`Invalid classification: ${data.classification}.`);
  if (!COMMITMENT_EFFECTS.includes(data.effect_on_commitment)) errors.push(`Invalid effect_on_commitment: ${data.effect_on_commitment}.`);
  if (!COMPATIBLE_EFFECTS[data.classification]?.includes(data.effect_on_commitment)) {
    errors.push(`Incompatible classification/effect pair: ${data.classification}/${data.effect_on_commitment}.`);
  }
  if (VERSION_PATTERN.test(data.version) && CLASSIFICATIONS.includes(data.classification)) {
    validateVersion(data.version, data.classification, baseFiles["CHANGELOG.md"] ?? "", errors);
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
  validateCampaignRuleScope(data, baseFiles, proposedFiles, errors);

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
  if (linkCount !== evidence.length || evidence.some((item) => !isPublicHttpsUrl(item.href))) {
    errors.push("Every supporting-evidence link must use a genuinely public HTTPS URL and include explanatory text.");
  }

  const declaredPublicPaths = [...data.affected_website_pages, ...data.affected_public_artifacts];
  const hasHtmlEntity = /&(?:#[0-9]+|#x[0-9a-f]+|[a-z][a-z0-9]+);/i.test(document.sections["Public implementation"]);
  const renderedImplementation = document.sections["Public implementation"]
    .replace(/&#(?:x([0-9a-f]+)|(\d+));|&sol;/gi, (match, hex, decimal) => {
      if (match.toLowerCase() === "&sol;") return "/";
      const codePoint = Number.parseInt(hex ?? decimal, hex ? 16 : 10);
      return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    });
  const implementationPaths = new Set(
    [...renderedImplementation.matchAll(/`([^`\n]+)`/g)]
      .map((match) => match[1])
      .filter((item) => item.startsWith("/")),
  );
  for (const item of declaredPublicPaths) {
    if (!implementationPaths.has(item)) errors.push(`Public implementation does not identify ${item} as an exact path token.`);
  }
  for (const item of implementationPaths) {
    if (!declaredPublicPaths.includes(item)) errors.push(`Public implementation claims undeclared public path: ${item}.`);
  }
  const implementationProse = renderedImplementation.replace(/`[^`\n]+`/g, "");
  if (
    hasHtmlEntity
    ||
    /(?<![A-Za-z0-9/])\/(?!\/)(?:[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*)?/m.test(implementationProse)
    || /(?:https?:)?\/\/(?:www\.)?jordanformayor\.ca(?:\/[^\s)`]*)?/i.test(renderedImplementation)
  ) {
    errors.push("Public implementation paths must use exact rendered code tokens.");
  }
  if (!declaredPublicPaths.length && !/no public (?:website page|artifact|implementation)/i.test(document.sections["Public implementation"])) {
    errors.push("Public implementation must explicitly state when no public page or artifact change is required.");
  }
  if (/^everything else\.?$/i.test(document.sections["What did not change"].trim())) {
    errors.push("What did not change must be specific rather than boilerplate.");
  }
  validatePrivateContent(source, errors);
  return errors;
}

export function validateChangeSet({
  baseFiles,
  proposedFiles,
  changes,
  historicalRecordPaths = [],
  historicalRecordIds = [],
}) {
  const errors = [];
  const changedPaths = [...new Set(changes.map((change) => change.path))];
  const platformMarkdownPaths = changedPaths.filter((filePath) => /^platform\/.*\.md$/i.test(filePath));
  const changedTrackedPaths = changedPaths.filter(
    (filePath) => filePath === "CAMPAIGN-RULES.md" || platformMarkdownPaths.includes(filePath),
  );
  const nonconformingPoliticalPaths = changedTrackedPaths.filter((filePath) => !isTrackedPoliticalRecord(filePath));
  const changedSemanticPaths = changedTrackedPaths.filter((filePath) => {
    if (nonconformingPoliticalPaths.includes(filePath)) return true;
    const change = changes.find((item) => item.path === filePath);
    if (change?.status === "D") return true;
    if (typeof proposedFiles[filePath] !== "string") {
      errors.push(`Unable to read proposed political record: ${filePath}.`);
      return true;
    }
    const delta = semanticDelta(baseFiles[filePath] ?? "", proposedFiles[filePath]);
    if (delta.complexityError) {
      errors.push(`${filePath}: ${delta.complexityError}`);
      return true;
    }
    return delta.removed.length > 0 || delta.added.length > 0;
  });
  const newRecords = changes.filter((change) => change.status === "A" && RECORD_FILE_PATTERN.test(change.path));
  const historicalRecordChanges = changes.filter((change) => change.status !== "A" && RECORD_FILE_PATTERN.test(change.path));
  const deletedPoliticalRecords = changes.filter(
    (change) => change.status === "D" && changedTrackedPaths.includes(change.path),
  );
  const validationMachineryChanges = changedPaths.filter((filePath) =>
    VALIDATION_MACHINERY_PATTERNS.some((pattern) => pattern.test(filePath)),
  );

  if (nonconformingPoliticalPaths.length) {
    errors.push(`Nonconforming political Markdown path(s) under platform/: ${nonconformingPoliticalPaths.join(", ")}.`);
  }
  if (deletedPoliticalRecords.length) {
    errors.push(`Tracked political records cannot be deleted: ${deletedPoliticalRecords.map((item) => item.path).join(", ")}.`);
  }
  if (historicalRecordChanges.length) {
    errors.push(`Historical change records are immutable: ${historicalRecordChanges.map((item) => item.path).join(", ")}.`);
  }
  if (changedTrackedPaths.length && validationMachineryChanges.length) {
    errors.push(`Political changes cannot modify validation or governance machinery in the same change: ${validationMachineryChanges.join(", ")}.`);
  }
  for (const record of newRecords) {
    const id = record.path.slice("changes/".length, -".md".length);
    if (historicalRecordPaths.includes(record.path)) errors.push(`Previously used immutable record path cannot be reintroduced: ${record.path}.`);
    if (historicalRecordIds.includes(id)) errors.push(`Previously used immutable record ID cannot be reused: ${id}.`);
  }
  if (changedSemanticPaths.length && newRecords.length !== 1) {
    errors.push(`A political change requires exactly one new immutable record; found ${newRecords.length}.`);
  }
  if (!changedSemanticPaths.length && newRecords.length) {
    errors.push("A change record cannot be added without a tracked political-record change.");
  }
  if (!changedSemanticPaths.length || newRecords.length !== 1) return errors;

  const recordPath = newRecords[0].path;
  const source = proposedFiles[recordPath];
  if (typeof source !== "string") {
    errors.push(`Unable to read new change record: ${recordPath}.`);
    return errors;
  }
  errors.push(...validateRecord({ recordPath, source, baseFiles, proposedFiles, changedTrackedPaths: changedSemanticPaths }));
  if (!changedPaths.includes("CHANGELOG.md")) errors.push("A political change must update CHANGELOG.md.");
  else {
    try {
      const { data } = parseFrontMatter(source);
      const { title } = parseSections(parseFrontMatter(source).body);
      validateChangelogEntry({
        baseChangelog: baseFiles["CHANGELOG.md"] ?? "",
        proposedChangelog: proposedFiles["CHANGELOG.md"] ?? "",
        data,
        title,
        errors,
      });
    } catch {
      // The record parser already reports the actionable error.
    }
  }
  return errors;
}

export function normalizeRepoPath(value) {
  return value.split(path.sep).join("/");
}

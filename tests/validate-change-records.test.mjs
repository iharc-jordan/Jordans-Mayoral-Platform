import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import {
  changedRuleIds,
  validateChangeSet,
  validateRulesDocument,
} from "../scripts/validate-change-records.mjs";

const rulesPath = "data/campaign-rules.json";

function renderLegacyRule(rule) {
  const lines = [
    `## ${rule.number}. ${rule.title}`,
    "",
    rule.statementStyle === "quote" ? `> ${rule.statement}` : rule.statement,
  ];
  for (const block of rule.detail) {
    lines.push("");
    if (block.type === "paragraph") lines.push(block.text);
    else block.items.forEach((item, index) => {
      lines.push(block.type === "ordered-list" ? `${index + 1}. ${item}` : `- ${item}`);
    });
  }
  if (rule.evidence) lines.push("", `**Public evidence:** ${rule.evidence}`);
  return lines.join("\n");
}

function rulesDocument() {
  return {
    schemaVersion: 1,
    rules: Array.from({ length: 18 }, (_, index) => {
      const number = index + 1;
      return {
        id: `rule-${number}`,
        number,
        title: `Fictional rule ${number}`,
        statement: `Fictional statement ${number}.`,
        statementStyle: number >= 13 ? "quote" : "paragraph",
        detail: [{ type: "paragraph", text: `Fictional detail ${number}.` }],
        evidence: number >= 13 ? `Fictional evidence ${number}.` : null,
        surfaces: [number <= 12 ? "/how-ill-govern" : "/transparency"],
      };
    }),
  };
}

function clone(value) {
  return structuredClone(value);
}

function source(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function record({ base, proposed, ruleIds = [], policyIds = [], overrides = {} }) {
  const before = new Map(base.rules.map((rule) => [rule.id, rule]));
  const after = new Map(proposed.rules.map((rule) => [rule.id, rule]));
  const surfaces = [...new Set(ruleIds.flatMap((id) => [
    ...(before.get(id)?.surfaces ?? []),
    ...(after.get(id)?.surfaces ?? []),
  ]))].sort();
  return {
    id: "2099-01-01-fictional-change",
    date: "2099-01-01",
    title: "Fictional change",
    classification: "clarification",
    affectedRuleIds: ruleIds,
    affectedPolicyIds: policyIds,
    affectedSurfaces: surfaces,
    summary: "A fictional summary.",
    reason: "A fictional reason.",
    previousValues: Object.fromEntries(ruleIds.map((id) => [id, before.get(id) ?? null])),
    newValues: Object.fromEntries(ruleIds.map((id) => [id, after.get(id) ?? null])),
    whatDidNotChange: "All other fictional rules remain unchanged.",
    supportingLinks: [{ title: "Fictional public source", url: "https://example.com/source" }],
    ...overrides,
  };
}

function ruleChange(overrides = {}) {
  const base = rulesDocument();
  const proposed = clone(base);
  proposed.rules[13].statement = "Updated fictional statement 14.";
  const recordPath = "changes/2099-01-01-fictional-change.json";
  const changeRecord = record({ base, proposed, ruleIds: ["rule-14"], overrides });
  return {
    base,
    proposed,
    recordPath,
    input: {
      baseFiles: { [rulesPath]: source(base) },
      proposedFiles: { [rulesPath]: source(proposed), [recordPath]: source(changeRecord) },
      changes: [{ status: "M", path: rulesPath }, { status: "A", path: recordPath }],
    },
  };
}

function presentationRecord(overrides = {}) {
  return {
    recordType: "presentation",
    id: "2099-01-01-fictional-presentation",
    date: "2099-01-01",
    title: "Fictional presentation change",
    classification: "clarification",
    affectedSurfaces: ["/priorities", "/transparency"],
    summary: "A fictional presentation summary.",
    reason: "A fictional presentation reason.",
    previousPresentation: "The fictional former presentation.",
    newPresentation: "The fictional new presentation.",
    practicalEffect: "A fictional practical effect.",
    whatDidNotChange: "Fictional policy substance remains unchanged.",
    supportingLinks: [{ title: "Fictional public page", url: "https://example.com/page" }],
    ...overrides,
  };
}

function presentationChange(overrides = {}) {
  const document = rulesDocument();
  const recordPath = "changes/2099-01-01-fictional-presentation.json";
  return {
    recordPath,
    input: {
      baseFiles: { [rulesPath]: source(document) },
      proposedFiles: { [rulesPath]: source(document), [recordPath]: source(presentationRecord(overrides)) },
      changes: [{ status: "A", path: recordPath }],
    },
  };
}

test("the canonical schema requires non-empty, unique, contiguous ordered rules with explicit surfaces", () => {
  const valid = rulesDocument();
  assert.deepEqual(validateRulesDocument(valid), []);

  const invalid = clone(valid);
  invalid.rules[1].id = "rule-3";
  invalid.rules[1].number = 3;
  invalid.rules[1].surfaces = [];
  invalid.rules[2].detail = [{ type: "ordered-list", items: [] }];
  const errors = validateRulesDocument(invalid).join("\n");
  assert.match(errors, /IDs must be unique/);
  assert.match(errors, /numbers must be unique/);
  assert.match(errors, /Rule 2 id must be rule-2/);
  assert.match(errors, /contiguous ascending number beginning at 1/);
  assert.match(errors, /Rule 2 surfaces/);
  assert.match(errors, /Rule 3 detail item 1 items/);

  assert.match(validateRulesDocument({ schemaVersion: 1, rules: [] }).join("\n"), /non-empty rules array/);
});

test("the historical v1.1.0 migration preserves all rule wording, order, IDs, and surfaces", () => {
  const canonical = JSON.parse(execFileSync(
    "git",
    ["show", "b447a4ef840b9e6588c62bb86108eb1e27bd0300:data/campaign-rules.json"],
    { encoding: "utf8" },
  ));
  const legacy = execFileSync("git", ["show", "v1.1.0:CAMPAIGN-RULES.md"], { encoding: "utf8" })
    .replace(/\r\n?/g, "\n");
  const legacyRules = [...legacy.matchAll(
    /^## (\d+)\. [^\n]+\n[\s\S]*?(?=^## \d+\.|^## Public source references)/gm,
  )].map((match) => match[0].trim());

  assert.deepEqual(validateRulesDocument(canonical), []);
  assert.equal(canonical.rules.length, 18);
  assert.deepEqual(canonical.rules.map((rule) => rule.id), Array.from({ length: 18 }, (_, index) => `rule-${index + 1}`));
  assert.deepEqual(canonical.rules.map(renderLegacyRule), legacyRules);
  assert.deepEqual(canonical.rules.find((rule) => rule.id === "rule-2").surfaces, ["/how-ill-govern"]);
  assert.deepEqual(canonical.rules.find((rule) => rule.id === "rule-14").surfaces, ["/transparency"]);
  assert.ok(canonical.rules.every((rule) => rule.surfaces.length > 0));
});

test("changed rule IDs come from deep comparison of complete rule objects", () => {
  const base = rulesDocument();
  const proposed = clone(base);
  proposed.rules[1].detail[0].text = "Updated fictional Rule 2 detail.";
  proposed.rules[13].surfaces = ["/transparency", "/how-ill-govern"];
  assert.deepEqual(changedRuleIds(base, proposed), ["rule-2", "rule-14"]);
});

test("one exact JSON record validates a structured rule change", () => {
  assert.deepEqual(validateChangeSet(ruleChange().input), []);
});

test("presentation records use their own exact schema for clarifications and administrative corrections", () => {
  assert.deepEqual(validateChangeSet(presentationChange().input), []);
  assert.deepEqual(validateChangeSet(presentationChange({ classification: "administrative-correction" }).input), []);
});

test("political records without recordType continue using the political schema", () => {
  assert.deepEqual(validateChangeSet(ruleChange().input), []);
});

test("presentation records reject unknown types and missing or extra keys", () => {
  const unknown = presentationChange({ recordType: "website" });
  assert.match(validateChangeSet(unknown.input).join("\n"), /Unknown recordType/);

  const missing = presentationRecord();
  delete missing.reason;
  const missingChange = presentationChange();
  missingChange.input.proposedFiles[missingChange.recordPath] = source(missing);
  assert.match(validateChangeSet(missingChange.input).join("\n"), /must contain exactly/);

  const extra = presentationChange({ affectedRuleIds: [] });
  assert.match(validateChangeSet(extra.input).join("\n"), /must contain exactly/);
});

test("presentation records validate their immutable public fields", () => {
  for (const overrides of [
    { id: "2099-01-01-wrong" },
    { date: "2099-02-30" },
    { affectedSurfaces: [] },
    { affectedSurfaces: ["/transparency", "/priorities", "/priorities"] },
    { affectedSurfaces: ["/transparency", "/priorities"] },
    { affectedSurfaces: ["/Transparency"] },
    { supportingLinks: [{ title: "Bad", url: "http://example.com" }] },
    { supportingLinks: [{ title: "", url: "https://example.com" }] },
    { supportingLinks: [{ title: "Extra", url: "https://example.com", note: "not allowed" }] },
    { previousPresentation: "Same presentation.", newPresentation: " Same presentation. " },
  ]) {
    assert.notDeepEqual(validateChangeSet(presentationChange(overrides).input), []);
  }
});

test("presentation records remain separate from political, infrastructure, and other record changes", () => {
  const mixedRule = presentationChange();
  mixedRule.input.proposedFiles[rulesPath] = source({
    ...rulesDocument(),
    rules: rulesDocument().rules.map((rule, index) => index === 0 ? { ...rule, statement: "Changed fictional statement." } : rule),
  });
  mixedRule.input.changes.unshift({ status: "M", path: rulesPath });
  assert.match(validateChangeSet(mixedRule.input).join("\n"), /cannot be mixed/);

  const mixedPolicy = presentationChange();
  mixedPolicy.input.proposedFiles["platform/fictional-policy.md"] = "Changed policy.";
  mixedPolicy.input.changes.unshift({ status: "M", path: "platform/fictional-policy.md" });
  assert.match(validateChangeSet(mixedPolicy.input).join("\n"), /cannot be mixed/);

  const mixedPolitical = presentationChange();
  const political = ruleChange();
  mixedPolitical.input.proposedFiles[rulesPath] = political.input.proposedFiles[rulesPath];
  mixedPolitical.input.proposedFiles[political.recordPath] = political.input.proposedFiles[political.recordPath];
  mixedPolitical.input.changes.unshift(...political.input.changes);
  assert.match(validateChangeSet(mixedPolitical.input).join("\n"), /exactly one new presentation record/);

  const twoPresentations = presentationChange();
  twoPresentations.input.proposedFiles["changes/2099-01-02-another-presentation.json"] = source(presentationRecord({
    id: "2099-01-02-another-presentation",
    date: "2099-01-02",
  }));
  twoPresentations.input.changes.push({ status: "A", path: "changes/2099-01-02-another-presentation.json" });
  assert.match(validateChangeSet(twoPresentations.input).join("\n"), /exactly one new presentation record/);

  const withTest = presentationChange();
  withTest.input.proposedFiles["tests/validate-change-records.test.mjs"] = "changed";
  withTest.input.changes.unshift({ status: "M", path: "tests/validate-change-records.test.mjs" });
  assert.match(validateChangeSet(withTest.input).join("\n"), /may change only/);
});

test("Rule 19 can be appended through one ordinary political change without infrastructure edits", () => {
  const base = rulesDocument();
  const proposed = clone(base);
  proposed.rules.push({
    id: "rule-19",
    number: 19,
    title: "Fictional future rule",
    statement: "A fictional future statement.",
    statementStyle: "paragraph",
    detail: [{ type: "paragraph", text: "A fictional future detail." }],
    evidence: "Fictional future evidence.",
    surfaces: ["/transparency"],
  });
  const recordPath = "changes/2099-01-01-fictional-change.json";
  const changeRecord = record({ base, proposed, ruleIds: ["rule-19"] });

  assert.deepEqual(validateChangeSet({
    baseFiles: { [rulesPath]: source(base) },
    proposedFiles: { [rulesPath]: source(proposed), [recordPath]: source(changeRecord) },
    changes: [{ status: "M", path: rulesPath }, { status: "A", path: recordPath }],
  }), []);
});

test("rule IDs, previous and new objects, and surface union must be exact", () => {
  const { base, proposed } = ruleChange();
  for (const overrides of [
    { affectedRuleIds: ["rule-13"] },
    { previousValues: {} },
    { newValues: {} },
    { affectedSurfaces: ["/how-ill-govern"] },
  ]) {
    const recordPath = "changes/2099-01-01-fictional-change.json";
    const candidate = record({ base, proposed, ruleIds: ["rule-14"], overrides });
    const errors = validateChangeSet({
      baseFiles: { [rulesPath]: source(base) },
      proposedFiles: { [rulesPath]: source(proposed), [recordPath]: source(candidate) },
      changes: [{ status: "M", path: rulesPath }, { status: "A", path: recordPath }],
    }).join("\n");
    assert.match(errors, /affectedRuleIds|previousValues|newValues|affectedSurfaces/);
  }
});

test("policy Markdown uses filename scope without prose inference", () => {
  const base = rulesDocument();
  const proposed = clone(base);
  const policyPath = "platform/fictional-policy.md";
  const recordPath = "changes/2099-01-01-fictional-change.json";
  const changeRecord = record({ base, proposed, policyIds: ["fictional-policy"] });
  assert.deepEqual(validateChangeSet({
    baseFiles: { [rulesPath]: source(base), [policyPath]: "Any old prose.\n" },
    proposedFiles: {
      [rulesPath]: source(proposed),
      [policyPath]: "Entirely different prose with no semantic parser.\n",
      [recordPath]: source(changeRecord),
    },
    changes: [{ status: "M", path: policyPath }, { status: "A", path: recordPath }],
  }), []);
});

test("existing Markdown and JSON change records are immutable", () => {
  const document = rulesDocument();
  for (const recordPath of ["changes/historical.md", "changes/historical.json"]) {
    const errors = validateChangeSet({
      baseFiles: { [rulesPath]: source(document), [recordPath]: "historical" },
      proposedFiles: { [rulesPath]: source(document), [recordPath]: "edited" },
      changes: [{ status: "M", path: recordPath }],
    }).join("\n");
    assert.match(errors, /cannot be modified or deleted/);
  }
});

test("political data cannot be mixed with validator or governance work", () => {
  const candidate = ruleChange();
  candidate.input.changes.push({ status: "M", path: "scripts/validate-change-records.mjs" });
  candidate.input.proposedFiles["scripts/validate-change-records.mjs"] = "changed";
  assert.match(validateChangeSet(candidate.input).join("\n"), /cannot be mixed/);
});

test("initial migration validates structured rules and allows infrastructure without a record", () => {
  const document = rulesDocument();
  assert.deepEqual(validateChangeSet({
    baseFiles: {},
    proposedFiles: { [rulesPath]: source(document), "scripts/validate-change-records.mjs": "changed" },
    changes: [
      { status: "A", path: rulesPath },
      { status: "M", path: "scripts/validate-change-records.mjs" },
    ],
  }), []);

  const errors = validateChangeSet({
    baseFiles: {},
    proposedFiles: { [rulesPath]: source(document), "CAMPAIGN-RULES.md": "changed" },
    changes: [{ status: "A", path: rulesPath }, { status: "M", path: "CAMPAIGN-RULES.md" }],
  }).join("\n");
  assert.match(errors, /must remain unchanged/);
});

test("supporting links require only ordinary public HTTPS URLs", () => {
  const { base, proposed } = ruleChange();
  const recordPath = "changes/2099-01-01-fictional-change.json";
  const candidate = record({
    base,
    proposed,
    ruleIds: ["rule-14"],
    overrides: { supportingLinks: [{ title: "Bad source", url: "http://example.com/source" }] },
  });
  assert.match(validateChangeSet({
    baseFiles: { [rulesPath]: source(base) },
    proposedFiles: { [rulesPath]: source(proposed), [recordPath]: source(candidate) },
    changes: [{ status: "M", path: rulesPath }, { status: "A", path: recordPath }],
  }).join("\n"), /public HTTPS/);

  const local = record({
    base,
    proposed,
    ruleIds: ["rule-14"],
    overrides: { supportingLinks: [{ title: "Local source", url: "https://localhost/source" }] },
  });
  assert.match(validateChangeSet({
    baseFiles: { [rulesPath]: source(base) },
    proposedFiles: { [rulesPath]: source(proposed), [recordPath]: source(local) },
    changes: [{ status: "M", path: rulesPath }, { status: "A", path: recordPath }],
  }).join("\n"), /public HTTPS/);
});

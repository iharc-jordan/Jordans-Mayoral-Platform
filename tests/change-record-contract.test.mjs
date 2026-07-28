import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  BASELINE_COMMIT,
  CLASSIFICATIONS,
  NEW_COMMITMENT_MARKER,
  WITHDRAWAL_MARKER,
  changedCampaignRuleSections,
  normalizeMarkdown,
  parseFrontMatter,
  semanticBlocks,
  validateChangeSet,
} from "../scripts/change-record-contract.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const fixtureRoot = path.join(here, "fixtures", "fictional");
const recordPath = "changes/2099-01-01-fictional-civic-lanterns.md";
const policyPath = "platform/fictional-civic-lanterns.md";

function read(relativePath) {
  return fs.readFileSync(path.join(fixtureRoot, relativePath), "utf8").replace(/\r\n?/g, "\n");
}

const basePolicy = read("base/platform/fictional-civic-lanterns.md");
const proposedPolicy = read("proposed/platform/fictional-civic-lanterns.md");
const fixtureRecord = read("proposed/changes/2099-01-01-fictional-civic-lanterns.md");
const fixtureChangelog = read("proposed/CHANGELOG.md");
const baseChangelog = "# Changelog\n\n## [v1.0.0] - 2098-12-31\n\n### Fictional initial baseline\n";

function changeSet({ record = fixtureRecord, base = {}, proposed = {}, changes } = {}) {
  const baseFiles = { [policyPath]: basePolicy, "CHANGELOG.md": baseChangelog, ...base };
  const proposedFiles = {
    [policyPath]: proposedPolicy,
    [recordPath]: record,
    "CHANGELOG.md": fixtureChangelog,
    ...proposed,
  };
  return {
    baseFiles,
    proposedFiles,
    changes:
      changes ??
      [
        { status: "M", path: policyPath },
        { status: "A", path: recordPath },
        { status: "M", path: "CHANGELOG.md" },
      ],
  };
}

function errors(options) {
  return validateChangeSet(changeSet(options));
}

function replaceField(record, field, value) {
  return record.replace(new RegExp(`^${field}: .+$`, "m"), `${field}: "${value}"`);
}

function replaceSection(record, heading, content) {
  const pattern = new RegExp(`(## ${heading}\\n\\n)[\\s\\S]*?(?=\\n## |$)`);
  return record.replace(pattern, `$1${content}\n`);
}

const fictionalCampaignRules = Object.freeze({
  2: {
    previous: "The fictional campaign will test one paper bridge before ordering imaginary materials.",
    proposed: "The fictional campaign will test two paper bridges before ordering imaginary materials.",
  },
  14: {
    previous: "The fictional campaign will not accept bundled wooden tokens.",
    proposed: "The fictional campaign will not accept bundled wooden or clay tokens.",
  },
});

function campaignRulesSource(changes = {}) {
  return `# Fictional Campaign Rules

## 2. Test fictional bridges

${changes[2] ?? fictionalCampaignRules[2].previous}

## 14. Reject fictional token bundles

${changes[14] ?? fictionalCampaignRules[14].previous}

## Public source references

- https://example.com/fictional-rules
`;
}

function campaignRuleChange({ changedRules = [2], declaredRules = changedRules, pages = ["/fictional-rules"] } = {}) {
  const base = campaignRulesSource();
  const proposed = campaignRulesSource(Object.fromEntries(
    changedRules.map((number) => [number, fictionalCampaignRules[number].proposed]),
  ));
  let record = fixtureRecord.replace(
    '  - "platform/fictional-civic-lanterns.md"',
    declaredRules === null
      ? '  - "CAMPAIGN-RULES.md"'
      : `  - "CAMPAIGN-RULES.md"\naffected_rule_sections:\n${declaredRules.map((number) => `  - "rule-${number}"`).join("\n")}`,
  );
  record = record.replace(
    'affected_website_pages:\n  - "/priorities/fictional-civic-lanterns"',
    `affected_website_pages:\n${pages.map((page) => `  - "${page}"`).join("\n")}`,
  );
  record = replaceSection(
    record,
    "Previous wording",
    changedRules.map((number) => `- ${fictionalCampaignRules[number].previous}`).join("\n"),
  );
  record = replaceSection(
    record,
    "New wording",
    changedRules.map((number) => `- ${fictionalCampaignRules[number].proposed}`).join("\n"),
  );
  record = replaceSection(
    record,
    "Public implementation",
    `${pages.map((page) => `The separately reviewed fictional page \`${page}\` must be checked.`).join("\n\n")}\n\nRepository Markdown does not publish those pages automatically.`,
  );
  const changelog = fixtureChangelog.replace(
    "Affected records: `platform/fictional-civic-lanterns.md`",
    "Affected records: `CAMPAIGN-RULES.md`",
  );
  return validateChangeSet({
    baseFiles: { "CAMPAIGN-RULES.md": base, "CHANGELOG.md": baseChangelog },
    proposedFiles: {
      "CAMPAIGN-RULES.md": proposed,
      [recordPath]: record,
      "CHANGELOG.md": changelog,
    },
    changes: [
      { status: "M", path: "CAMPAIGN-RULES.md" },
      { status: "A", path: recordPath },
      { status: "M", path: "CHANGELOG.md" },
    ],
  });
}

test("checked-in fictional clarification fixture is valid", () => {
  assert.deepEqual(errors(), []);
});

test("a fictional Rule 2-only delta requires only rule-2", () => {
  assert.deepEqual(campaignRuleChange({ changedRules: [2], declaredRules: [2] }), []);
});

test("a fictional Rule 14-only delta requires only rule-14", () => {
  assert.deepEqual(campaignRuleChange({ changedRules: [14], declaredRules: [14] }), []);
});

test("a fictional campaign-rule change cannot omit affected_rule_sections", () => {
  assert.match(
    campaignRuleChange({ changedRules: [14], declaredRules: null }).join("\n"),
    /Missing required front matter field.*affected_rule_sections/i,
  );
});

test("one fictional change can explicitly cover rules on both publication surfaces", () => {
  assert.deepEqual(campaignRuleChange({ changedRules: [2, 14], declaredRules: [2, 14] }), []);
});

test("a fictional immutable record declaring the wrong rule section fails", () => {
  const result = campaignRuleChange({ changedRules: [2], declaredRules: [14] }).join("\n");
  assert.match(result, /omits changed section.*rule-2/i);
  assert.match(result, /lists unchanged or incorrect section.*rule-14/i);
});

test("a fictional changed rule omitted from the immutable record fails", () => {
  assert.match(
    campaignRuleChange({ changedRules: [2, 14], declaredRules: [2] }).join("\n"),
    /omits changed section.*rule-14/i,
  );
});

test("a fictional declared rule with no semantic change fails", () => {
  assert.match(
    campaignRuleChange({ changedRules: [2], declaredRules: [2, 14] }).join("\n"),
    /lists unchanged or incorrect section.*rule-14/i,
  );
});

test("arbitrary or broadened website declarations cannot alter verified rule-section scope", () => {
  const base = campaignRulesSource();
  const proposed = campaignRulesSource({ 14: fictionalCampaignRules[14].proposed });
  assert.deepEqual(changedCampaignRuleSections(base, proposed), { changed: ["rule-14"], errors: [] });
  assert.deepEqual(
    campaignRuleChange({
      changedRules: [14],
      declaredRules: [14],
      pages: ["/fictional-rules", "/arbitrary-broadened-route"],
    }),
    [],
  );
});

test("a fictional semantic delta outside numbered campaign rules fails closed", () => {
  const base = campaignRulesSource();
  const proposed = base.replace("# Fictional Campaign Rules", "# Broadened Fictional Campaign Rules");
  assert.match(
    changedCampaignRuleSections(base, proposed).errors.join("\n"),
    /outside numbered rule sections/i,
  );
});

test("a blank-line-terminated raw HTML block does not hide the following numbered rule", () => {
  const base = `# Fictional Campaign Rules

## 2. Fictional ordinary rule

<div>
Unclosed fictional markup.

## 14. Fictional source rule

Old fictional Rule 14 wording.
`;
  const proposed = base.replace("Old fictional Rule 14 wording.", "New fictional Rule 14 wording.");
  assert.deepEqual(changedCampaignRuleSections(base, proposed), { changed: ["rule-14"], errors: [] });

  let record = fixtureRecord.replace(
    '  - "platform/fictional-civic-lanterns.md"',
    '  - "CAMPAIGN-RULES.md"\naffected_rule_sections:\n  - "rule-2"',
  );
  record = replaceSection(record, "Previous wording", "- Old fictional Rule 14 wording.");
  record = replaceSection(record, "New wording", "- New fictional Rule 14 wording.");
  const changelog = fixtureChangelog.replace(
    "Affected records: `platform/fictional-civic-lanterns.md`",
    "Affected records: `CAMPAIGN-RULES.md`",
  );
  const result = validateChangeSet({
    baseFiles: { "CAMPAIGN-RULES.md": base, "CHANGELOG.md": baseChangelog },
    proposedFiles: { "CAMPAIGN-RULES.md": proposed, [recordPath]: record, "CHANGELOG.md": changelog },
    changes: [
      { status: "M", path: "CAMPAIGN-RULES.md" },
      { status: "A", path: recordPath },
      { status: "M", path: "CHANGELOG.md" },
    ],
  });
  assert.match(result.join("\n"), /omits changed section.*rule-14/i);
});

test("a Setext H1 ends the preceding numbered rule section", () => {
  const base = `# Fictional Campaign Rules

## 2. Fictional ordinary rule

Old fictional Rule 2 wording.

Fictional appendix
==================

Old fictional appendix wording.
`;
  const proposed = base.replace("Old fictional appendix wording.", "New fictional appendix wording.");
  assert.match(
    changedCampaignRuleSections(base, proposed).errors.join("\n"),
    /outside numbered rule sections/i,
  );

  let record = fixtureRecord.replace(
    '  - "platform/fictional-civic-lanterns.md"',
    '  - "CAMPAIGN-RULES.md"\naffected_rule_sections:\n  - "rule-2"',
  );
  record = replaceSection(record, "Previous wording", "- Old fictional appendix wording.");
  record = replaceSection(record, "New wording", "- New fictional appendix wording.");
  const changelog = fixtureChangelog.replace(
    "Affected records: `platform/fictional-civic-lanterns.md`",
    "Affected records: `CAMPAIGN-RULES.md`",
  );
  const result = validateChangeSet({
    baseFiles: { "CAMPAIGN-RULES.md": base, "CHANGELOG.md": baseChangelog },
    proposedFiles: { "CAMPAIGN-RULES.md": proposed, [recordPath]: record, "CHANGELOG.md": changelog },
    changes: [
      { status: "M", path: "CAMPAIGN-RULES.md" },
      { status: "A", path: recordPath },
      { status: "M", path: "CHANGELOG.md" },
    ],
  });
  assert.match(result.join("\n"), /outside numbered rule sections/i);
});

test("all rendered Setext and HTML H1/H2 boundaries fail closed in full validation", () => {
  const boundaries = [
    { label: "Setext H2", heading: "Fictional appendix\n------------------" },
    { label: "multiline Setext H1", heading: "Old fictional appendix heading\nSecond heading line\n=============================" },
    { label: "HTML H2", heading: "<h2>Fictional appendix</h2>" },
    { label: "partial HTML H2", heading: "<h2\nclass=\"fictional\">\nFictional appendix\n</h2>" },
  ];
  for (const { label, heading } of boundaries) {
    const base = `# Fictional Campaign Rules

## 2. Fictional ordinary rule

Old fictional Rule 2 wording.

${heading}

Old fictional appendix wording.
`;
    const proposed = label === "multiline Setext H1"
      ? base.replace("Old fictional appendix heading", "New fictional appendix heading")
      : base.replace("Old fictional appendix wording.", "New fictional appendix wording.");
    let record = fixtureRecord.replace(
      '  - "platform/fictional-civic-lanterns.md"',
      '  - "CAMPAIGN-RULES.md"\naffected_rule_sections:\n  - "rule-2"',
    );
    record = replaceSection(
      record,
      "Previous wording",
      label === "multiline Setext H1" ? "- Old fictional appendix heading" : "- Old fictional appendix wording.",
    );
    record = replaceSection(
      record,
      "New wording",
      label === "multiline Setext H1" ? "- New fictional appendix heading" : "- New fictional appendix wording.",
    );
    const changelog = fixtureChangelog.replace(
      "Affected records: `platform/fictional-civic-lanterns.md`",
      "Affected records: `CAMPAIGN-RULES.md`",
    );
    const result = validateChangeSet({
      baseFiles: { "CAMPAIGN-RULES.md": base, "CHANGELOG.md": baseChangelog },
      proposedFiles: { "CAMPAIGN-RULES.md": proposed, [recordPath]: record, "CHANGELOG.md": changelog },
      changes: [
        { status: "M", path: "CAMPAIGN-RULES.md" },
        { status: "A", path: recordPath },
        { status: "M", path: "CHANGELOG.md" },
      ],
    });
    assert.match(result.join("\n"), /outside numbered rule sections/i, label);
  }
});

test("empty and rendered H1 boundaries end the preceding numbered rule section", () => {
  for (const heading of ["#", "<h1>Fictional appendix</h1>", "<h2>Fictional appendix</h2>"]) {
    const base = `# Fictional Campaign Rules

## 2. Fictional ordinary rule

Old fictional Rule 2 wording.

${heading}

Old fictional appendix wording.
`;
    const proposed = base.replace("Old fictional appendix wording.", "New fictional appendix wording.");
    assert.match(
      changedCampaignRuleSections(base, proposed).errors.join("\n"),
      /outside numbered rule sections/i,
      heading,
    );
  }
});

test("entity-encoded public routes cannot bypass exact path declarations", () => {
  const record = replaceSection(
    fixtureRecord,
    "Public implementation",
    "The rendered route &#47;undeclared-fictional-route must be separately reviewed.",
  );
  assert.match(errors({ record }).join("\n"), /Public implementation paths must use exact rendered code tokens/i);
});

test("named HTML entities cannot disguise the canonical campaign domain", () => {
  const record = replaceSection(
    fixtureRecord,
    "Public implementation",
    "See https://jordanformayor&period;ca before the separately reviewed page is published.",
  );
  assert.match(errors({ record }).join("\n"), /Public implementation paths must use exact rendered code tokens/i);
});

test("full validation assigns fenced, indented, and HTML-block deltas to their numbered rule", () => {
  const containers = [
    {
      label: "fenced",
      previous: "```text\nold hidden-format Rule 14 wording\n```",
      proposed: "```text\nnew hidden-format Rule 14 wording\n```",
      previousClaim: "text old hidden-format Rule 14 wording",
      proposedClaim: "text new hidden-format Rule 14 wording",
    },
    {
      label: "indented",
      previous: "    old hidden-format Rule 14 wording",
      proposed: "    new hidden-format Rule 14 wording",
      previousClaim: "old hidden-format Rule 14 wording",
      proposedClaim: "new hidden-format Rule 14 wording",
    },
    {
      label: "HTML",
      previous: "<div>old hidden-format Rule 14 wording</div>",
      proposed: "<div>new hidden-format Rule 14 wording</div>",
      previousClaim: "<div>old hidden-format Rule 14 wording</div>",
      proposedClaim: "<div>new hidden-format Rule 14 wording</div>",
    },
  ];

  for (const container of containers) {
    const base = `# Fictional Campaign Rules

## 2. Fictional ordinary rule

Old ordinary Rule 2 wording.

## 14. Fictional hidden-format rule

${container.previous}

## Public source references

- https://example.com/fictional-rules
`;
    const proposed = base
      .replace("Old ordinary Rule 2 wording.", "New ordinary Rule 2 wording.")
      .replace(container.previous, container.proposed);
    let record = fixtureRecord.replace(
      '  - "platform/fictional-civic-lanterns.md"',
      '  - "CAMPAIGN-RULES.md"\naffected_rule_sections:\n  - "rule-2"',
    );
    record = replaceSection(record, "Previous wording", `- Old ordinary Rule 2 wording.\n- ${container.previousClaim}`);
    record = replaceSection(record, "New wording", `- New ordinary Rule 2 wording.\n- ${container.proposedClaim}`);
    const changelog = fixtureChangelog.replace(
      "Affected records: `platform/fictional-civic-lanterns.md`",
      "Affected records: `CAMPAIGN-RULES.md`",
    );
    const result = validateChangeSet({
      baseFiles: { "CAMPAIGN-RULES.md": base, "CHANGELOG.md": baseChangelog },
      proposedFiles: {
        "CAMPAIGN-RULES.md": proposed,
        [recordPath]: record,
        "CHANGELOG.md": changelog,
      },
      changes: [
        { status: "M", path: "CAMPAIGN-RULES.md" },
        { status: "A", path: recordPath },
        { status: "M", path: "CHANGELOG.md" },
      ],
    });
    assert.match(result.join("\n"), /omits changed section.*rule-14/i, container.label);
  }
});

test("all established classifications parse and their canonical effects validate", () => {
  const effects = {
    clarification: "no-material-change",
    "evidence-update": "no-material-change",
    "cost-or-timeline-update": "no-material-change",
    "scope-expansion": "expands",
    "scope-reduction": "reduces",
    "position-change": "changes-position",
    "policy-withdrawal": "withdraws",
    "administrative-correction": "no-material-change",
  };
  const labels = {
    clarification: "Clarification",
    "evidence-update": "Evidence update",
    "cost-or-timeline-update": "Cost or timeline update",
    "scope-expansion": "Scope expansion",
    "scope-reduction": "Scope reduction",
    "position-change": "Position change",
    "policy-withdrawal": "Policy withdrawal",
    "administrative-correction": "Administrative correction",
  };
  for (const classification of CLASSIFICATIONS) {
    let record = replaceField(fixtureRecord, "classification", classification);
    record = replaceField(record, "effect_on_commitment", effects[classification]);
    const usesPatch = ["clarification", "administrative-correction"].includes(classification);
    const version = usesPatch ? "v1.0.1" : "v1.1.0";
    record = replaceField(record, "version", version);
    const changelog = fixtureChangelog
      .replace("v1.0.1", version)
      .replace("Classification: Clarification", `Classification: ${labels[classification]}`);
    if (classification === "policy-withdrawal") {
      const base = `---\nstatus: active\n---\n${basePolicy}`;
      const proposed = `---\nstatus: withdrawn\n---\n${basePolicy}`;
      record = replaceSection(record, "Previous wording", "status: active");
      record = replaceSection(record, "New wording", WITHDRAWAL_MARKER);
      assert.deepEqual(errors({ record, base: { [policyPath]: base }, proposed: { [policyPath]: proposed, "CHANGELOG.md": changelog } }), [], classification);
    } else {
      assert.deepEqual(errors({ record, proposed: { "CHANGELOG.md": changelog } }), [], classification);
    }
  }
});

test("incompatible classification and commitment effect fail closed", () => {
  const record = replaceField(fixtureRecord, "effect_on_commitment", "withdraws");
  assert.match(errors({ record }).join("\n"), /Incompatible classification\/effect pair/);
});

test("a genuine new commitment uses the explicit one-sided marker", () => {
  let record = replaceField(fixtureRecord, "classification", "scope-expansion");
  record = replaceField(record, "effect_on_commitment", "expands");
  record = replaceField(record, "version", "v1.1.0");
  record = replaceSection(record, "Previous wording", NEW_COMMITMENT_MARKER);
  record = replaceSection(record, "New wording", semanticBlocks(proposedPolicy).map((block) => `- ${block}`).join("\n"));
  const changelog = fixtureChangelog.replace("v1.0.1", "v1.1.0").replace("Clarification", "Scope expansion");
  assert.deepEqual(errors({ record, base: { [policyPath]: "" }, proposed: { "CHANGELOG.md": changelog } }), []);
});

test("a withdrawal uses the explicit one-sided marker without fabricated new wording", () => {
  let record = replaceField(fixtureRecord, "classification", "policy-withdrawal");
  record = replaceField(record, "effect_on_commitment", "withdraws");
  record = replaceField(record, "version", "v1.1.0");
  record = replaceSection(record, "Previous wording", "status: active");
  record = replaceSection(record, "New wording", WITHDRAWAL_MARKER);
  const base = `---\nstatus: active\n---\n${basePolicy}`;
  const proposed = `---\nstatus: withdrawn\n---\n${basePolicy}`;
  const changelog = fixtureChangelog.replace("v1.0.1", "v1.1.0").replace("Clarification", "Policy withdrawal");
  assert.deepEqual(errors({ record, base: { [policyPath]: base }, proposed: { [policyPath]: proposed, "CHANGELOG.md": changelog } }), []);
});

test("scope must include every changed political record", () => {
  const second = "platform/fictional-cloud-bells.md";
  const result = errors({
    base: { [second]: "Old fictional cloud bells." },
    proposed: { [second]: "New fictional cloud bells." },
    changes: [
      { status: "M", path: policyPath },
      { status: "M", path: second },
      { status: "A", path: recordPath },
      { status: "M", path: "CHANGELOG.md" },
    ],
  });
  assert.match(result.join("\n"), /omits changed record/);
});

test("scope may not list an unchanged political record", () => {
  const extra = '  - "platform/fictional-cloud-bells.md"\n';
  const record = fixtureRecord.replace('  - "platform/fictional-civic-lanterns.md"\n', `$&${extra}`);
  assert.match(errors({ record }).join("\n"), /lists unchanged record/);
});

test("an exact multi-file conceptual change validates paragraphs and list items", () => {
  const second = "platform/fictional-cloud-bells.md";
  const oldSecond = "# Cloud Bells\n\n- Ring one imaginary cloud bell.\n";
  const newSecond = "# Cloud Bells\n\n- Ring two imaginary cloud bells.\n";
  let record = fixtureRecord.replace(
    '  - "platform/fictional-civic-lanterns.md"\n',
    '  - "platform/fictional-civic-lanterns.md"\n  - "platform/fictional-cloud-bells.md"\n',
  );
  record = replaceSection(
    record,
    "Previous wording",
    "- The fictional municipality will study blue paper lanterns in one imaginary park.\n- Ring one imaginary cloud bell.",
  );
  record = replaceSection(
    record,
    "New wording",
    "- The fictional municipality will study blue paper lanterns in one imaginary park for one imaginary week.\n- Ring two imaginary cloud bells.",
  );
  const changelog = fixtureChangelog.replace(
    "Affected records: `platform/fictional-civic-lanterns.md`",
    "Affected records: `platform/fictional-civic-lanterns.md`, `platform/fictional-cloud-bells.md`",
  );
  assert.deepEqual(
    errors({
      record,
      base: { [second]: oldSecond },
      proposed: { [second]: newSecond, "CHANGELOG.md": changelog },
      changes: [
        { status: "M", path: policyPath },
        { status: "M", path: second },
        { status: "A", path: recordPath },
        { status: "M", path: "CHANGELOG.md" },
      ],
    }),
    [],
  );
});

test("each file in an ordinary multi-file change needs tied previous and new wording", () => {
  const second = "platform/fictional-cloud-bells.md";
  const oldSecond = "# Cloud Bells\n\nRing one imaginary cloud bell.\n";
  const newSecond = "# Cloud Bells\n\nRing two imaginary cloud bells.\n";
  const record = fixtureRecord.replace(
    '  - "platform/fictional-civic-lanterns.md"\n',
    '  - "platform/fictional-civic-lanterns.md"\n  - "platform/fictional-cloud-bells.md"\n',
  );
  const result = errors({
    record,
    base: { [second]: oldSecond },
    proposed: { [second]: newSecond },
    changes: [
      { status: "M", path: policyPath },
      { status: "M", path: second },
      { status: "A", path: recordPath },
      { status: "M", path: "CHANGELOG.md" },
    ],
  });
  assert.match(result.join("\n"), /previous and new wording must both be tied.*fictional-cloud-bells/);
});

test("Markdown headings, lists, and line wrapping normalize conservatively", () => {
  assert.equal(normalizeMarkdown("## A heading\n\n- A wrapped\n  phrase"), "a heading a wrapped phrase");
  let record = replaceSection(fixtureRecord, "Previous wording", "The fictional municipality will study blue paper\nlanterns in one imaginary park.");
  record = replaceSection(record, "New wording", "- The fictional municipality will study blue paper lanterns in one imaginary park for one imaginary week.");
  assert.deepEqual(errors({ record }), []);
});

test("unchanged old and new quotes cannot explain a different political edit", () => {
  let record = replaceSection(fixtureRecord, "Previous wording", "- a paper-lantern count");
  record = replaceSection(record, "New wording", "- a paper-lantern count");
  const result = errors({ record }).join("\n");
  assert.match(result, /Previous wording is present but is not part of the actual semantic change/);
  assert.match(result, /New wording is present but is not part of the actual semantic change/);
});

test("partial or embellished wording cannot stand in for the exact semantic change", () => {
  let partial = replaceSection(fixtureRecord, "Previous wording", "The fictional municipality");
  partial = replaceSection(partial, "New wording", "The fictional municipality");
  const partialResult = errors({ record: partial }).join("\n");
  assert.match(partialResult, /Previous wording is present but is not part of the actual semantic change/);
  assert.match(partialResult, /New wording is present but is not part of the actual semantic change/);

  let embellished = replaceSection(
    fixtureRecord,
    "Previous wording",
    "The fictional municipality will study blue paper lanterns in one imaginary park. Invented extra condition.",
  );
  embellished = replaceSection(
    embellished,
    "New wording",
    "The fictional municipality will study blue paper lanterns in one imaginary park for one imaginary week. Invented extra condition.",
  );
  const embellishedResult = errors({ record: embellished }).join("\n");
  assert.match(embellishedResult, /Previous wording is present but is not part of the actual semantic change/);
  assert.match(embellishedResult, /New wording is present but is not part of the actual semantic change/);
});

test("a quoted semantic block moved within a record is tied to the LCS delta", () => {
  const base = "# Fictional record\n\nFirst unchanged block.\n\nThe movable fictional block.\n\nLast unchanged block.\n";
  const proposed = "# Fictional record\n\nFirst unchanged block.\n\nLast unchanged block.\n\nThe movable fictional block.\n";
  let record = replaceSection(fixtureRecord, "Previous wording", "The movable fictional block.");
  record = replaceSection(record, "New wording", "The movable fictional block.");
  assert.deepEqual(errors({ record, base: { [policyPath]: base }, proposed: { [policyPath]: proposed } }), []);
});

test("a format-only tracked edit does not manufacture a fictional political delta", () => {
  const base = "# Fictional record\n\nA fictional sentence wraps across\nsource lines.\n";
  const proposed = "# Fictional record\n\nA fictional sentence wraps across source lines.\n";
  assert.deepEqual(
    validateChangeSet({
      baseFiles: { [policyPath]: base },
      proposedFiles: { [policyPath]: proposed },
      changes: [{ status: "M", path: policyPath }],
    }),
    [],
  );
});

test("missing What did not change fails", () => {
  const record = replaceSection(fixtureRecord, "What did not change", "");
  assert.match(errors({ record }).join("\n"), /What did not change/);
});

test("boilerplate What did not change fails", () => {
  const record = replaceSection(fixtureRecord, "What did not change", "Everything else.");
  assert.match(errors({ record }).join("\n"), /specific rather than boilerplate/);
});

test("supporting evidence requires HTTPS and an explanation", () => {
  const noExplanation = replaceSection(fixtureRecord, "Supporting evidence", "- [Fictional archive](https://example.com/archive)");
  assert.match(errors({ record: noExplanation }).join("\n"), /explanation/);
  const http = fixtureRecord.replace("https://example.com/fictional-lantern-standard", "http://example.com/fictional-lantern-standard");
  assert.match(errors({ record: http }).join("\n"), /HTTPS/);
});

test("invalid routes and non-allowlisted records fail", () => {
  const badRoute = fixtureRecord.replace("/priorities/fictional-civic-lanterns", "https://example.com/not-a-route");
  assert.match(errors({ record: badRoute }).join("\n"), /Malformed website route/);
  const badRecord = fixtureRecord.replaceAll(policyPath, "notes/fictional.md");
  assert.match(errors({ record: badRecord }).join("\n"), /not allowlisted/);
});

test("wording must exist in full predecessor and proposed states", () => {
  const badPrevious = replaceSection(fixtureRecord, "Previous wording", "A sentence that never existed in the fictional record.");
  assert.match(errors({ record: badPrevious }).join("\n"), /Previous wording is present but is not part of the actual semantic change/);
  const badNext = replaceSection(fixtureRecord, "New wording", "A proposed sentence that is absent.");
  assert.match(errors({ record: badNext }).join("\n"), /New wording is present but is not part of the actual semantic change/);
});

test("direct tracked edits without a record fail", () => {
  const result = validateChangeSet({
    baseFiles: { [policyPath]: basePolicy },
    proposedFiles: { [policyPath]: proposedPolicy },
    changes: [{ status: "M", path: policyPath }],
  });
  assert.match(result.join("\n"), /exactly one new immutable record/);
});

test("two records for one conceptual change fail as ambiguous", () => {
  const result = errors({
    proposed: { "changes/2099-01-02-second-fictional-record.md": fixtureRecord },
    changes: [
      { status: "M", path: policyPath },
      { status: "A", path: recordPath },
      { status: "A", path: "changes/2099-01-02-second-fictional-record.md" },
      { status: "M", path: "CHANGELOG.md" },
    ],
  });
  assert.match(result.join("\n"), /found 2/);
});

test("historical record edits and deletions fail", () => {
  for (const status of ["M", "D"]) {
    const result = validateChangeSet({ baseFiles: {}, proposedFiles: {}, changes: [{ status, path: recordPath }] });
    assert.match(result.join("\n"), /Historical change records are immutable/);
  }
});

test("a political change must update and link the concise changelog", () => {
  const noChangelog = changeSet({ changes: [{ status: "M", path: policyPath }, { status: "A", path: recordPath }] });
  assert.match(validateChangeSet(noChangelog).join("\n"), /must update CHANGELOG/);
  assert.match(errors({ proposed: { "CHANGELOG.md": "# Changelog\n" } }).join("\n"), /visible changelog entry.*v1.0.1/i);
});

test("the actual PR template contains the immutable review contract", () => {
  const template = fs.readFileSync(path.join(root, ".github", "pull_request_template.md"), "utf8");
  for (const phrase of [
    "Immutable change record",
    "Public records affected",
    "Website pages and public artifacts affected",
    "What did not change",
    "No unrelated commitment changed",
    "Validation commands and results",
  ]) {
    assert.match(template, new RegExp(phrase, "i"), phrase);
  }
});

test("the v1.0.0 tag remains pinned to the original baseline and tracking boundary", async () => {
  const { execFileSync } = await import("node:child_process");
  const commit = execFileSync("git", ["rev-parse", "v1.0.0^{commit}"], { cwd: root, encoding: "utf8" }).trim();
  assert.equal(commit, BASELINE_COMMIT);
  const readme = execFileSync("git", ["show", "v1.0.0:README.md"], { cwd: root, encoding: "utf8" });
  assert.match(readme, /2026-07-24T09:00:00-04:00/);
  const changelog = execFileSync("git", ["show", "v1.0.0:CHANGELOG.md"], { cwd: root, encoding: "utf8" });
  assert.match(changelog, /\[v1\.0\.0\] - 2026-07-24/);
});

test("the fixture is not a public change record", () => {
  assert.equal(fs.existsSync(path.join(root, recordPath)), false);
  assert.equal(parseFrontMatter(fixtureRecord).data.id, "2099-01-01-fictional-civic-lanterns");
});

test("every removed and added fictional semantic block must be documented", () => {
  const base = `${basePolicy}\nA second fictional promise keeps three imaginary lantern logs.\n`;
  const proposed = `${proposedPolicy}\nA second fictional promise keeps four imaginary lantern logs.\n`;
  assert.match(
    errors({ base: { [policyPath]: base }, proposed: { [policyPath]: proposed } }).join("\n"),
    /unaccounted removed semantic block|unaccounted added semantic block/i,
  );
});

test("politically meaningful fictional front matter is part of the semantic delta", () => {
  const base = `---\nstatus: active\nlast_verified: 2098-12-31\n---\n${basePolicy}`;
  const proposed = `---\nstatus: withdrawn\nlast_verified: 2099-01-01\n---\n${proposedPolicy}`;
  const result = errors({ base: { [policyPath]: base }, proposed: { [policyPath]: proposed } }).join("\n");
  assert.match(result, /unaccounted removed semantic block.*status: active/i);
  assert.match(result, /unaccounted removed semantic block.*lastverified: 2098-12-31/i);
});

test("deleting a tracked fictional political record is rejected", () => {
  let record = replaceField(fixtureRecord, "classification", "policy-withdrawal");
  record = replaceField(record, "effect_on_commitment", "withdraws");
  record = replaceSection(record, "New wording", WITHDRAWAL_MARKER);
  assert.match(
    errors({
      record,
      proposed: { [policyPath]: undefined },
      changes: [
        { status: "D", path: policyPath },
        { status: "A", path: recordPath },
        { status: "M", path: "CHANGELOG.md" },
      ],
    }).join("\n"),
    /Tracked political records cannot be deleted/i,
  );
});

test("versions are unique, monotonic, and classification appropriate", () => {
  const duplicateBaseChangelog = `${fixtureChangelog}\n## [v1.0.0] - 2098-12-31\n`;
  assert.match(errors({ base: { "CHANGELOG.md": duplicateBaseChangelog } }).join("\n"), /already exists|duplicate/i);

  const regressiveRecord = replaceField(fixtureRecord, "version", "v0.9.0");
  assert.match(errors({ record: regressiveRecord }).join("\n"), /later than predecessor|expected v1\.0\.1/i);

  let materialPatch = replaceField(fixtureRecord, "classification", "scope-expansion");
  materialPatch = replaceField(materialPatch, "effect_on_commitment", "expands");
  assert.match(errors({ record: materialPatch }).join("\n"), /scope-expansion.*minor|expected v1\.1\.0/i);

  const clarificationMinor = replaceField(fixtureRecord, "version", "v1.1.0");
  assert.match(errors({ record: clarificationMinor }).join("\n"), /clarification.*patch|expected v1\.0\.1/i);
});

test("a fictional political change cannot modify its own validation machinery", () => {
  assert.match(
    errors({
      proposed: { "scripts/change-record-contract.mjs": "export const weakened = true;\n" },
      changes: [
        { status: "M", path: policyPath },
        { status: "A", path: recordPath },
        { status: "M", path: "CHANGELOG.md" },
        { status: "M", path: "scripts/change-record-contract.mjs" },
      ],
    }).join("\n"),
    /cannot modify validation or governance machinery/i,
  );
});

test("the pull-request validator is base-sourced and treats the proposed tree only as data", () => {
  const workflow = fs.readFileSync(
    path.join(root, ".github", "workflows", "trusted-validate-change-records.yml"),
    "utf8",
  );
  assert.match(workflow, /pull_request_target:/);
  assert.match(workflow, /^\s{2}trusted-validate:\s*$/m);
  assert.match(workflow, /^\s{4}name:\s+trusted-validate\s*$/m);
  assert.doesNotMatch(workflow, /^\s{2}validate:\s*$/m);
  assert.match(workflow, /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/);
  assert.match(workflow, /path: trusted/);
  assert.match(workflow, /repository: \$\{\{ github\.event\.pull_request\.head\.repo\.full_name \}\}/);
  assert.match(workflow, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(workflow, /--repo-root "\$\{\{ github\.workspace \}\}\/proposed"/);
  assert.match(workflow, /git fetch --no-tags/);
  assert.match(workflow, /node scripts\/validate-change-records\.mjs/);
  assert.doesNotMatch(workflow, /working-directory: proposed\s+run: npm/i);
  assert.equal(workflow.match(/persist-credentials: false/g)?.length, 2);

  const candidateWorkflow = fs.readFileSync(
    path.join(root, ".github", "workflows", "validate-change-records.yml"),
    "utf8",
  );
  assert.match(candidateWorkflow, /pull_request:/);
  assert.match(candidateWorkflow, /^\s{2}validate:\s*$/m);
  assert.doesNotMatch(candidateWorkflow, /^\s{2}trusted-validate:\s*$/m);
  assert.match(candidateWorkflow, /run: npm test/);
  assert.match(candidateWorkflow, /run: npm run validate/);

  const settings = fs.readFileSync(path.join(root, "REPOSITORY-SETTINGS.md"), "utf8");
  assert.match(settings, /Trusted public change-record validation \/ trusted-validate/);
  assert.match(settings, /Validate public change records \/ validate/);
  assert.match(settings, /base-sourced trusted check/);
});

test("required change-record headings must be rendered, not fenced", () => {
  const frontMatterEnd = fixtureRecord.indexOf("\n---\n", 4) + 5;
  const fenced = `${fixtureRecord.slice(0, frontMatterEnd)}\`\`\`markdown\n${fixtureRecord.slice(frontMatterEnd)}\n\`\`\`\n`;
  assert.match(errors({ record: fenced }).join("\n"), /human-readable H1 title|rendered/i);

  const htmlHidden = `${fixtureRecord.slice(0, frontMatterEnd)}<div>\n${fixtureRecord.slice(frontMatterEnd)}\n</div>\n`;
  assert.match(errors({ record: htmlHidden }).join("\n"), /human-readable H1 title|rendered/i);
});

test("a newly added changelog entry must be visible and structurally complete", () => {
  const hidden = `# Changelog\n\n<!-- ${fixtureChangelog.replace("# Changelog", "")} -->\n`;
  assert.match(errors({ proposed: { "CHANGELOG.md": hidden } }).join("\n"), /visible changelog entry|newly added/i);
});

test("public implementation paths are exact tokens rather than substrings", () => {
  const collision = fixtureRecord.replace(
    "The separately reviewed fictional page `/priorities/fictional-civic-lanterns`",
    "The separately reviewed fictional page `/priorities/fictional-civic-lanterns-longer`",
  );
  assert.match(errors({ record: collision }).join("\n"), /does not identify \/priorities\/fictional-civic-lanterns/i);
});

test("public implementation cannot claim an undeclared path token or prose route", () => {
  const extraToken = fixtureRecord.replace(
    "Repository Markdown does not publish that page automatically.",
    "Also update `/how-ill-govern`. Repository Markdown does not publish that page automatically.",
  );
  assert.match(errors({ record: extraToken }).join("\n"), /undeclared public path.*how-ill-govern/i);

  const proseRoute = fixtureRecord.replace(
    "Repository Markdown does not publish that page automatically.",
    "Also update /how-ill-govern. Repository Markdown does not publish that page automatically.",
  );
  assert.match(errors({ record: proseRoute }).join("\n"), /exact rendered code tokens/i);

  for (const claim of [
    "Also update:/how-ill-govern.",
    "Also update https://jordanformayor.ca/how-ill-govern.",
    "Also update http://jordanformayor.ca/how-ill-govern.",
    "Also update //jordanformayor.ca/how-ill-govern.",
    "Also update /.",
    "Also update \"/\"."
  ]) {
    const broadened = fixtureRecord.replace(
      "Repository Markdown does not publish that page automatically.",
      `${claim} Repository Markdown does not publish that page automatically.`,
    );
    assert.match(errors({ record: broadened }).join("\n"), /exact rendered code tokens/i, claim);
  }
});

test("the website root route is a valid exact public implementation path", () => {
  const rootRecord = fixtureRecord
    .replace('  - "/priorities/fictional-civic-lanterns"', '  - "/"')
    .replace("`/priorities/fictional-civic-lanterns`", "`/`");
  assert.deepEqual(errors({ record: rootRecord }), []);
});

test("unexpected uppercase and nested platform Markdown cannot bypass tracking", () => {
  for (const unexpected of ["platform/New-Fictional-Commitment.md", "platform/nested/fictional-commitment.md", "platform/README.md"]) {
    const result = validateChangeSet({
      baseFiles: unexpected === "platform/README.md" ? { [unexpected]: "# Documentation index\n" } : {},
      proposedFiles: { [unexpected]: "# Fictional commitment\n" },
      changes: [{ status: unexpected === "platform/README.md" ? "M" : "A", path: unexpected }],
    });
    assert.match(result.join("\n"), /nonconforming political Markdown path/i, unexpected);
  }
});

test("semantic comparison rejects adversarial fictional block counts before quadratic allocation", () => {
  const fragmented = Array.from({ length: 700 }, (_, index) => `- Fictional item ${index}.`).join("\n");
  const result = validateChangeSet({
    baseFiles: { [policyPath]: fragmented },
    proposedFiles: { [policyPath]: `${fragmented}\n- One additional fictional item.` },
    changes: [{ status: "M", path: policyPath }],
  });
  assert.match(result.join("\n"), /semantic comparison exceeds the explicit limit/i);
});

test("duplicate declared wording cannot reuse one changed semantic block", () => {
  const duplicatePrevious = replaceSection(
    fixtureRecord,
    "Previous wording",
    `${semanticBlocks(basePolicy).find((block) => block.includes("one imaginary park"))}\n\n${semanticBlocks(basePolicy).find((block) => block.includes("one imaginary park"))}`,
  );
  assert.match(errors({ record: duplicatePrevious }).join("\n"), /exactly cover every removed political semantic block/i);
});

test("supporting evidence URLs must be genuinely public HTTPS targets", () => {
  for (const unsafe of [
    "https://localhost/admin",
    "https://127.0.0.1/evidence",
    "https://169.254.1.2/evidence",
    "https://10.0.0.8/evidence",
    "https://192.168.1.8/evidence",
    "https://[::1]/evidence",
    "https://[fd00::1]/evidence",
    "https://user:secret@example.com/evidence",
  ]) {
    const record = fixtureRecord.replace("https://example.com/fictional-lantern-standard", unsafe);
    assert.match(errors({ record }).join("\n"), /genuinely public HTTPS|public HTTPS/i, unsafe);
  }
});

test("an immutable fictional record path and ID cannot be reintroduced", () => {
  const result = validateChangeSet({
    ...changeSet(),
    historicalRecordPaths: [recordPath],
    historicalRecordIds: ["2099-01-01-fictional-civic-lanterns"],
  });
  assert.match(result.join("\n"), /previously used immutable record path|previously used immutable record id/i);
});

test("the CLI discovers a deleted immutable fictional record in Git history", () => {
  const temporaryRepository = fs.mkdtempSync(path.join(os.tmpdir(), "platform-history-"));
  const historicalPath = "changes/2099-01-01-fictional-history-record.md";
  const historicalId = "2099-01-01-fictional-history-record";
  const historicalSource = `---\nid: "${historicalId}"\n---\n# Fictional historical record\n`;
  const git = (...args) => execFileSync("git", args, {
    cwd: temporaryRepository,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

  try {
    git("init");
    git("config", "user.name", "Fictional Test Runner");
    git("config", "user.email", "fictional-test@example.com");
    git("config", "core.autocrlf", "false");
    git("fetch", "--no-tags", root, BASELINE_COMMIT);
    git("checkout", "-b", "synthetic-history", "FETCH_HEAD");

    const absoluteRecordPath = path.join(temporaryRepository, ...historicalPath.split("/"));
    fs.mkdirSync(path.dirname(absoluteRecordPath), { recursive: true });
    fs.writeFileSync(absoluteRecordPath, historicalSource);
    git("add", historicalPath);
    git("commit", "-m", "Add fictional historical record");

    fs.rmSync(absoluteRecordPath);
    git("add", "--all");
    git("commit", "-m", "Delete fictional historical record");
    const base = git("rev-parse", "HEAD");

    fs.writeFileSync(absoluteRecordPath, historicalSource);
    git("add", historicalPath);
    git("commit", "-m", "Attempt to reintroduce fictional historical record");
    const head = git("rev-parse", "HEAD");

    let validationOutput = "";
    try {
      execFileSync(
        process.execPath,
        [
          path.join(root, "scripts", "validate-change-records.mjs"),
          "--repo-root",
          temporaryRepository,
          "--base",
          base,
          "--head",
          head,
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
      assert.fail("The CLI unexpectedly accepted a reintroduced immutable record.");
    } catch (error) {
      validationOutput = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
    }

    assert.match(validationOutput, new RegExp(`Previously used immutable record path cannot be reintroduced: ${historicalPath.replaceAll(".", "\\.")}`, "i"));
    assert.match(validationOutput, new RegExp(`Previously used immutable record ID cannot be reused: ${historicalId}`, "i"));
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
});

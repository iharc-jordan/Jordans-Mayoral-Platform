import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  BASELINE_COMMIT,
  CLASSIFICATIONS,
  NEW_COMMITMENT_MARKER,
  WITHDRAWAL_MARKER,
  normalizeMarkdown,
  parseFrontMatter,
  validateChangeSet,
} from "../scripts/change-record-contract.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const fixtureRoot = path.join(here, "fixtures", "fictional");
const recordPath = "changes/2099-01-01-fictional-civic-lanterns.md";
const policyPath = "platform/fictional-civic-lanterns.md";

function read(relativePath) {
  return fs.readFileSync(path.join(fixtureRoot, relativePath), "utf8");
}

const basePolicy = read("base/platform/fictional-civic-lanterns.md");
const proposedPolicy = read("proposed/platform/fictional-civic-lanterns.md");
const fixtureRecord = read("proposed/changes/2099-01-01-fictional-civic-lanterns.md");
const fixtureChangelog = read("proposed/CHANGELOG.md");

function changeSet({ record = fixtureRecord, base = {}, proposed = {}, changes } = {}) {
  const baseFiles = { [policyPath]: basePolicy, "CHANGELOG.md": "# Changelog\n", ...base };
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

test("checked-in fictional clarification fixture is valid", () => {
  assert.deepEqual(errors(), []);
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
  for (const classification of CLASSIFICATIONS) {
    let record = replaceField(fixtureRecord, "classification", classification);
    record = replaceField(record, "effect_on_commitment", effects[classification]);
    if (classification === "policy-withdrawal") {
      record = replaceSection(record, "New wording", WITHDRAWAL_MARKER);
    }
    assert.deepEqual(errors({ record }), [], classification);
  }
});

test("incompatible classification and commitment effect fail closed", () => {
  const record = replaceField(fixtureRecord, "effect_on_commitment", "withdraws");
  assert.match(errors({ record }).join("\n"), /Incompatible classification\/effect pair/);
});

test("a genuine new commitment uses the explicit one-sided marker", () => {
  let record = replaceField(fixtureRecord, "classification", "scope-expansion");
  record = replaceField(record, "effect_on_commitment", "expands");
  record = replaceSection(record, "Previous wording", NEW_COMMITMENT_MARKER);
  assert.deepEqual(errors({ record, base: { [policyPath]: "" } }), []);
});

test("a withdrawal uses the explicit one-sided marker without fabricated new wording", () => {
  let record = replaceField(fixtureRecord, "classification", "policy-withdrawal");
  record = replaceField(record, "effect_on_commitment", "withdraws");
  record = replaceSection(record, "New wording", WITHDRAWAL_MARKER);
  assert.deepEqual(errors({ record }), []);
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
  assert.deepEqual(
    errors({
      record,
      base: { [second]: oldSecond },
      proposed: { [second]: newSecond },
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
  let record = replaceSection(fixtureRecord, "Previous wording", "> The fictional municipality will study blue paper\n> lanterns in one imaginary park.");
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

test("a quoted semantic block moved within a record is tied to the LCS delta", () => {
  const base = "# Fictional record\n\nFirst unchanged block.\n\nThe movable fictional block.\n\nLast unchanged block.\n";
  const proposed = "# Fictional record\n\nFirst unchanged block.\n\nLast unchanged block.\n\nThe movable fictional block.\n";
  let record = replaceSection(fixtureRecord, "Previous wording", "The movable fictional block.");
  record = replaceSection(record, "New wording", "The movable fictional block.");
  assert.deepEqual(errors({ record, base: { [policyPath]: base }, proposed: { [policyPath]: proposed } }), []);
});

test("a format-only tracked edit fails closed because it has no semantic delta", () => {
  const base = "# Fictional record\n\nA fictional sentence wraps across\nsource lines.\n";
  const proposed = "# Fictional record\n\nA fictional sentence wraps across source lines.\n";
  let record = replaceSection(fixtureRecord, "Previous wording", "A fictional sentence wraps across source lines.");
  record = replaceSection(record, "New wording", "A fictional sentence wraps across source lines.");
  assert.match(
    errors({ record, base: { [policyPath]: base }, proposed: { [policyPath]: proposed } }).join("\n"),
    /has no semantic Markdown change/,
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
  assert.match(errors({ proposed: { "CHANGELOG.md": "# Changelog\n" } }).join("\n"), /does not include v1.0.1/);
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
  const publicRecords = fs.readdirSync(path.join(root, "changes")).filter((name) => name.endsWith(".md"));
  assert.deepEqual(publicRecords, []);
  assert.equal(parseFrontMatter(fixtureRecord).data.id, "2099-01-01-fictional-civic-lanterns");
});

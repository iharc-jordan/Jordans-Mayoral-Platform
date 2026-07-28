# Methodology

## Inclusion standard

An item qualifies for this repository when it is publicly available and clearly presented by the Jordan Stevenson campaign as one or more of the following:

- a platform policy or policy package
- a campaign promise or formal commitment
- a campaign rule or self-imposed standard
- a governing principle that meaningfully constrains future conduct
- a public position that states what Jordan will do, pursue, introduce, advocate for or refuse to do
- fine print that is integral to understanding one of those commitments

A statement is not included merely because it appeared in a conversation, social post, interview, website feature or campaign document. It must be presented as an official campaign position, promise, rule or commitment.

## Exclusions

This repository does not include:

- internal strategy, planning instructions or political analysis
- opposition research, allegations or legal-case information
- unpublished drafts, hidden routes or unfinished work
- feature-flagged content that is not publicly available
- private GitHub issues, pull requests or commit information
- brainstorming, rejected proposals or unapproved ideas
- private cost assumptions or operational details
- donor information, personal data, credentials, tokens or infrastructure details
- biography, commentary, news or promotional material without a clear commitment
- games and website features unless they establish a formal public promise

## Source hierarchy

The source hierarchy for the baseline is:

1. The currently deployed campaign website at `https://jordanformayor.ca`
2. Public campaign documents linked from the deployed website
3. Other clearly official public campaign announcements
4. Website source and public Git history used to locate routes, verify wording and distinguish deployed content from drafts

When the live website and another public statement conflict, the live website controls the baseline unless the discrepancy can be resolved from public evidence. An unresolved material conflict blocks publication.

Private repositories and internal records may be used during the audit to locate or verify public material, but private URLs, issue references, commit details and internal content are not published here.

## Publication dates

`tracked_since` records the date this repository began forward public tracking.

`first_published` is included only when the date can be independently verified from a public source or reliable public history. When it cannot be verified, the field is omitted rather than guessed.

`last_verified` records the date the policy file was checked against its public source.

## Corrections

A correction to the baseline or a later version must be made through a visible pull request with one new immutable `changes/*.md` record. The Git diff proves the textual correction. The record preserves the previous and corrected wording, public evidence, classification, rationale, effect and the related commitments that did not change.

A correction that fixes transcription, metadata, formatting or a broken link without changing the commitment is an **Administrative correction**. A correction that changes the meaning must use the material-change classification that matches the substance.

## Material changes

A change is material when it alters what the campaign promises, who benefits, the scope, cost, timing, conditions, delivery mechanism, accountability standard or stated position.

The changelog classifications are:

- Clarification
- Evidence update
- Cost or timeline update
- Scope expansion
- Scope reduction
- Position change
- Policy withdrawal
- Administrative correction

The corresponding machine-readable values are `clarification`, `evidence-update`, `cost-or-timeline-update`, `scope-expansion`, `scope-reduction`, `position-change`, `policy-withdrawal` and `administrative-correction`.

Commitment effects use `no-material-change`, `expands`, `reduces`, `changes-position` or `withdraws`. The deterministic validator enforces conservative combinations: clarifications, evidence updates and administrative corrections do not materially change a commitment; scope expansions expand; scope reductions reduce; position changes change the position; and withdrawals withdraw. A cost or timeline update may leave the commitment materially unchanged, expand it or reduce it.

A genuine new commitment is recorded as a scope expansion with the `Not applicable: new commitment` previous-wording marker. A genuine withdrawal uses the `Not applicable: commitment withdrawn` new-wording marker. Fake old or new wording is prohibited.

## Evidence and public implementation

Each supporting-evidence item must be a public HTTPS link with a concise explanation of what it supports. The immutable record must also identify exact website routes and public artifacts that need deliberate review. Repository Markdown is never an automatic source for campaign website body copy; a website wording change requires a separate reviewed website pull request.

## Versioning

- Patch versions are for administrative corrections and clarifications that do not change the commitment.
- Minor versions are for evidence, cost or timeline changes, scope changes, new commitments and ordinary position revisions.
- Major versions are reserved for a fundamental platform reset, not routine campaign evolution.

`CHANGELOG.md` is a concise release index linking the immutable record. It does not duplicate the full explanation or require a commit to contain its own final SHA.

## Validation and bypass visibility

Validation compares the predecessor and proposed repository states rather than one brittle diff line. It normalizes Markdown and whitespace conservatively, checks paragraphs, headings and list items against the full affected files, requires the declared scope to exactly match changed political records, and protects merged change records from later editing or deletion.

Malformed records, undocumented direct edits, mismatched scope and ambiguous associations fail validation. If such a change nevertheless reaches the repository through an exceptional administrative bypass, the public website must keep the tracked commit visible as an `Unclassified repository change`. It must not hide the change or invent political meaning.

For the aggregated `CAMPAIGN-RULES.md` record, numbered H2 headings define stable identifiers `rule-1` through `rule-18`. A change record affecting that file must declare `affected_rule_sections` and the declaration must exactly equal the independently derived predecessor-to-proposed semantic delta. Omitted changed sections, declared unchanged sections, duplicate or invalid identifiers, and semantic changes outside numbered rules fail closed. `affected_website_pages` remains an untrusted publication-review declaration; the website derives authorized route scope from its own typed binding of verified section IDs.

## Retired or withdrawn policies

A retired or withdrawn policy will not be erased. Its file will be retained, its status will be changed, the withdrawal or replacement will be explained and the prior versions will remain available through Git history.

## Historical boundary

Forward tracking begins at **2026-07-24T09:00:00-04:00** with tagged baseline `v1.0.0` at commit `573d624fdd000da86eca654f882f02c01f6fa29c`. Earlier versions of later records remain available in Git history. This repository does not reconstruct private development, website edits or public statements from before the tracking boundary.

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

A correction to the baseline or a later version must be made through a visible pull request. The request should identify the error, show the previous and corrected wording, cite the public evidence and classify the change.

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

## Retired or withdrawn policies

A retired or withdrawn policy will not be erased. Its file will be retained, its status will be changed, the withdrawal or replacement will be explained and the prior versions will remain available through Git history.

## Historical boundary

This repository begins forward tracking with its initial baseline commit. Git history does not reconstruct edits made before the repository existed.

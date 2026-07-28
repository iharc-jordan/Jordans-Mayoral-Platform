# Repository settings for public-record integrity

These settings are manual administrative controls and must be verified in GitHub.

## Required `main` protections

- Require a pull request before merging to `main`.
- Require the `Validate public change records / validate` status check.
- Require conversations to be resolved.
- Block force pushes and branch deletion.
- Keep administrators subject to the protection rules.

The retired `Trusted public change-record validation / trusted-validate` check must not remain required after the simplification pull request. The ordinary deterministic `validate` check is the sole repository validator.

## Merge discipline

Use one pull request for one coherent political change. Prefer one squash-merge commit so the structured rule edit, its permanent JSON change record and review remain easy to inspect together.

After changing settings, verify that direct pushes, force pushes and branch deletion are rejected; `validate` is required; and `trusted-validate` is no longer required.

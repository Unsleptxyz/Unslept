# Contributing

Thanks for taking the time to improve Unslept.

## Before you start

- Security issues go through [SECURITY.md](SECURITY.md), never a public issue.
- For anything larger than a small fix, open an issue first so the approach can be agreed.

## Development

See the Development section of the [README](README.md) for the test commands. A change is ready when:

- `forge test` passes, and the fork test passes for contract changes
- package tests pass for SDK or MCP changes
- `npm run build` and `npm run copy-check` pass for website changes

## Rules the codebase keeps

- No hardcoded chain IDs, addresses or rates in application code. Read them from the environment.
- Yield is always variable, historical or illustrative. Never promise returns. No emoji or exclamation marks in
  user-facing copy.
- Contract changes need tests, including a failure case for every new check.
- Deployed contract sources in `contracts/src` are not edited in place. Changes ship as new contracts through the
  timelock.

## Pull requests

Keep each pull request focused on one change, describe what it does and how it was tested, and link the related
issue.

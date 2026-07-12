# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security vulnerabilities. Use
GitHub's private vulnerability reporting ("Report a vulnerability" under the
Security tab) so the report stays private until a fix ships.

You can expect an acknowledgement within 72 hours and a status update within
14 days.

## Scope notes

- The engine core executes no I/O and no network calls by design
  (Design Principle 11) — most security-relevant surface lives in format
  adapters (parsing untrusted PPTX bytes) and the plugin system.
- Plugin trust boundaries are documented in
  `docs/architecture/plugins/Plugin-System.md` §10–§11 and ADR-0005 §1.
  Reports that demonstrate a sandboxed-tier plugin escaping its declared
  permissions are treated as critical.

## Supported versions

Pre-1.0: only the latest published version of each package receives fixes.
This table will be maintained once packages are published.

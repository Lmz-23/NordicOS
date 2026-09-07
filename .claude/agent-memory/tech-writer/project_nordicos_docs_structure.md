---
name: project-nordicos-docs-structure
description: NordicOS has a three-tier doc structure (README, STATE.md, docs/*) with strict non-duplication rules and a priority order for conflicts
metadata:
  type: project
---

NordicOS keeps documentation split across three tiers that must not duplicate each other:

- `README.md` — user-facing, general project doc (installation, architecture overview, structure, roadmap). Written in Spanish, technical tone, with a numbered table of contents that must be kept in sync with `##` section headers.
- `STATE.md` — living project state doc (current version, resolved issues in detail, pending work). More detailed/technical than README on operational history.
- `docs/design-language.md`, `docs/design-system.md`, `palette/README.md` — specialized docs with an explicit priority order on conflicts: design-language.md > design-system.md > palette/README.md.

**Why:** the project owner (leomudom04@gmail.com) explicitly wants README to stay high-level and refer to STATE.md for full historical detail on resolved issues, rather than repeating full incident narratives in both places.

**How to apply:** when documenting a resolved bug/incident, put the one-line summary + pointer in README's "Issues resueltos" list (under Roadmap), and expect/assume the full narrative detail lives in STATE.md (verify STATE.md actually has it before claiming so in README — as of 2026-09-07 STATE.md had NOT yet been updated with the symlink/wallpaper incident, so avoid asserting "see STATE.md for full detail" unless verified present).

Related: [[project-nordicos-install-sh]], [[feedback-nordicos-verify-before-documenting]]

---
name: documentation
description: >
  Use this skill whenever writing or reviewing documentation and code comments —
  README files, method comments, inline comments, and docstrings. Keep everything
  brief and self-explanatory; never verbose.
compatibility: Roocode, Cline, GitHub Copilot, Claude, Cursor, any LLM-based coding agent
version: 1.0.0
last-reviewed: 2026-08-16
applies-to: README files, method comments, inline comments, docstrings
---

# Concise Documentation

Keep documentation brief. The code itself is the primary explanation.

## Non-Negotiable Rules

- Be concise — shorter is better; omit words that add no information
- Write self-explanatory code first — good names remove the need for many comments
- Explain **why**, not **what** — code already shows what it does; comments justify non-obvious decisions
- Never restate the code — a comment that repeats the next line is noise
- Keep README files lean: short intro, install, usage, config, links. No walls of prose
- No comment for obvious code: `total = price * qty; // multiply price by qty`

## Quick Reference

| Surface | Guideline |
|---|---|
| Method comment / docstring | One line stating purpose; params/returns only when not obvious |
| Inline comment | Only for non-obvious logic, invariants, or intent |
| README | Short intro, install, usage, config, links — nothing extra |
| Changelog | Each entry a single concise bullet |

## Good vs Verbose

Good:

```
// refresh token when it has less than a minute of life left
if (token.expiresInSeconds() < 60) refresh();
```

Verbose:

```
// This variable stores the total price after applying the discount.
const total = price - discount;
```
# Security policy

## Supported versions

| Version                       | Supported                             |
| ----------------------------- | ------------------------------------- |
| `1.0.0-beta.1` (current beta) | Yes, we will fix security issues here |
| `< 1.0.0-beta.1`              | No                                    |

Once `1.0` ships, we will support the latest minor on the `1.x` line.

## Reporting a vulnerability

**Do not open a public issue for security reports.**

Use one of these private channels instead:

- **GitHub private vulnerability reporting:** open a draft advisory via **Security, Advisories, Report a vulnerability** on the repository. This is preferred. It keeps the report private and lets us work on a fix together.
- **Email:** if private advisories are not available, contact the maintainers via the email on the repository owner's GitHub profile. Put "SECURITY" in the subject line.

Please include:

- What the vulnerability is and what it could do.
- Steps to reproduce (proof of concept, request and response, or a small repo).
- The version or commit you tested against.
- Any ideas for mitigation, if you have them.

We will acknowledge receipt within **3 business days** and aim to share a fix or mitigation plan within **14 days**, depending on severity. We will coordinate disclosure with you and credit you if you want it.

## Scope

This covers code in this repository, frontend (`src/`), backend handlers (`routes/`), and DB layer (`src/db/`). Out of scope: third party dependencies (report those upstream), deployment infrastructure outside this repo, and how you handle your own `DATABASE_URL` or LLM API keys.

## Handling of LLM and AI keys

AI features call the LLM on the server only (`routes/api/ai/`, `src/lib/llm/`). Never commit a real `DATABASE_URL`, LLM API key, or session token. Keep them in `.env` (gitignored). If you accidentally commit a key, rotate it.

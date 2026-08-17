# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| `1.0.0-beta.1` (current beta) | Yes — security fixes will be addressed |
| `< 1.0.0-beta.1` | No |

Once `1.0` ships, the latest minor on the `1.x` line will be the supported version.

## Reporting a vulnerability

**Do not open a public issue for security reports.**

Instead, use one of these private channels:

- **GitHub — Private vulnerability reporting:** open a draft advisory via **Security → Advisories → Report a vulnerability** on the repository (preferred — keeps the report private and lets us collaborate on a fix).
- **Email:** if private advisories are not available, contact the maintainers via the email listed on the repository owner's GitHub profile. Include "SECURITY" in the subject line.

Please include:

- A description of the vulnerability and its impact.
- Steps to reproduce (proof-of-concept, request/response, or minimal repo).
- The version or commit you tested against.
- Any suggested mitigation, if you have one.

We will acknowledge receipt within **3 business days** and aim to provide a fix or mitigation plan within **14 days**, depending on severity. We will coordinate disclosure with you and credit you if you wish.

## Scope

This policy covers the code in this repository — frontend (`src/`), backend handlers (`routes/`), and DB layer (`src/db/`). Out-of-scope: third-party dependencies (report upstream), deployment infrastructure outside this repo, and secrets management of your own `DATABASE_URL` / LLM API keys.

## Handling of LLM / AI keys

AI features call the LLM server-side only (`routes/api/ai/`, `src/lib/llm/`). Never commit real `DATABASE_URL`, LLM API keys, or session tokens — keep them in `.env` (gitignored). Rotate any key that was accidentally committed.

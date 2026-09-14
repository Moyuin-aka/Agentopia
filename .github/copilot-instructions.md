# Agentopia pull request review

Review the behavior introduced by the pull request, not only syntax or style. Report concrete, actionable findings and cite the affected line. Avoid restating the diff or proposing broad refactors outside the pull request's scope.

## Correctness and compatibility

- Check Agent-facing REST, OpenAPI, MCP, `public/llms.txt`, and README documentation for behavioral drift.
- Check Mission state transitions, creator/member authority, accepted-contributor credits, idempotency, notification delivery, and pagination for regressions.
- Treat REST and MCP as two interfaces over the same Agent behavior; flag mismatched inputs, outputs, permissions, or errors.
- Verify async work scheduled with Next.js `after()` does not affect the response contract and handles failures intentionally.

## Security and data

- Flag hardcoded credentials, raw Agent keys, recovery phrases, service-role keys, or production data.
- Browser code and external Agent clients must not receive the Supabase service-role key or bypass the documented Next.js APIs.
- Check every mutation for authentication/authorization, bounded input, rate limiting or idempotency where retry/abuse is relevant, and safe error responses.
- Verification metadata and display flags such as `is_official` do not grant authority. Authorization must use scoped role bindings.
- Raw Agent API keys are returned once and stored through the existing hash-based credential flow.
- Telegram receipts and Agent inbox acknowledgements are independent delivery states.

## Database changes

- New database changes need an append-only migration, an updated `supabase/schema.sql` snapshot, matching TypeScript database types, and updates to `docs/database-schema.md`.
- Do not accept edits to historical migrations that may already be deployed.
- Pay special attention to transactional integrity, RLS/grants, `SECURITY DEFINER` functions, `search_path`, and concurrency.

## Next.js and validation

- This repository uses Next.js 16.3. Read the relevant guide in `node_modules/next/dist/docs/` before suggesting framework API changes; do not rely on older Next.js conventions.
- Require meaningful tests for changed policies, validation, authorization, ranking, idempotency, delivery, and state transitions.
- Documentation-only changes should be checked for commands, links, route names, MCP tool names, and English/Chinese consistency.

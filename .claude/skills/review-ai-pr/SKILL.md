---
name: review-ai-pr
description: Review a pull request written with an AI coding agent, using the team reviewer's comments as input, not as a verdict; use when reviewing or preparing such a PR.
---

# Review an AI-written pull request

1. Run the team reviewer locally before pushing: `run_check review` (MCP) or
   `npx tsx packages/reviewer/src/cli.ts origin/main`. Blockers exit with code 2.
2. Treat each comment as a question. Rule comments (`rule …`) are deterministic and usually right;
   model comments are suggestions that already passed the guardrails (they cite a changed line).
3. Check what the reviewer cannot:
   - does the change do what the issue asked, and nothing more (agents add "helpful" extras)?
   - are the tests testing behaviour, or restating the implementation?
   - did the agent touch a protected file through a person's override? Say why in the PR.
4. Pricing, authorisation and migrations need a human reviewer who knows the domain, whatever the
   reviewer says.
5. If the reviewer was wrong (noise or a miss), add the case to the benchmark's next held-out set
   via the guide in `benchmarks/review/WRITING_PRS.md`, never by editing the current set.

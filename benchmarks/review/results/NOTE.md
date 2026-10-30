# First run: how it was made

- 24 pull requests (18 with one planted defect, 6 clean) written by an agent that read only
  `WRITING_PRS.md`, `AGENTS.md` and `apps/api` at commit `2401df5`, never the reviewer.
- The model answers were produced once by Claude (claude-opus-5-5, running as a Claude Code
  subagent) from the request files alone, recorded in `cassettes/claude.json`, and replayed for every
  mode. The author of the planted defects and the reviewing model are from the same model family;
  a different model may find different things.
- `first_run.json` names reviewer commit `b18893d`. That commit was rebased, unchanged, onto the
  automated lock-file commit before it was pushed; it is `3a04038` in the published history (the
  reviewer code is identical).
- The run is not rewritten and its misses have not been studied. Studying them makes this a
  regression set; a new blind set is then written from the guide.

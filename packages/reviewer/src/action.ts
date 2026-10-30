// GitHub Actions entry point: review the pull request that triggered the run.
import { readFileSync } from 'node:fs';
import { GitHub, summarise } from './github.js';
import { providerFromEnv } from './llm/provider.js';
import { conventionsFrom, loadConfig, review } from './review.js';

async function main(): Promise<void> {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH ?? '', 'utf8')) as { pull_request?: { number: number } };
  const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? '').split('/');
  const number = event.pull_request?.number;
  if (!owner || !repo || !number) throw new Error('not a pull_request event');
  const root = process.env.GITHUB_WORKSPACE ?? process.cwd();
  const gh = new GitHub(process.env.GITHUB_TOKEN ?? '');
  const pr = { owner, repo, number };

  const { input, headSha } = await gh.pullRequest(pr);
  const provider = providerFromEnv();
  const result = await review(input, {
    config: loadConfig(`${root}/config/quality.json`),
    conventions: conventionsFrom(readFileSync(`${root}/AGENTS.md`, 'utf8')),
    provider,
  });
  const summary = summarise(result.comments, result.dropped.length, result.model?.provider ?? null);
  await gh.postReview(pr, headSha, result.comments, result.notes, summary);
  console.log(summary);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

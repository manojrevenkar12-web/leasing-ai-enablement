import type { ReactNode } from 'react';
import { EmptyState } from '@/shared/ui/States';
import type { Loaded, Reports } from './reports';
import styles from './enablement.module.css';

const pct = (v: number, digits = 1) => `${v > 0 ? '+' : ''}${(v * 100).toFixed(digits)}%`;
const ESTIMATORS: [string, string][] = [
  ['before_after', 'Before vs after, adopters only'],
  ['adopters_vs_rest', 'Adopters vs never-adopters'],
  ['twfe', 'Two-way fixed effects'],
  ['callaway_santanna', 'Staggered DiD (Callaway–Sant’Anna)'],
];

function Section<T>({ id, title, lede, loaded, children }: { id: string; title: string; lede: string; loaded: Loaded<T>; children: (data: T) => ReactNode }) {
  return (
    <section className={styles.section} aria-labelledby={id}>
      <div className={styles.sectionHead}>
        <h2 id={id}>{title}</h2>
        <p>{lede}</p>
      </div>
      {loaded.ok ? (
        children(loaded.data)
      ) : (
        <EmptyState
          title={loaded.reason === 'missing' ? 'Not measured yet' : 'Report unreadable'}
          message={loaded.reason === 'missing' ? `No report at ${loaded.path}. Run the check that writes it (see AGENTS.md), then commit the report.` : `${loaded.path} is not valid JSON. Re-run the check that writes it.`}
        />
      )}
    </section>
  );
}

export function EnablementDesk({ reports }: { reports: Reports }) {
  const { goldenMaster, mutation, review, adoption, approved } = reports;
  return (
    <div className={styles.page} lang="en">
      <header className={styles.intro}>
        <h1>Enablement desk</h1>
        <p>
          What the AI-first ways of working are doing to this codebase, measured. Every number comes from a report the checks write; when a check has not run, this page says so instead
          of showing a guess.
        </p>
      </header>

      <Section id="refactor" title="AI refactor of the legacy calculator" lede="The legacy rate calculator was replaced by an AI-assisted refactor, merged only behind the refactor gate." loaded={goldenMaster}>
        {(gm) => (
          <>
            <dl className={styles.figures}>
              <Figure label="Recorded legacy quotes" value={gm.total.toLocaleString('en')} />
              <Figure label="Identical to the cent" value={gm.identical.toLocaleString('en')} />
              <Figure label="Explained by approved changes" value={gm.explained.toLocaleString('en')} />
              <Figure label="Unapproved differences" value={String(gm.unapproved.length)} tone={gm.unapproved.length ? 'bad' : 'good'} />
              {mutation.ok ? <Figure label={`Mutation score (gate ${mutation.data.min_percent}%)`} value={`${mutation.data.score_percent}%`} tone={mutation.data.score_percent >= mutation.data.min_percent ? 'good' : 'bad'} /> : null}
            </dl>
            {approved.ok ? (
              <ul className={styles.changes}>
                {approved.data.map((c) => (
                  <li key={c.id}>
                    <strong>
                      {c.id}: {c.title}
                    </strong>{' '}
                    <span className={styles.count}>{(gm.by_change[c.id] ?? 0).toLocaleString('en')} cases</span>
                    <p>{c.why}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </Section>

      <Section id="review" title="AI pull-request reviewer" lede="Measured once on pull requests with planted defects, written by someone who had not seen the reviewer." loaded={review}>
        {(r) => (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption className="visually-hidden">Reviewer benchmark by mode</caption>
                <thead>
                  <tr>
                    <th scope="col">Mode</th>
                    <th scope="col">Defects caught</th>
                    <th scope="col">Precision</th>
                    <th scope="col">Comments on clean PRs</th>
                  </tr>
                </thead>
                <tbody>
                  {r.scores.map((s) => (
                    <tr key={s.mode} data-shipped={s.mode.includes('shipped') || undefined}>
                      <th scope="row">{s.mode}</th>
                      <td>
                        {s.caught} of {s.defects} ({s.recall}%)
                      </td>
                      <td>{s.comments ? `${s.precision}%` : 'no comments'}</td>
                      <td>{s.commentsOnCleanPRs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={styles.note}>
              {r.cases} pull requests, model {r.model ?? 'none'}, a catch counts within {r.lineTolerance} lines of the defect. First run, recorded {new Date(r.recordedAt).toISOString().slice(0, 10)}; not rewritten.
            </p>
          </>
        )}
      </Section>

      <Section id="adoption" title="Measuring the rollout" lede={adoptionLede(adoption)} loaded={adoption}>
        {(a) => (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption className="visually-hidden">Effect of AI coding tools by estimator</caption>
                <thead>
                  <tr>
                    <th scope="col">Estimator</th>
                    <th scope="col">Throughput</th>
                    <th scope="col">Cycle time</th>
                  </tr>
                </thead>
                <tbody>
                  <tr data-truth>
                    <th scope="row">Truth (simulated organisation)</th>
                    <td>{pct(a.truth.throughput ?? 0)}</td>
                    <td>{pct(a.truth.cycle_time ?? 0)}</td>
                  </tr>
                  {ESTIMATORS.map(([k, label]) => (
                    <tr key={k} data-shipped={k === 'callaway_santanna' || undefined}>
                      <th scope="row">{label}</th>
                      <td>{pct(a.estimates.throughput?.[k] ?? 0)}</td>
                      <td>{pct(a.estimates.cycle_time?.[k] ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className={styles.figures}>
              {Object.entries(a.rework_phases).map(([phase, v]) => (
                <Figure key={phase} label={`Rework, ${phase} (truth ${pct(v.truth, 0)})`} value={pct(v.estimate, 0)} />
              ))}
            </dl>
            <p className={styles.note}>
              {a.teams} teams, {a.pull_requests.toLocaleString('en')} pull requests. 95% interval for throughput: {pct(a.intervals.throughput?.[0] ?? 0)} to {pct(a.intervals.throughput?.[1] ?? 0)}.
            </p>
          </>
        )}
      </Section>
    </div>
  );
}

function adoptionLede(a: Reports['adoption']): string {
  const base = 'A staggered rollout across teams, analysed four ways.';
  if (!a.ok) return base;
  const truth = a.data.truth.throughput ?? 0;
  const over = ['before_after', 'adopters_vs_rest'].map((k) => Math.round(((a.data.estimates.throughput?.[k] ?? truth) - truth) * 100));
  return `${base} The comparisons people reach for first overstate the throughput gain by ${Math.min(...over)} to ${Math.max(...over)} points.`;
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className={styles.figure}>
      <dt>{label}</dt>
      <dd data-tone={tone}>{value}</dd>
    </div>
  );
}

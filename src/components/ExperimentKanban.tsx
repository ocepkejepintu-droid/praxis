import Link from 'next/link';
import { EvidenceLinks } from './EvidenceLinks';
import type { ExperimentCard, ExperimentStage } from '@/lib/os';

const columns: Array<{ key: ExperimentStage; title: string; hint: string }> = [
  { key: 'worth_trying', title: 'Worth trying', hint: 'Strong praxis, not scheduled' },
  { key: 'queued', title: 'Queued', hint: 'Ready for next run' },
  { key: 'verifying', title: 'Verifying', hint: 'Source/evidence check' },
  { key: 'learning', title: 'Learning', hint: 'Agent is trying it' },
  { key: 'tried', title: 'Tried', hint: 'Evidence collected' },
  { key: 'adopted', title: 'Adopted', hint: 'Keep in loop' },
  { key: 'killed', title: 'Killed / parked', hint: 'Stop spending cycles' },
];

export function ExperimentKanban({ experiments, overview = false, authed = false }: { experiments: ExperimentCard[]; overview?: boolean; authed?: boolean }) {
  return (
    <section className="kanbanBoard">
      {columns.map((column) => {
        const laneExperiments = experiments.filter((experiment) => experiment.stage === column.key);
        return (
          <div className="kanbanLane" key={column.key}>
            <header>
              <h2>{column.title}</h2>
              <span>{laneExperiments.length} praxies · {column.hint}</span>
            </header>
            {laneExperiments.length ? laneExperiments.map((experiment) => (
              overview ? <ExperimentOverview experiment={experiment} authed={authed} key={experiment.id} /> : <ExperimentDetail experiment={experiment} key={experiment.id} />
            )) : <p className="emptyState">No praxies here yet.</p>}
          </div>
        );
      })}
    </section>
  );
}

function ExperimentOverview({ experiment, authed }: { experiment: ExperimentCard; authed?: boolean }) {
  return (
    <Link href={experiment.sourceNoteHref} className="experimentCard overviewCard clickableCard">
      <p className="ownerTag">{experiment.owner}</p>
      <h3>{experiment.title}</h3>
      <p>{experiment.hypothesis}</p>
      <p className="nextMove"><strong>First test:</strong> {experiment.firstTest}</p>
      <div className="overviewMeta">
        <span>{statusLabel(experiment.status)}</span>
        <span>{experiment.executionSteps.length} steps</span>
        <span>{experiment.sourceUrls.length} source{experiment.sourceUrls.length === 1 ? '' : 's'}</span>
        <em>{authed ? 'Open + edit praxis →' : 'Open detail path →'}</em>
      </div>
    </Link>
  );
}

function ExperimentDetail({ experiment }: { experiment: ExperimentCard }) {
  return (
    <article className="experimentCard">
      <p className="ownerTag">{experiment.owner}</p>
      <h3>{experiment.title}</h3>
      <p>{experiment.hypothesis}</p>
      <dl>
        <div><dt>First test</dt><dd>{experiment.firstTest}</dd></div>
      </dl>
      <details className="experimentCriteria experimentPath">
        <summary>Execution path</summary>
        <StepList steps={experiment.executionSteps} />
      </details>
      <details className="experimentCriteria experimentProof">
        <summary>Success, stop + source</summary>
        <dl>
          <div><dt>Success</dt><dd>{experiment.successSignal}</dd></div>
          <div><dt>Stop if</dt><dd>{experiment.killCriteria}</dd></div>
        </dl>
        <EvidenceLinks noteHref={experiment.sourceNoteHref} sourcePath={experiment.sourcePath} sourceUrls={experiment.sourceUrls} />
        <em>{experiment.source}</em>
      </details>
    </article>
  );
}

function statusLabel(status: string) {
  return status === 'test' ? 'In experiment' : `Status: ${status}`;
}

function StepList({ steps }: { steps: string[] }) {
  return <ol className="inlineSteps">{steps.map((step) => <li key={step}>{step}</li>)}</ol>;
}

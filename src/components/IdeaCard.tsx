import Link from 'next/link';
import { EvidenceLinks } from './EvidenceLinks';
import type { IdeaCard as Idea } from '@/lib/os';

export function IdeaCard({ idea, compact = false }: { idea: Idea; compact?: boolean }) {
  if (compact) {
    return (
      <Link href={idea.sourceNoteHref} className={`ideaCard overviewCard clickableCard stage-${idea.stage}`}>
        <div className="cardTop"><strong>{idea.title}</strong><span>{idea.stage.replace('_', ' ')}</span></div>
        <p>{idea.thesis}</p>
        <p className="nextMove"><strong>Next:</strong> {idea.nextMove}</p>
        <div className="overviewMeta">
          <span>{idea.sourceUrls.length} source{idea.sourceUrls.length === 1 ? '' : 's'}</span>
          <span>{idea.executionSteps.length} steps</span>
          <em>Open detail path →</em>
        </div>
      </Link>
    );
  }

  return (
    <article className={`ideaCard stage-${idea.stage}${compact ? ' compactCard' : ''}`}>
      <div className="cardTop"><strong>{idea.title}</strong><span>{idea.stage.replace('_', ' ')}</span></div>
      <p>{idea.thesis}</p>
      {compact ? (
        <p className="nextMove"><strong>Next:</strong> {idea.nextMove}</p>
      ) : (
        <dl>
          <div><dt>Why now</dt><dd>{idea.whyNow}</dd></div>
          <div><dt>Next move</dt><dd>{idea.nextMove}</dd></div>
          <div><dt>Execution path</dt><dd><StepList steps={idea.executionSteps} /></dd></div>
        </dl>
      )}
      <EvidenceLinks noteHref={idea.sourceNoteHref} sourcePath={idea.sourcePath} sourceUrls={idea.sourceUrls} />
      <div className="metaRow"><span className="score"><strong>{idea.leverage}</strong><em>leverage</em></span><span className="score"><strong>{idea.effort}</strong><em>effort</em></span></div>
    </article>
  );
}

function StepList({ steps }: { steps: string[] }) {
  return <ol className="inlineSteps">{steps.map((step) => <li key={step}>{step}</li>)}</ol>;
}

import { IdeaCard } from '@/components/IdeaCard';
import { getXReport } from '@/lib/atlas';
import { getDashboardData } from '@/lib/markdown';
import { getOperatingSlice, type IdeaStage } from '@/lib/os';

export const dynamic = 'force-dynamic';

const stages: Array<{ key: IdeaStage; title: string; copy: string }> = [
  { key: 'act_now', title: 'Act now', copy: 'X signals strong enough to become this week’s test.' },
  { key: 'worth_trying', title: 'Worth trying', copy: 'Promising signal, but keep the first move small.' },
  { key: 'watch', title: 'Watch', copy: 'Useful market movement, not a build task yet.' },
  { key: 'ignore', title: 'Ignore', copy: 'Noise, ad bait, or weak evidence.' },
];

export default function IdeasPage() {
  const data = getDashboardData();
  const os = getOperatingSlice(data);
  const report = getXReport(data);
  return (
    <div className="atlasPage">
      <section className="atlasSubHero"><p>ideas · report translation</p><h1>X signals translated into bets.</h1><span>Each idea should answer: what happened on X, why it matters, original source, dependency path, first test, and stop rule. No raw crawl dump.</span></section>
      <section className="decisionBrief ideasDecisionBrief" aria-label="Ideas report brief">
        {report.topThemes.slice(0, 4).map((theme) => (
          <article key={theme.key}>
            <span>{theme.title}</span>
            <p>{theme.whatChanged}</p>
          </article>
        ))}
      </section>
      <section className="ideaColumns">
        {stages.map((stage) => {
          const laneIdeas = os.ideas.filter((idea) => idea.stage === stage.key);
          return (
            <div className="ideaColumn" key={stage.key}>
              <header><h2>{stage.title}</h2><span>{laneIdeas.length} ideas · {stage.copy}</span></header>
              {laneIdeas.map((idea) => <IdeaCard idea={idea} compact key={idea.id} />)}
              {!laneIdeas.length ? <p className="emptyState">No Hermes-judged industry ideas in this lane yet.</p> : null}
            </div>
          );
        })}
      </section>
    </div>
  );
}

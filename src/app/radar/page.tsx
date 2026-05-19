import Link from 'next/link';
import { RiskBadge, ScoreBadge, StatusPill } from '@/components/Pills';
import { getDashboardData } from '@/lib/markdown';

export const dynamic = 'force-dynamic';

export default function RadarPage() {
  const data = getDashboardData();
  const categoryCounts = data.repos.reduce<Record<string, number>>((acc, repo) => {
    acc[repo.category] = (acc[repo.category] || 0) + 1;
    return acc;
  }, {});
  const topCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  const riskRank = { unknown: 0, low: 1, medium: 2, high: 3 } as const;
  const bucketMap = new Map<string, {
    actionability: number;
    strategicRelevance: number;
    count: number;
    note: (typeof data.notes)[number];
    risk: keyof typeof riskRank;
  }>();
  for (const note of data.notes) {
    const key = `${note.actionability}-${note.strategicRelevance}`;
    const existing = bucketMap.get(key);
    if (!existing) {
      bucketMap.set(key, {
        actionability: note.actionability,
        strategicRelevance: note.strategicRelevance,
        count: 1,
        note,
        risk: note.risk,
      });
      continue;
    }
    existing.count += 1;
    if ((note.strategicRelevance + note.actionability) > (existing.note.strategicRelevance + existing.note.actionability)) existing.note = note;
    if (riskRank[note.risk] > riskRank[existing.risk]) existing.risk = note.risk;
  }
  const radarBuckets = Array.from(bucketMap.values())
    .sort((a, b) => (b.strategicRelevance + b.actionability + b.count / 100) - (a.strategicRelevance + a.actionability + a.count / 100));

  return (
    <div className="atlasPage">
      <section className="atlasSubHero">
        <p>radar · relevance × action</p>
        <h1>Relevance × action.</h1>
        <span>Top-right items are candidates to act on. High-relevance low-action items stay on watch until source confidence improves.</span>
      </section>

      <section className="grid two radarGrid">
        <div className="panel radarPanel">
          <div className="radarCanvas radarMatrix" aria-label="Radar matrix">
            <span className="axisLabel yHigh">High relevance</span>
            <span className="axisLabel yLow">Low relevance</span>
            <span className="axisLabel xLow">Low action</span>
            <span className="axisLabel xHigh">High action</span>
            <div className="radarMatrixCells">
              {[5, 4, 3, 2, 1].map((relevance) => (
                [1, 2, 3, 4, 5].map((action) => {
                  const bucket = radarBuckets.find((item) => item.strategicRelevance === relevance && item.actionability === action);
                  const label = bucket ? (bucket.count > 99 ? '99+' : String(bucket.count)) : '0';
              return (
                    bucket ? (
                      <Link
                        key={`${action}-${relevance}`}
                        href={`/notes/${bucket.note.slug}`}
                        className={`radarCell risk-${bucket.risk}`}
                        title={`${bucket.count} signals: relevance ${bucket.strategicRelevance}, action ${bucket.actionability}. Top: ${bucket.note.title}`}
                        aria-label={`${bucket.count} signals at relevance ${bucket.strategicRelevance}, action ${bucket.actionability}. Top: ${bucket.note.title}`}
                      >
                        <strong>{label}</strong>
                        <span>{bucket.note.title}</span>
                      </Link>
                    ) : (
                      <span className="radarCell emptyRadarCell" key={`${action}-${relevance}`} aria-hidden="true">
                        <strong>{label}</strong>
                      </span>
                    )
                  );
                })
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="sectionHead"><h2>Repeating categories</h2><span>{data.repos.length} repo leads</span></div>
          <div className="categoryList">
            {topCategories.map(([category, count]) => (
              <Link href={`/repos?category=${encodeURIComponent(category)}`} key={category}>
                <strong>{category}</strong>
                <span>{count}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="sectionHead"><h2>High-priority opportunities</h2><span>top watchlist items</span></div>
        <div className="repoGrid">
          {data.repos.slice(0, 12).map((repo) => (
            <article className="repoCard" key={`${repo.sourceNoteSlug}-${repo.name}`}>
              <div className="cardTop"><strong>{repo.name}</strong><RiskBadge risk={repo.risk} /></div>
              <p>{repo.category}</p>
              <div className="metaRow"><StatusPill status={repo.status} /><ScoreBadge label="rel" value={repo.relevance} /></div>
              <div className="buttonRow">
                {repo.url ? <a href={repo.url} target="_blank" rel="noreferrer">GitHub</a> : null}
                <Link href={`/notes/${repo.sourceNoteSlug}`}>source note</Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

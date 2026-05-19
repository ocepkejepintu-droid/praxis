export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getCanonicalActions } from '@/lib/actions';
import { getDashboardData } from '@/lib/markdown';
import type { CanonicalAction } from '@/lib/types';

const priorities = ['high', 'medium', 'low'] as const;
const sourceTypes = ['action', 'idea', 'experiment', 'raw'] as const;

type Params = Record<string, string | string[] | undefined>;

export default async function ActionsPage({ searchParams }: { searchParams?: Promise<Params> }) {
  const params = (await searchParams) || {};
  const selectedPriority = one(params.priority, 'all');
  const selectedCategory = one(params.category, 'all');
  const selectedSource = one(params.source, 'all');
  const query = one(params.q, '').toLowerCase();
  const sort = one(params.sort, 'score');
  const showAll = one(params.show, 'top') === 'all';
  const data = getDashboardData();
  const canonical = getCanonicalActions(data);
  const activeActions = canonical.filter((action) => !action.boilerplate);
  const boilerplateActions = canonical.filter((action) => action.boilerplate);
  const categories = Array.from(new Set(activeActions.flatMap((action) => action.categories))).sort();
  const priorityCounts = priorities.map((priority) => ({
    priority,
    count: activeActions.filter((action) => action.priority === priority).length,
  }));
  const filtered = activeActions.filter((action) =>
    (selectedPriority === 'all' || action.priority === selectedPriority)
    && (selectedCategory === 'all' || action.categories.includes(selectedCategory))
    && (selectedSource === 'all' || action.sourceTypes.includes(selectedSource as CanonicalAction['sourceTypes'][number]))
    && (!query || `${action.text} ${action.primaryCategory} ${action.sources.map((source) => source.noteTitle).join(' ')}`.toLowerCase().includes(query)),
  );
  const sorted = [...filtered].sort((a, b) => sort === 'sources' ? b.sourceCount - a.sourceCount || b.score - a.score : sort === 'category' ? a.primaryCategory.localeCompare(b.primaryCategory) : b.score - a.score);
  const visibleActions = showAll || Boolean(query) || selectedPriority !== 'all' || selectedCategory !== 'all' || selectedSource !== 'all'
    ? sorted
    : sorted.slice(0, 12);

  return (
    <div className="atlasPage">
      <section className="atlasSubHero actionHeader">
        <p>reports · execution queue</p>
        <h1>Only show work worth doing.</h1>
        <span>Canonical tasks, deduped from raw notes. Default view hides ingestion boilerplate and caps the queue.</span>
        <div className="repoHeaderStats">
          <span>{visibleActions.length} shown</span>
          <span>{activeActions.length} canonical</span>
          <span>{data.actions.length} raw</span>
          <span>{boilerplateActions.reduce((sum, action) => sum + action.sourceCount, 0)} boilerplate hidden</span>
        </div>
      </section>

      <form className="atlasToolbar" action="/actions">
        <input name="q" defaultValue={query} placeholder="Search task, source, category" />
        <select name="sort" defaultValue={sort} aria-label="Sort actions">
          <option value="score">score</option>
          <option value="sources">source count</option>
          <option value="category">category</option>
        </select>
        <input type="hidden" name="show" value="all" />
        <button type="submit">Search queue</button>
      </form>

      <section className="actionSummaryGrid" aria-label="Action priority summary">
        {priorityCounts.map((item) => (
          <Link className={`actionMetric priority-${item.priority}`} href={`/actions?priority=${item.priority}&show=all`} key={item.priority}>
            <strong>{item.count}</strong>
            <span>{item.priority} priority</span>
          </Link>
        ))}
      </section>

      <div className="filterBar actionFilters groupedFilters" aria-label="Action filters">
        <div className="filterGroup">
          <span>View</span>
          <FilterLink label="top" href="/actions" active={selectedPriority === 'all' && selectedCategory === 'all' && selectedSource === 'all' && !showAll && !query} />
          <FilterLink label="all canonical" href="/actions?show=all" active={showAll && selectedPriority === 'all' && selectedCategory === 'all' && selectedSource === 'all'} />
        </div>
        <div className="filterGroup">
          <span>Priority</span>
          {priorities.map((priority) => <FilterLink key={priority} label={priority} href={`/actions?priority=${priority}&show=all`} active={selectedPriority === priority} />)}
        </div>
        <div className="filterGroup">
          <span>Source</span>
          {sourceTypes.map((source) => <FilterLink key={source} label={source} href={`/actions?source=${source}&show=all`} active={selectedSource === source} />)}
        </div>
        <div className="filterGroup categoryFilterGroup">
          <span>Category</span>
          {categories.map((category) => <FilterLink key={category} label={category} href={`/actions?category=${encodeURIComponent(category)}&show=all`} active={selectedCategory === category} />)}
        </div>
      </div>
      <section className="panel actionQueuePanel atlasQueuePanel">
        <div className="sectionHead"><h2>{showAll || query ? 'Canonical queue' : 'Today queue'}</h2><span>{showAll || query ? 'filtered operating backlog' : 'top 12 only'}</span></div>
        <div className="actionQueue">
          {visibleActions.map((action) => <ActionCard action={action} key={action.id} />)}
          {!visibleActions.length ? <p className="emptyState">No actions match these filters.</p> : null}
        </div>
      </section>

      <details className="panel actionQueuePanel atlasQueuePanel mutedPanel boilerplatePanel">
        <summary>
          <span>Grouped ingestion boilerplate</span>
          <em>{boilerplateActions.length} recurring tasks hidden from default queue</em>
        </summary>
        <div className="actionQueue compactQueue">
          {boilerplateActions.map((action) => <ActionCard action={action} compact key={action.id} />)}
        </div>
      </details>
    </div>
  );
}

function one(value: string | string[] | undefined, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}
function FilterLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return <Link className={active ? 'active' : ''} href={href}>{label}</Link>;
}

function ActionCard({ action, compact = false }: { action: CanonicalAction; compact?: boolean }) {
  const primarySource = action.sources[0];
  return (
    <article className={`actionItem actionCard priority-${action.priority}`}>
      <div className="actionCardTop">
        <span>{action.priority} · {action.primaryCategory}</span>
        <em>{action.sourceCount} source{action.sourceCount === 1 ? '' : 's'}</em>
      </div>
      <div className="actionTextGroup">
        <strong>{action.text}</strong>
        <small>{action.sourceTypes.join(' + ')} · {action.categories.slice(0, 3).join(', ')}</small>
      </div>
      {primarySource ? <Link className="detailLink" href={`/notes/${primarySource.noteSlug}`}>Open detail path</Link> : null}
      {compact ? null : (
        <details className="actionSources">
          <summary>Source paths</summary>
          <div>
            {action.sources.map((source) => (
              <Link href={`/notes/${source.noteSlug}`} key={`${action.id}-${source.noteSlug}`}>
                <span>{source.noteType}</span>
                <strong>{source.noteTitle}</strong>
                <em>{source.notePath}</em>
              </Link>
            ))}
          </div>
        </details>
      )}
    </article>
  );
}

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { RiskBadge, ScoreBadge, StatusPill } from '@/components/Pills';
import { getAtlasCategories, readableCategory } from '@/lib/atlas';
import { getDashboardData } from '@/lib/markdown';
import type { RepoMention } from '@/lib/types';

type Params = Record<string, string | string[] | undefined>;

export default async function ReposPage({ searchParams }: { searchParams?: Promise<Params> }) {
  const params = (await searchParams) || {};
  const selectedStatus = one(params.status, 'all');
  const selectedCategory = one(params.category, 'all');
  const selectedRisk = one(params.risk, 'all');
  const query = one(params.q, '').toLowerCase();
  const sort = one(params.sort, 'relevance');
  const data = getDashboardData();
  const categories = getAtlasCategories(data);
  const categoryKeys = categories.map((category) => category.key);
  const repos = sortRepos(data.repos.filter((repo) =>
    (selectedStatus === 'all' || repo.status === selectedStatus)
    && (selectedCategory === 'all' || repo.category === selectedCategory)
    && (selectedRisk === 'all' || repo.risk === selectedRisk)
    && (!query || `${repo.name} ${repo.category} ${repo.sourceNoteTitle} ${repo.nextAction || ''}`.toLowerCase().includes(query)),
  ), sort);
  const grouped = categoryKeys
    .map((key) => ({ key, title: readableCategory(key), repos: repos.filter((repo) => repo.category === key) }))
    .filter((group) => group.repos.length);

  return (
    <div className="atlasPage">
      <section className="atlasSubHero repoHeader">
        <p>repos · source map</p>
        <h1>Repo watchlist, grouped as source files.</h1>
        <span>Search, sort, risk-filter, then open GitHub or source note before adoption.</span>
        <div className="repoHeaderStats"><span>{repos.length} shown</span><span>{data.repos.length} total</span><span>{data.stats.verify} verify</span></div>
      </section>

      <form className="atlasToolbar" action="/repos">
        <input name="q" defaultValue={query} placeholder="Search repo, source note, category" />
        <select name="sort" defaultValue={sort} aria-label="Sort repos">
          <option value="relevance">relevance</option>
          <option value="name">name</option>
          <option value="risk">risk</option>
        </select>
        <button type="submit">Search repos</button>
      </form>

      <div className="filterBar repoFilters groupedFilters atlasFilters" aria-label="Repo filters">
        <div className="filterGroup"><span>View</span><FilterLink label="all" href="/repos" active={selectedStatus === 'all' && selectedCategory === 'all' && selectedRisk === 'all' && !query} /></div>
        <div className="filterGroup"><span>Status</span>{['verify', 'watch', 'inbox', 'test', 'ignore'].map((status) => <FilterLink key={status} label={status} href={`/repos?status=${status}`} active={selectedStatus === status} />)}</div>
        <div className="filterGroup"><span>Risk</span>{['high', 'medium', 'low'].map((risk) => <FilterLink key={risk} label={risk} href={`/repos?risk=${risk}`} active={selectedRisk === risk} />)}</div>
        <div className="filterGroup categoryFilterGroup"><span>Category</span>{categoryKeys.map((category) => <FilterLink key={category} label={readableCategory(category)} href={`/repos?category=${encodeURIComponent(category)}`} active={selectedCategory === category} />)}</div>
      </div>

      <section className="atlasRepoDirectory" aria-label="Repo categories">
        {grouped.map((group, index) => (
          <article className="atlasCategory repoGroup" key={group.key}>
            <header>
              <span>§{String(index + 1).padStart(2, '0')}</span>
              <div><h2>{group.title}</h2><p>{group.repos.length} repo lead{group.repos.length === 1 ? '' : 's'} mapped from source notes.</p></div>
              <strong>{group.repos.length} repos</strong>
            </header>
            <div className="repoDirectory">
              {group.repos.map((repo, repoIndex) => <RepoRow repo={repo} key={`${repo.sourceNoteSlug}-${repo.name}-${repoIndex}`} />)}
            </div>
          </article>
        ))}
        {!repos.length ? <p className="emptyState">No repos match these filters.</p> : null}
      </section>
    </div>
  );
}

function sortRepos(repos: RepoMention[], sort: string) {
  const riskRank: Record<string, number> = { high: 3, medium: 2, low: 1 };
  return [...repos].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'risk') return (riskRank[b.risk] || 0) - (riskRank[a.risk] || 0) || b.relevance - a.relevance;
    return b.relevance - a.relevance || a.name.localeCompare(b.name);
  });
}

function one(value: string | string[] | undefined, fallback: string) {
  return typeof value === 'string' ? value.trim() : fallback;
}

function FilterLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return <Link className={active ? 'active' : ''} href={href}>{label}</Link>;
}

function RepoRow({ repo }: { repo: RepoMention }) {
  return (
    <article className="repoCard repoWatchCard repoWatchRow atlasRepoWatchRow">
      <div className="repoCardHead">
        <div><p className="repoCategory">{repo.category}</p><h2>{repo.name}</h2></div>
        <ScoreBadge label="rel" value={repo.relevance} />
      </div>
      <div className="metaRow repoState"><StatusPill status={repo.status} /><RiskBadge risk={repo.risk} /></div>
      <div className="repoIntel">
        <p className="repoSource">{repo.sourceNoteTitle}</p>
        {repo.nextAction ? <p className="repoNext"><strong>Next:</strong> {repo.nextAction}</p> : null}
      </div>
      <div className="repoActions">
        {repo.url ? <a href={repo.url} target="_blank" rel="noreferrer">Open GitHub</a> : null}
        <Link href={`/notes/${repo.sourceNoteSlug}`}>Source note</Link>
      </div>
    </article>
  );
}

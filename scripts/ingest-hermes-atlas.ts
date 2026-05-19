type RepoRecord = {
  owner?: string;
  repo?: string;
  name?: string;
  description?: string;
  stars?: number;
  url?: string;
  official?: boolean;
  category?: string;
  [key: string]: unknown;
};

type SummaryRecord = {
  summary?: string;
  highlights?: string[];
  generatedAt?: string;
  audit?: string;
  [key: string]: unknown;
};

type RssItem = {
  title: string;
  link: string;
  pubDate?: string;
  category?: string;
  description?: string;
};

type NormalizedCard = {
  externalId: string;
  title: string;
  body: string;
  author?: string;
  category?: string;
  sourceUrl: string;
  canonicalUrl?: string;
  urls: string[];
  metrics: Record<string, unknown>;
  publishedAt?: string;
  raw: Record<string, unknown>;
};

const ATLAS_BASE = 'https://hermesatlas.com';

function argValue(name: string, fallback?: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function numberArg(name: string, fallback: number, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(argValue(name));
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function decodeXml(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function tagValue(item: string, tag: string) {
  const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return decodeXml(match?.[1] || '');
}

function parseRssItems(xml: string): RssItem[] {
  const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  return itemMatches.map((item) => ({
    title: tagValue(item, 'title'),
    link: tagValue(item, 'link'),
    pubDate: tagValue(item, 'pubDate') || undefined,
    category: tagValue(item, 'category') || undefined,
    description: tagValue(item, 'description') || undefined,
  })).filter((item) => item.title && item.link);
}

function projectKeyFromUrl(url?: string) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/projects\/([^/]+)\/([^/]+)/);
    if (!match) return '';
    return `${decodeURIComponent(match[1])}/${decodeURIComponent(match[2])}`;
  } catch {
    return '';
  }
}

function projectUrl(owner: string, repo: string) {
  return `${ATLAS_BASE}/projects/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

function isoDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function withinSinceDays(dateValue: string | undefined, sinceDays: number) {
  if (!dateValue || !sinceDays) return true;
  const time = new Date(dateValue).getTime();
  if (Number.isNaN(time)) return true;
  return time >= Date.now() - sinceDays * 24 * 60 * 60 * 1000;
}

async function fetchText(url: string) {
  const response = await fetch(url, { headers: { accept: 'application/json,text/xml,text/plain,*/*' } });
  if (!response.ok) throw new Error(`Fetch failed ${response.status} ${url}`);
  return response.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  return JSON.parse(await fetchText(url)) as T;
}


function createPraxisDescription(repo: RepoRecord, summary?: SummaryRecord): string {
  if (summary?.summary && typeof summary.summary === "string" && summary.summary.length > 20) {
    const firstSentence = summary.summary.split(/[.!?]/)[0].trim();
    if (firstSentence.length > 15) {
      return firstSentence + (firstSentence.endsWith(".") ? "" : ".");
    }
  }
  if (repo.description && typeof repo.description === "string" && repo.description.length > 15) {
    return repo.description;
  }
  return `${repo.name || repo.repo} from the Hermes ecosystem.`;
}


function cardBody(repo: RepoRecord, summary?: SummaryRecord, rss?: RssItem) {
  const parts = [
    typeof summary?.summary === 'string' ? summary.summary : '',
    Array.isArray(summary?.highlights) && summary.highlights.length ? `Highlights: ${summary.highlights.slice(0, 5).join('; ')}` : '',
    typeof repo.description === 'string' ? repo.description : '',
    rss?.description || '',
  ].filter(Boolean);
  return parts.join('\n\n').slice(0, 6000) || `${repo.name || repo.repo} from Hermes Atlas.`;
}

function createCards(repos: RepoRecord[], summaries: Record<string, SummaryRecord>, rssItems: RssItem[], maxCards: number, sinceDays: number): NormalizedCard[] {
  const rssEntries: [string, RssItem][] = [];
  for (const item of rssItems) {
    const key = projectKeyFromUrl(item.link);
    if (key) rssEntries.push([key, item]);
  }
  const rssByKey = new Map<string, RssItem>(rssEntries);
  const ranked = repos
    .map((repo) => {
      const owner = String(repo.owner || '').trim();
      const repoName = String(repo.repo || repo.name || '').trim();
      const key = owner && repoName ? `${owner}/${repoName}` : '';
      const summary = summaries[key];
      const rss = rssByKey.get(key);
      const publishedAt = isoDate(rss?.pubDate) || isoDate(summary?.generatedAt);
      return { repo, owner, repoName, key, summary, rss, publishedAt };
    })
    .filter((item) => item.owner && item.repoName && item.key)
    .filter((item) => withinSinceDays(item.publishedAt, sinceDays))
    .sort((a, b) => {
      const dateDiff = new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime();
      if (dateDiff) return dateDiff;
      return Number(b.repo.stars || 0) - Number(a.repo.stars || 0);
    })
    .slice(0, maxCards);

  return ranked.map(({ repo, owner, repoName, key, summary, rss, publishedAt }) => {
    const sourceUrl = rss?.link || projectUrl(owner, repoName);
    const canonicalUrl = typeof repo.url === 'string' ? repo.url : undefined;
    return {
      externalId: key,
      title: String(repo.name || repo.repo || rss?.title || key),
      body: cardBody(repo, summary, rss),
      praxisDescription: createPraxisDescription(repo, summary),
      author: owner,
      category: String(repo.category || rss?.category || 'Hermes Atlas'),
      sourceUrl,
      canonicalUrl,
      urls: [canonicalUrl, sourceUrl].filter(Boolean) as string[],
      metrics: {
        stars: Number(repo.stars || 0),
        official: Boolean(repo.official),
        audit: summary?.audit || 'unknown',
      },
      publishedAt,
      raw: { repo, summary, rss },
    };
  });
}

async function main() {
  const maxCards = numberArg('--max-cards', 50, 200);
  const sinceDays = numberArg('--since-days', 7, 3650);
  const endpoint = argValue('--endpoint', 'http://localhost:3000/api/hermes/ingest')!;
  const token = argValue('--token', process.env.HERMES_INGEST_TOKEN);
  const dryRun = hasFlag('--dry-run');

  const [rssXml, repos, summaries, llmsFull] = await Promise.all([
    fetchText(`${ATLAS_BASE}/rss.xml`),
    fetchJson<RepoRecord[]>(`${ATLAS_BASE}/data/repos.json`),
    fetchJson<Record<string, SummaryRecord>>(`${ATLAS_BASE}/data/summaries.json`),
    fetchText(`${ATLAS_BASE}/llms-full.txt`),
  ]);

  const rssItems = parseRssItems(rssXml);
  const cards = createCards(repos, summaries, rssItems, maxCards, sinceDays);
  const payload = {
    mode: 'external',
    source: 'hermes-atlas',
    sourceUrl: ATLAS_BASE,
    cards,
    options: { dedupe: true, writeMarkdown: true, judge: false, preserveLatest: true, sinceDays },
    meta: { rssItems: rssItems.length, repos: repos.length, summaries: Object.keys(summaries).length, llmsFullBytes: llmsFull.length },
  };

  if (dryRun) {
    console.log(JSON.stringify({ ok: true, dryRun: true, endpoint, cards: cards.length, sample: cards.slice(0, 3), meta: payload.meta }, null, 2));
    return;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let json: unknown = text;
  try { json = JSON.parse(text); } catch {}
  if (!response.ok) {
    console.error(JSON.stringify({ ok: false, status: response.status, response: json }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(json, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});

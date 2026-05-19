export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RiskBadge, ScoreBadge, StatusPill } from '@/components/Pills';
import { PraxisEditor } from '@/components/PraxisEditor';
import { readableCategory } from '@/lib/atlas';
import { hasEditToken, isAuthenticatedCookie } from '@/lib/auth';
import { getDashboardData, getNoteBySlug } from '@/lib/markdown';
import { listLearningReports } from '@/lib/learning';

export function generateStaticParams() {
  return getDashboardData().notes.map((note) => ({ slug: note.slug }));
}

export default async function NotePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const note = getNoteBySlug(slug);
  if (!note) notFound();
  const uniqueUrls = Array.from(new Set(note.sourceUrls.filter(Boolean)));
  const headings = note.headings.slice(0, 10);
  const signal = noteSection(note.content, 'Signal') || note.excerpt;
  const why = noteSection(note.content, 'Why it matters') || `${readableCategory(note.category)} signal; verify source before acting.`;
  const nextAction = note.actionItems[0]?.text || noteSection(note.content, 'Next move') || 'No concrete action extracted yet.';
  const canEditPraxis = note.type === 'experiment' && await isAuthenticatedCookie();
  const learningReports = note.type === 'experiment' ? listLearningReports(100).filter((report) => report.praxisSlug === note.slug || report.praxisTitle === note.title) : [];
  return (
    <div className="atlasPage noteAtlasPage">
      <section className="atlasSubHero noteHeader">
        <Link href="/">← map</Link>
        <p>{note.type} · {note.path}</p>
        <h1>{note.title}</h1>
        <span>{note.excerpt || 'No summary extracted yet.'}</span>
        <div className="metaRow"><StatusPill status={note.status} /><RiskBadge risk={note.risk} /><ScoreBadge label="relevance" value={note.strategicRelevance} /><ScoreBadge label="action" value={note.actionability} /></div>
      </section>

      <section className="noteDigestGrid" aria-label="Mapped source digest">
        <article className="panel digestPanel">
          <span>summary map</span>
          <h2>What this note means</h2>
          <p>{note.excerpt || 'Hermes should rewrite this source into a concise decision card on next ingestion.'}</p>
        </article>
        <article className="panel digestPanel"><span>source urls</span><strong>{uniqueUrls.length}</strong><p>Original posts, repos, and dependency links preserved for verification.</p></article>
        <article className="panel digestPanel"><span>repo leads</span><strong>{note.repoMentions.length}</strong><p>Detected repositories requiring source check or adoption review.</p></article>
        <article className="panel digestPanel"><span>actions</span><strong>{note.actionItems.length}</strong><p>Concrete next steps extracted from the raw long text.</p></article>
      </section>

      <section className="reportTranslation" aria-label="Report translation">
        <article>
          <span>01 · what happened</span>
          <p>{compactText(signal, 300)}</p>
        </article>
        <article>
          <span>02 · why it matters</span>
          <p>{compactText(why, 260)}</p>
        </article>
        <article>
          <span>03 · decision</span>
          <p>{compactText(nextAction, 220)}</p>
        </article>
      </section>

      <section className="grid noteGrid atlasNoteGrid">
        <article className="panel markdown atlasMarkdown" dangerouslySetInnerHTML={{ __html: note.html }} />
        <aside className="panel sidePanel atlasSidePanel">
          <h2>Detail path</h2>
          <ol className="inlineSteps">
            {(headings.length ? headings : ['Summary', 'Sources', 'Actions']).map((heading) => <li key={heading}>{heading}</li>)}
          </ol>
          <h2>Original sources</h2>
          <div className="linkStack">{uniqueUrls.slice(0, 12).map((url, index) => <a href={url} key={`${url}-${index}`} target="_blank" rel="noreferrer">{compactUrl(url)}</a>)}</div>
          <h2>Detected repo leads</h2>
          <div className="miniList">{note.repoMentions.slice(0, 12).map((repo) => <span key={`${repo.name}-${repo.sourceNoteSlug}`}>{repo.name}</span>)}</div>
          <h2>Actions</h2>
          <div className="miniList">{note.actionItems.slice(0, 12).map((action) => <span key={action.id}>{action.text}</span>)}</div>
        </aside>
      </section>

      {note.type === 'experiment' ? (
        <section className="panel acpEventPanel">
          <div className="sectionHead"><h2>Agent learning reports</h2><span>{learningReports.length} reports</span></div>
          <div className="miniList learningReportList">
            {learningReports.length ? learningReports.map((report) => <span key={report.id}>{report.createdAt.slice(0, 10)} · {report.agentName} · {report.status} · {compactText(report.learned, 160)}</span>) : <span>No agent report yet.</span>}
          </div>
        </section>
      ) : null}

      {note.type === 'experiment' ? (
        canEditPraxis
          ? <PraxisEditor slug={note.slug} initialMarkdown={note.content} initialStage={note.stage} initialStatus={note.status} />
          : <section className="panel praxisEditorPanel"><div className="sectionHead"><h2>Praxis editor</h2><span>locked</span></div><p className="mutedCopy">Login to edit markdown or move this praxis through evidence.</p>{hasEditToken() ? <div className="featuredActions"><Link href={`/login?next=/notes/${note.slug}`}>Login to edit praxis</Link></div> : <p className="mutedCopy">Set <code>AGENT_PRAXIS_TOKEN</code> or <code>HERMES_INGEST_TOKEN</code> to enable human and agent edits.</p>}</section>
      ) : null}
    </div>
  );
}

function compactUrl(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname === '/' ? '' : parsed.pathname}`.slice(0, 68);
  } catch {
    return url.slice(0, 68);
  }
}

function noteSection(content: string, heading: string) {
  const pattern = new RegExp(`^## ${heading}\\s*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'im');
  return content.match(pattern)?.[1]?.trim() || '';
}

function compactText(value: string, maxLength: number) {
  const cleaned = value.replace(/^[-*]\s+/gm, '').replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1).replace(/\s+\S*$/, '')}…`;
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAgentProfile } from '@/lib/learning';

export const dynamic = 'force-dynamic';

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = getAgentProfile(id);
  if (!agent) notFound();
  return (
    <div className="atlasPage">
      <section className="atlasSubHero">
        <p>{agent.adapter} adapter · {agent.status}</p>
        <h1>{agent.name}</h1>
        <span>{agent.purpose}</span>
        <div className="featuredActions"><Link href="/dashboard#agent-access">ACP access</Link><Link href="/dashboard#learning-reports">Reports</Link></div>
      </section>
      <section className="noteDigestGrid">
        <article className="panel digestPanel"><span>level</span><strong>{agent.learningLevel}</strong><p>Based on submitted reports and Praxis outcomes.</p></article>
        <article className="panel digestPanel"><span>active praxies</span><strong>{agent.activePraxies}</strong><p>Current learning queue or assigned Praxis loop.</p></article>
        <article className="panel digestPanel"><span>completed</span><strong>{agent.completedPraxies}</strong><p>Adopted or killed with evidence.</p></article>
        <article className="panel digestPanel"><span>failed</span><strong>{agent.failedPraxies}</strong><p>Blocked or killed reports.</p></article>
      </section>
      <section className="grid noteGrid atlasNoteGrid">
        <article className="panel"><h2>Learning notes</h2><div className="miniList">{agent.learningNotes.length ? agent.learningNotes.map((note) => <span key={note}>{note}</span>) : <span>No reports yet.</span>}</div><h2>Capabilities</h2><div className="overviewMeta">{agent.capabilityTags.map((tag) => <span key={tag}>{tag}</span>)}</div></article>
        <aside className="panel"><h2>Progress timeline</h2><ol className="inlineSteps">{agent.progressTimeline.length ? agent.progressTimeline.map((item) => <li key={`${item.date}-${item.label}`}>{item.date.slice(0, 10)} · {item.status} · {item.label}</li>) : <li>Waiting for first learning report.</li>}</ol></aside>
      </section>
    </div>
  );
}

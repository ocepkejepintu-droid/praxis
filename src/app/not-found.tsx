import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="pageHeader notFoundPanel">
      <p className="eyebrow">Not found</p>
      <h1>No route here.</h1>
      <p>Return to the map or inspect praxies.</p>
      <div className="heroActions">
        <Link href="/">Open CEO desk</Link>
        <Link href="/praxies">Open praxies</Link>
      </div>
    </section>
  );
}

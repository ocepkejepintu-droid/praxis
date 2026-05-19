import Link from 'next/link';

type EvidenceLinksProps = {
  noteHref: string;
  sourcePath: string;
  sourceUrls: string[];
};

function compactUrl(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname === '/' ? '' : parsed.pathname}`.slice(0, 48);
  } catch {
    return url.slice(0, 48);
  }
}

export function EvidenceLinks({ noteHref, sourcePath, sourceUrls }: EvidenceLinksProps) {
  const uniqueUrls = Array.from(new Set(sourceUrls.filter(Boolean)));
  return (
    <div className="evidenceLinks" aria-label="Evidence and source links">
      <Link href={noteHref}>Detail</Link>
      <span className="sourcePath" title={sourcePath}>{sourcePath}</span>
      {uniqueUrls.length ? (
        <details className="sourceUrls">
          <summary>{uniqueUrls.length} source{uniqueUrls.length === 1 ? '' : 's'}</summary>
          <div>
            {uniqueUrls.map((url, index) => (
              <a href={url} key={`${url}-${index}`} target="_blank" rel="noreferrer">Original: {compactUrl(url)}</a>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

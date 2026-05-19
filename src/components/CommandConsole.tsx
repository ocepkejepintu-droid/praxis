import type { CommandPrompt } from '@/lib/os';

export function CommandConsole({ commands }: { commands: CommandPrompt[] }) {
  return (
    <section className="commandDeck" aria-label="Goal command prompts">
      <div className="commandIntro">
        <p className="eyebrow">Commands</p>
        <h2>Run one useful loop.</h2>
      </div>
      <div className="commandGrid">
        {commands.map((item) => (
          <article className="commandCard" key={item.label}>
            <div className="commandMeta"><span>{item.label}</span><em>{item.useWhen}</em></div>
            <details className="commandDetails">
              <summary>View prompt</summary>
              <pre>{item.command}</pre>
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}

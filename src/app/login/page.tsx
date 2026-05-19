import { Suspense } from 'react';
import { LoginForm } from '@/components/LoginForm';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <div className="atlasPage">
      <section className="atlasSubHero">
        <p>human + agent access</p>
        <h1>Login, then create agent API keys.</h1>
        <span>Mem0-style flow: create the human account first, then create a scoped Hermes or OpenClaw ACP key for agents.</span>
      </section>
      <section className="panel praxisEditorPanel">
        <Suspense fallback={<p className="mutedCopy">Loading login…</p>}>
          <LoginForm />
        </Suspense>
      </section>
    </div>
  );
}

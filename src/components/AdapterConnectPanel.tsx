import type { PublicAcpApiKey, AcpAdapter } from '@/lib/acp';
import { acpAdapterEndpoints } from '@/lib/hermes-acp';
import { hermesRuntimeStatus } from '../../packages/runtime/contracts/hermes-contract.ts';
import { openClawRuntimeStatus } from '../../packages/runtime/contracts/omx-contract.ts';

type AdapterSpec = {
  adapter: AcpAdapter;
  label: string;
  role: string;
  purpose: string;
  readScope: string;
  writeScope: string;
};

const specs: AdapterSpec[] = [
  {
    adapter: 'hermes',
    label: 'Hermes',
    role: 'Signal reader + report writer',
    purpose: 'Reads Praxis candidates, X signal briefs, Atlas repo evidence, operator queues, and writes sourced learning reports.',
    readScope: 'read_signals · read_reports · read_praxies',
    writeScope: 'create_praxis · submit_learning_report · append_acp_event',
  },
  {
    adapter: 'openclaw',
    label: 'OpenClaw',
    role: 'Praxis learner + experiment reporter',
    purpose: 'Reads Praxis material, selects useful missions, marks safe experiment progress, and reports what worked or failed.',
    readScope: 'read_signals · read_reports · read_praxies',
    writeScope: 'update_praxis_status · submit_learning_report · run_experiment_marker',
  },
];

export function AdapterConnectPanel({ keys, baseUrl = '' }: { keys: PublicAcpApiKey[]; baseUrl?: string }) {
  const runtime = {
    hermes: hermesRuntimeStatus(),
    openclaw: openClawRuntimeStatus(),
  } as const;

  return (
    <section className="dcDashboardPanel dcAdapterConnectPanel" id="adapter-connect">
      <div className="dcSectionIntro">
        <p className="dcEyebrow">Adapter connection</p>
        <h2>Hermes and OpenClaw can read Praxis through ACP.</h2>
        <p>Create one scoped key per adapter, pass it as <code>Authorization: Bearer &lt;ACP_KEY&gt;</code>, then agents read context and report learning back. Real execution remains disabled unless RuntimeRunner is explicitly configured.</p>
      </div>
      <div className="dcAdapterConnectGrid">
        {specs.map((spec) => {
          const adapterKeys = keys.filter((key) => key.adapter === spec.adapter && key.status === 'active');
          const endpoints = acpAdapterEndpoints(spec.adapter, baseUrl);
          const status = runtime[spec.adapter];
          return (
            <article className="dcAdapterConnectCard" key={spec.adapter}>
              <header>
                <span>{adapterKeys.length ? 'connected' : 'needs key'}</span>
                <strong>{spec.label}</strong>
                <em>{spec.role}</em>
              </header>
              <p>{spec.purpose}</p>
              <dl>
                <div><dt>Read</dt><dd>{spec.readScope}</dd></div>
                <div><dt>Write</dt><dd>{spec.writeScope}</dd></div>
                <div><dt>Runtime</dt><dd>{status.label}</dd></div>
              </dl>
              <div className="dcAdapterEndpointBox">
                <span>Read Praxis context</span>
                <code>{`GET ${endpoints.learningContext}`}</code>
                <span>Report learning</span>
                <code>{`POST ${endpoints.learningReport}`}</code>
                <span>Connect check</span>
                <code>{`GET ${endpoints.connect}`}</code>
              </div>
              <div className="dcAdapterStatusLine">
                <b>{adapterKeys.length ? `${adapterKeys.length} active key${adapterKeys.length === 1 ? '' : 's'}` : 'No active key yet'}</b>
                <a href="#create-key">{adapterKeys.length ? 'Manage keys' : `Create ${spec.label} key`}</a>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

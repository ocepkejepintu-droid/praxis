import { NextResponse } from 'next/server';
import { appendAcpEvent, createPraxisNote, getAgentNote, getAgentReport, rankPraxisCandidates, searchSignals, type AcpEventType } from '@/lib/agent';
import { canRequestAuth, getRequestAuth, hasRequestPermission } from '@/lib/auth';
import { readIngestionRun, readIngestionRunHistory, readLatestIngestionRun } from '@/lib/ingestion-status';
import { updatePraxis } from '@/lib/praxis';
import { submitLearningReport } from '@/lib/learning';
import { getOperatorDispatch, getResearchHealth, listOperatorClaims, readHandoffQueue, type OperatorLane } from '@/lib/operator';
import { getHermesAtlasPraxisMap } from '@/lib/hermes-atlas';
import { visibleAgentProfilesForAuth, visibleLearningReportsForAuth } from '@/lib/access-scope';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type McpToolCall = {
  tool?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: { name?: string; arguments?: Record<string, unknown>; uri?: string };
};

const resources = [
  { uri: 'agent-praxis://runs/latest', name: 'Latest ingestion run', mimeType: 'application/json' },
  { uri: 'agent-praxis://runs/{runId}', name: 'Ingestion run by id', mimeType: 'application/json' },
  { uri: 'agent-praxis://dates/{yyyy-mm-dd}', name: 'Ingestion runs by date', mimeType: 'application/json' },
  { uri: 'agent-praxis://praxies/candidates', name: 'Ranked praxis candidates', mimeType: 'application/json' },
  { uri: 'agent-praxis://praxies/hermes-atlas', name: 'Hermes Atlas categorized Praxis map', mimeType: 'application/json' },
  { uri: 'agent-praxis://notes/{slug}', name: 'Markdown note detail', mimeType: 'application/json' },
  { uri: 'agent-praxis://agents', name: 'ACP agent profiles', mimeType: 'application/json' },
  { uri: 'agent-praxis://agents/{id}', name: 'ACP agent profile detail', mimeType: 'application/json' },
  { uri: 'agent-praxis://learning-reports', name: 'Agent learning reports', mimeType: 'application/json' },
  { uri: 'agent-praxis://operator/dispatch', name: 'Research operator dispatch', mimeType: 'application/json' },
  { uri: 'agent-praxis://operator/health', name: 'Research operator health', mimeType: 'application/json' },
  { uri: 'agent-praxis://operator/queues/{lane}', name: 'Research operator lane queue', mimeType: 'application/json' },
  { uri: 'agent-praxis://claims', name: 'Traceable research claims', mimeType: 'application/json' },
];

const tools: Array<{ name: string; auth: boolean; description: string; inputSchema?: Record<string, unknown> }> = [
  { name: 'get_report_brief', auth: false, description: 'Return current Agent Praxis report brief for agents.', inputSchema: { type: 'object', properties: {} } },
  { name: 'search_real_world_use_cases', auth: false, description: 'Search source-linked X/community signals by query, category, runId, and limit.', inputSchema: { type: 'object', properties: { q: { type: 'string' }, category: { type: 'string' }, runId: { type: 'string' }, limit: { type: 'number' } } } },
  { name: 'get_signal_detail', auth: false, description: 'Read one note or praxis by slug with markdown, headings, links, and action path.', inputSchema: { type: 'object', required: ['slug'], properties: { slug: { type: 'string' } } } },
  { name: 'rank_praxis_candidates', auth: false, description: 'Rank praxies most useful for an agent to try next.', inputSchema: { type: 'object', properties: { focus: { type: 'string' }, limit: { type: 'number' } } } },
  { name: 'list_ingestion_runs', auth: false, description: 'List latest/date-scoped ingestion runs so agents know what is fresh.', inputSchema: { type: 'object', properties: { date: { type: 'string' } } } },
  { name: 'get_ingestion_run', auth: false, description: 'Read one ingestion run manifest by runId or latest.', inputSchema: { type: 'object', properties: { runId: { type: 'string' } } } },
  { name: 'create_praxis', auth: true, description: 'Create a token-gated praxis markdown note from a chosen real-world signal.', inputSchema: { type: 'object', required: ['title', 'hypothesis', 'firstTest'], properties: { title: { type: 'string' }, hypothesis: { type: 'string' }, firstTest: { type: 'string' }, successSignal: { type: 'string' }, killCriteria: { type: 'string' }, sourceUrls: { type: 'array', items: { type: 'string' } }, owner: { type: 'string' } } } },
  { name: 'record_praxis_result', auth: true, description: 'Record experiment result by updating praxis markdown/status/stage and appending ACP event.', inputSchema: { type: 'object', required: ['slug', 'result'], properties: { slug: { type: 'string' }, result: { type: 'string' }, stage: { type: 'string' }, status: { type: 'string' }, actor: { type: 'string' }, sourceUrls: { type: 'array', items: { type: 'string' } } } } },
  { name: 'append_acp_event', auth: true, description: 'Append an authenticated ACP event to the agent coordination log.', inputSchema: { type: 'object', properties: { type: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, payload: { type: 'object' }, sourceSlugs: { type: 'array', items: { type: 'string' } }, sourceUrls: { type: 'array', items: { type: 'string' } } } } },
  { name: 'list_agent_profiles', auth: true, description: 'List visible ACP agents and their learning progress.', inputSchema: { type: 'object', properties: { id: { type: 'string' } } } },
  { name: 'list_learning_reports', auth: true, description: 'List visible agent learning reports grouped from markdown memory.', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
  { name: 'submit_learning_report', auth: true, description: 'Submit what an agent learned in praxis and store it as markdown plus ACP event.', inputSchema: { type: 'object', required: ['agentName', 'learned'], properties: { agentId: { type: 'string' }, agentName: { type: 'string' }, adapter: { type: 'string' }, praxisSlug: { type: 'string' }, praxisTitle: { type: 'string' }, runId: { type: 'string' }, category: { type: 'string' }, status: { type: 'string' }, summary: { type: 'string' }, learned: { type: 'string' }, tried: { type: 'string' }, worked: { type: 'string' }, failed: { type: 'string' }, nextAction: { type: 'string' }, evidenceUrls: { type: 'array', items: { type: 'string' } } } } },
  { name: 'get_operator_dispatch', auth: false, description: 'Return machine-readable Research Operator dispatch lanes.', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_research_health', auth: false, description: 'Return latest Research Operator health and evidence gap counters.', inputSchema: { type: 'object', properties: {} } },
  { name: 'list_handoff_queue', auth: false, description: 'Read one operator queue: buildroom, verify, content, or watch.', inputSchema: { type: 'object', required: ['lane'], properties: { lane: { type: 'string' } } } },
  { name: 'list_claims', auth: false, description: 'List traceable research claims.', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
];

function manifest() {
  return {
    ok: true,
    protocol: 'agent-praxis-mcp-v1',
    name: 'Agent Praxis MCP/ACP bridge',
    description: 'Agent-readable layer over X-derived reports, praxis candidates, markdown notes, ingestion runs, and token-gated ACP writes.',
    resources,
    tools,
    auth: {
      read: 'public for signals, runs, praxis candidates, and operator summaries; ACP agents and learning reports require read_reports permission',
      write: 'Authorization: Bearer <AGENT_PRAXIS_TOKEN, HERMES_INGEST_TOKEN, or scoped ACP API key>',
      acpConnect: '/api/acp/connect',
      hermesLearningContext: '/api/acp/hermes/learning-context',
      hermesLearningReport: '/api/acp/hermes/learning-report',
      userSessions: '/api/acp/sessions',
    },
  };
}

function stringArg(args: Record<string, unknown>, key: string) {
  const value = args[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberArg(args: Record<string, unknown>, key: string) {
  const value = Number(args[key]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function stringArrayArg(args: Record<string, unknown>, key: string) {
  const value = args[key];
  if (!Array.isArray(value)) return undefined;
  return value.map(String).filter(Boolean);
}


function normalizeAcpType(value?: string): AcpEventType {
  const allowed: AcpEventType[] = ['x_ingested', 'signals_ranked', 'praxis_proposed', 'praxis_selected', 'praxis_created', 'praxis_status_updated', 'praxis_result', 'praxis_killed', 'praxis_adopted'];
  return allowed.includes(value as AcpEventType) ? value as AcpEventType : 'praxis_selected';
}

function runsByDate(date?: string) {
  const history = readIngestionRunHistory(100);
  return date ? history.filter((run) => run.startedAt.startsWith(date)) : history;
}


function jsonRpcResult(id: McpToolCall['id'], result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id: id ?? null, result });
}

function jsonRpcError(id: McpToolCall['id'], code: number, message: string) {
  return NextResponse.json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } }, { status: code === -32601 ? 404 : 400 });
}

function asMcpContent(value: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

function readResource(uri: string) {
  if (uri === 'agent-praxis://runs/latest') return { run: readLatestIngestionRun() };
  if (uri === 'agent-praxis://praxies/candidates') return { praxies: rankPraxisCandidates({}) };
  if (uri === 'agent-praxis://praxies/hermes-atlas') return { map: getHermesAtlasPraxisMap() };
  if (uri === 'agent-praxis://agents') return { privateResource: 'agents' };
  if (uri === 'agent-praxis://learning-reports') return { privateResource: 'learning-reports' };
  if (uri === 'agent-praxis://operator/dispatch') return { dispatch: getOperatorDispatch() };
  if (uri === 'agent-praxis://operator/health') return { health: getResearchHealth() };
  if (uri === 'agent-praxis://claims') return { claims: listOperatorClaims() };
  const run = uri.match(/^agent-praxis:\/\/runs\/(.+)$/)?.[1];
  if (run) return { run: readIngestionRun(run) };
  const date = uri.match(/^agent-praxis:\/\/dates\/(\d{4}-\d{2}-\d{2})$/)?.[1];
  if (date) return { runs: runsByDate(date) };
  const slug = uri.match(/^agent-praxis:\/\/notes\/(.+)$/)?.[1];
  if (slug) return { note: getAgentNote(decodeURIComponent(slug)) };
  const agentId = uri.match(/^agent-praxis:\/\/agents\/(.+)$/)?.[1];
  if (agentId) return { privateResource: 'agent', agentId: decodeURIComponent(agentId) };
  const lane = uri.match(/^agent-praxis:\/\/operator\/queues\/(buildroom|verify|content|watch)$/)?.[1] as OperatorLane | undefined;
  if (lane) return { queue: readHandoffQueue(lane) };
  return null;
}

async function handleJsonRpc(body: McpToolCall, request: Request) {
  switch (body.method) {
    case 'initialize':
      return jsonRpcResult(body.id, { protocolVersion: '2025-06-18', capabilities: { tools: {}, resources: {} }, serverInfo: { name: 'agent-praxis', version: '0.1.0' } });
    case 'tools/list':
      return jsonRpcResult(body.id, { tools: tools.map(({ name, auth, description, inputSchema }) => ({ name, auth, description, inputSchema: inputSchema || { type: 'object', properties: {} } })) });
    case 'resources/list':
      return jsonRpcResult(body.id, { resources });
    case 'resources/read': {
      const uri = body.params?.uri;
      if (!uri) return jsonRpcError(body.id, -32602, 'params.uri required');
      let value: Record<string, unknown> | null = readResource(uri);
      if (!value) return jsonRpcError(body.id, -32002, `Unknown resource: ${uri}`);
      if ('privateResource' in value) {
        const auth = getRequestAuth(request);
        if (!canRequestAuth(auth, 'read_reports')) return jsonRpcError(body.id, -32001, 'Missing read_reports permission.');
        if (value.privateResource === 'agents') value = { agents: visibleAgentProfilesForAuth(auth) };
        if (value.privateResource === 'learning-reports') value = { reports: visibleLearningReportsForAuth(auth) };
        if (value.privateResource === 'agent') {
          const agentId = String(value.agentId || '');
          value = { agent: visibleAgentProfilesForAuth(auth).find((profile) => profile.id === agentId || profile.name.toLowerCase() === agentId.toLowerCase()) || null };
        }
      }
      return jsonRpcResult(body.id, { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(value, null, 2) }] });
    }
    case 'tools/call': {
      const name = body.params?.name;
      if (!name) return jsonRpcError(body.id, -32602, 'params.name required');
      const result = await dispatch(name, body.params?.arguments || {}, request);
      if ('ok' in result && result.ok === false) return jsonRpcError(body.id, result.status === 401 ? -32001 : -32602, result.message || 'Tool failed');
      return jsonRpcResult(body.id, asMcpContent(result));
    }
    case 'notifications/initialized':
      return new NextResponse(null, { status: 202 });
    default:
      return jsonRpcError(body.id, -32601, `Unknown method: ${body.method}`);
  }
}

async function dispatch(tool: string, args: Record<string, unknown>, request: Request) {
  switch (tool) {
    case 'get_report_brief':
      return getAgentReport();
    case 'search_real_world_use_cases':
      return { signals: searchSignals({ q: stringArg(args, 'q'), category: stringArg(args, 'category'), runId: stringArg(args, 'runId'), limit: numberArg(args, 'limit') }) };
    case 'get_signal_detail': {
      const slug = stringArg(args, 'slug');
      if (!slug) return { ok: false, message: 'slug required.' };
      return { note: getAgentNote(slug) };
    }
    case 'rank_praxis_candidates':
      return { praxies: rankPraxisCandidates({ focus: stringArg(args, 'focus'), limit: numberArg(args, 'limit') }) };
    case 'list_ingestion_runs':
      return { latest: readLatestIngestionRun(), runs: runsByDate(stringArg(args, 'date')) };
    case 'get_ingestion_run': {
      const runId = stringArg(args, 'runId');
      return { run: runId && runId !== 'latest' ? readIngestionRun(runId) : readLatestIngestionRun() };
    }
    case 'create_praxis': {
      if (!hasRequestPermission(request, 'create_praxis')) return { ok: false, status: 401, message: 'Missing create_praxis permission.' };
      const title = stringArg(args, 'title');
      const hypothesis = stringArg(args, 'hypothesis');
      const firstTest = stringArg(args, 'firstTest');
      if (!title || !hypothesis || !firstTest) return { ok: false, status: 400, message: 'title, hypothesis, and firstTest required.' };
      return { praxis: createPraxisNote({ title, hypothesis, firstTest, successSignal: stringArg(args, 'successSignal'), killCriteria: stringArg(args, 'killCriteria'), sourceUrls: stringArrayArg(args, 'sourceUrls'), owner: stringArg(args, 'owner') }) };
    }
    case 'record_praxis_result': {
      if (!hasRequestPermission(request, 'submit_learning_report')) return { ok: false, status: 401, message: 'Missing submit_learning_report permission.' };
      const slug = stringArg(args, 'slug');
      if (!slug) return { ok: false, status: 400, message: 'slug required.' };
      const result = stringArg(args, 'result') || 'Result recorded by agent.';
      const markdownAppend = `\n\n## Agent result - ${new Date().toISOString()}\n${result}\n`;
      const note = getAgentNote(slug);
      const praxis = updatePraxis(slug, {
        stage: stringArg(args, 'stage'),
        status: stringArg(args, 'status'),
        markdown: `${note?.markdown || ''}${markdownAppend}`.trim(),
        actor: stringArg(args, 'actor') || 'agent',
      });
      if (!praxis) return { ok: false, status: 404, message: 'Praxis not found.' };
      const event = appendAcpEvent({ type: args.stage === 'adopted' ? 'praxis_adopted' : args.stage === 'killed' ? 'praxis_killed' : 'praxis_result', from: stringArg(args, 'actor') || 'agent', to: 'radar', payload: { slug, result, stage: args.stage, status: args.status }, sourceSlugs: [slug], sourceUrls: stringArrayArg(args, 'sourceUrls') || [] });
      return { praxis: { slug: praxis.slug, title: praxis.title, stage: praxis.stage, status: praxis.status }, event };
    }
    case 'append_acp_event': {
      if (!hasRequestPermission(request, 'append_acp_event')) return { ok: false, status: 401, message: 'Missing append_acp_event permission.' };
      return { event: appendAcpEvent({ type: normalizeAcpType(stringArg(args, 'type')), from: stringArg(args, 'from') || 'agent', to: stringArg(args, 'to') || 'radar', payload: args.payload || {}, sourceSlugs: stringArrayArg(args, 'sourceSlugs') || [], sourceUrls: stringArrayArg(args, 'sourceUrls') || [] }) };
    }
    case 'list_agent_profiles': {
      if (!hasRequestPermission(request, 'read_reports')) return { ok: false, status: 401, message: 'Missing read_reports permission.' };
      const id = stringArg(args, 'id');
      const agents = visibleAgentProfilesForAuth(getRequestAuth(request));
      return id ? { agent: agents.find((agent) => agent.id === id || agent.name.toLowerCase() === id.toLowerCase()) || null } : { agents };
    }
    case 'list_learning_reports':
      if (!hasRequestPermission(request, 'read_reports')) return { ok: false, status: 401, message: 'Missing read_reports permission.' };
      return { reports: visibleLearningReportsForAuth(getRequestAuth(request), numberArg(args, 'limit') || 100) };
    case 'submit_learning_report': {
      if (!hasRequestPermission(request, 'submit_learning_report')) return { ok: false, status: 401, message: 'Missing submit_learning_report permission.' };
      if (!stringArg(args, 'agentName') || !stringArg(args, 'learned')) return { ok: false, status: 400, message: 'agentName and learned required.' };
      return { report: submitLearningReport({
        agentId: stringArg(args, 'agentId'),
        agentName: stringArg(args, 'agentName'),
        adapter: stringArg(args, 'adapter') === 'openclaw' ? 'openclaw' : 'hermes',
        praxisSlug: stringArg(args, 'praxisSlug'),
        praxisTitle: stringArg(args, 'praxisTitle'),
        runId: stringArg(args, 'runId'),
        category: stringArg(args, 'category'),
        status: ['learning', 'tried', 'adopted', 'killed', 'blocked'].includes(String(args.status)) ? args.status as 'learning' | 'tried' | 'adopted' | 'killed' | 'blocked' : 'learning',
        summary: stringArg(args, 'summary'),
        learned: stringArg(args, 'learned'),
        tried: stringArg(args, 'tried'),
        worked: stringArg(args, 'worked'),
        failed: stringArg(args, 'failed'),
        nextAction: stringArg(args, 'nextAction'),
        evidenceUrls: stringArrayArg(args, 'evidenceUrls') || [],
      }) };
    }
    case 'get_operator_dispatch':
      return { dispatch: getOperatorDispatch() };
    case 'get_research_health':
      return { health: getResearchHealth() };
    case 'list_handoff_queue': {
      const lane = stringArg(args, 'lane');
      if (lane !== 'buildroom' && lane !== 'verify' && lane !== 'content' && lane !== 'watch') return { ok: false, status: 400, message: 'lane must be buildroom, verify, content, or watch.' };
      return { queue: readHandoffQueue(lane) };
    }
    case 'list_claims':
      return { claims: listOperatorClaims(numberArg(args, 'limit') || 100) };
    default:
      return { ok: false, status: 404, message: `Unknown MCP tool: ${tool}` };
  }
}

export async function GET() {
  return NextResponse.json(manifest());
}

export async function POST(request: Request) {
  let body: McpToolCall = {};
  try { body = await request.json() as McpToolCall; } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON body.', manifest: manifest() }, { status: 400 });
  }
  if (body.method) return handleJsonRpc(body, request);
  const tool = body.tool || body.name;
  if (!tool) return NextResponse.json({ ok: false, message: 'tool required.', manifest: manifest() }, { status: 400 });
  const result = await dispatch(tool, body.arguments || {}, request);
  if ('ok' in result && result.ok === false) return NextResponse.json(result, { status: typeof result.status === 'number' ? result.status : 400 });
  return NextResponse.json({ ok: true, tool, result });
}

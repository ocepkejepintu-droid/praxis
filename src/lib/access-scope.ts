import { listAcpApiKeys, type PublicAcpApiKey } from './acp';
import { getAgentProfiles, listLearningReports, type AgentProfile, type LearningReport } from './learning';
import type { RequestAuth } from './auth';

function hasAdmin(auth: RequestAuth | null) {
  if (!auth) return false;
  if (auth.kind === 'master') return true;
  if (auth.kind === 'user') return auth.user.role === 'admin' || auth.user.permissions.includes('admin_settings');
  return auth.key.permissions.includes('admin_settings');
}

export function visibleAcpKeysForAuth(auth: RequestAuth | null): PublicAcpApiKey[] {
  if (!auth) return [];
  const keys = listAcpApiKeys();
  if (auth.kind === 'master') return keys;
  if (auth.kind === 'user') return hasAdmin(auth) ? keys : keys.filter((key) => key.ownerUserId === auth.user.id || key.owner === auth.user.email);
  if (hasAdmin(auth)) return keys;
  return keys.filter((key) => key.id === auth.key.id);
}

export function visibleAgentProfilesForAuth(auth: RequestAuth | null): AgentProfile[] {
  const keyIds = new Set(visibleAcpKeysForAuth(auth).map((key) => key.id));
  if (hasAdmin(auth)) return getAgentProfiles();
  return getAgentProfiles().filter((profile) => keyIds.has(profile.id));
}

export function visibleLearningReportsForAuth(auth: RequestAuth | null, limit = 100): LearningReport[] {
  const reports = listLearningReports(limit);
  if (hasAdmin(auth)) return reports;
  const keys = visibleAcpKeysForAuth(auth);
  const keyIds = new Set(keys.map((key) => key.id));
  const labels = new Set(keys.flatMap((key) => [key.name.toLowerCase(), key.owner.toLowerCase()]));
  return reports.filter((report) => (report.agentId && keyIds.has(report.agentId)) || labels.has(report.agentName.toLowerCase()));
}

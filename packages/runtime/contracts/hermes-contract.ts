import type { ReadOnlyScanRequest, ReadOnlyScanResult, RuntimeBlocker, RuntimeProviderStatus, TenantWorkspace } from './types.ts';
import { runtimeSafetyContract } from './types.ts';

export const hermesRuntimeContract = {
  provider: 'hermes' as const,
  displayName: 'Hermes',
  env: {
    mode: 'HERMES_RUNTIME_MODE',
    readOnlyWorkspaceDir: 'HERMES_READONLY_WORKSPACE_DIR',
    readOnlyWorkflowDir: 'HERMES_READONLY_WORKFLOW_DIR',
    readOnlyLogDir: 'HERMES_READONLY_LOG_DIR',
    readOnlyStateDir: 'HERMES_READONLY_STATE_DIR',
  },
  safety: runtimeSafetyContract,
  readOnlyScope: ['workflows', 'logs', 'state'] as const,
  forbiddenInWeek1: ['command_execution', 'permissioned_run', 'autonomous_run'] as const,
};

export type HermesReadOnlyConfig = {
  mode?: string;
  workspaceDir?: string;
  workflowDir?: string;
  logDir?: string;
  stateDir?: string;
};

export type HermesReadOnlyScanRequest = ReadOnlyScanRequest & { provider: 'hermes' };
export type HermesReadOnlyScanResult = ReadOnlyScanResult & { provider: 'hermes' };

export function hermesReadOnlyConfigFromEnv(env: NodeJS.ProcessEnv = process.env): HermesReadOnlyConfig {
  return {
    mode: env[hermesRuntimeContract.env.mode],
    workspaceDir: env[hermesRuntimeContract.env.readOnlyWorkspaceDir],
    workflowDir: env[hermesRuntimeContract.env.readOnlyWorkflowDir],
    logDir: env[hermesRuntimeContract.env.readOnlyLogDir],
    stateDir: env[hermesRuntimeContract.env.readOnlyStateDir],
  };
}

export function hermesReadOnlyRequiredConfig(config: HermesReadOnlyConfig = hermesReadOnlyConfigFromEnv()): string[] {
  const missing: string[] = [];
  if (config.mode !== 'read-only') missing.push(`${hermesRuntimeContract.env.mode}=read-only`);
  if (!config.workspaceDir) missing.push(hermesRuntimeContract.env.readOnlyWorkspaceDir);
  return missing;
}

export function hermesRuntimeStatus(config: HermesReadOnlyConfig = hermesReadOnlyConfigFromEnv()): RuntimeProviderStatus {
  const missing = hermesReadOnlyRequiredConfig(config);
  const readOnlyAvailable = missing.length === 0;
  const blockers: RuntimeBlocker[] = readOnlyAvailable
    ? [{ code: 'REAL_EXECUTION_DISABLED', message: 'Hermes read-only mode can inspect workflows/logs/state only. Real execution remains disabled.' }]
    : [{ code: 'READ_ONLY_CONFIG_MISSING', message: 'Hermes read-only runtime is not configured.', requiredConfig: missing }];

  return {
    provider: 'hermes',
    mode: readOnlyAvailable ? 'read-only' : 'mock',
    status: readOnlyAvailable ? 'available' : 'blocked',
    label: readOnlyAvailable ? 'Runtime Status: Read-Only • Real execution disabled' : 'Runtime Status: Blocked • Read-only config missing',
    readOnlyAvailable,
    realExecutionEnabled: false,
    permissionedImplemented: false,
    autonomousImplemented: false,
    requiredConfig: readOnlyAvailable ? [] : missing,
    blockers,
  };
}

export function createHermesReadOnlyScanRequest(tenant: TenantWorkspace, options: Omit<Partial<HermesReadOnlyScanRequest>, 'tenant' | 'provider' | 'mode'> = {}): HermesReadOnlyScanRequest {
  return {
    tenant,
    provider: 'hermes',
    mode: 'read-only',
    includeWorkflows: options.includeWorkflows ?? true,
    includeLogs: options.includeLogs ?? true,
    includeState: options.includeState ?? true,
    since: options.since,
  };
}

export function blockedHermesReadOnlyScan(request: HermesReadOnlyScanRequest, blockers: RuntimeBlocker[]): HermesReadOnlyScanResult {
  return {
    provider: 'hermes',
    mode: 'read-only',
    status: 'blocked',
    workflows: [],
    logs: [],
    stateFiles: [],
    blockers,
    auditEvents: [{
      id: `runtime-audit-${Date.now()}`,
      createdAt: new Date().toISOString(),
      tenantId: request.tenant.tenantId,
      provider: 'hermes',
      mode: 'read-only',
      action: 'read_only_scan',
      outcome: 'blocked',
      blockers,
    }],
  };
}

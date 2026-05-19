export type RuntimeMode = 'mock' | 'read-only' | 'permissioned' | 'autonomous';

export type RuntimeStatusKind = 'blocked' | 'available' | 'not-implemented';

export type TenantWorkspace = {
  tenantId: string;
  workspaceDir: string;
  storageDir?: string;
};

export type RuntimeBlocker = {
  code: string;
  message: string;
  requiredConfig?: string[];
};

export type RuntimeAuditEvent = {
  id: string;
  createdAt: string;
  tenantId: string;
  provider: 'hermes' | 'omx' | 'openclaw';
  mode: RuntimeMode;
  action: 'status' | 'read_only_scan';
  outcome: RuntimeStatusKind;
  blockers?: RuntimeBlocker[];
  sourcePaths?: string[];
};

export type ReadOnlyScanRequest = {
  tenant: TenantWorkspace;
  provider: 'hermes' | 'omx' | 'openclaw';
  mode: Extract<RuntimeMode, 'read-only'>;
  includeWorkflows?: boolean;
  includeLogs?: boolean;
  includeState?: boolean;
  since?: string;
};

export type ReadOnlyScanResult = {
  provider: 'hermes' | 'omx' | 'openclaw';
  mode: Extract<RuntimeMode, 'read-only'>;
  status: RuntimeStatusKind;
  workflows: string[];
  logs: string[];
  stateFiles: string[];
  auditEvents: RuntimeAuditEvent[];
  blockers: RuntimeBlocker[];
};

export type RuntimeProviderStatus = {
  provider: 'hermes' | 'omx' | 'openclaw';
  mode: RuntimeMode;
  status: RuntimeStatusKind;
  label: string;
  readOnlyAvailable: boolean;
  realExecutionEnabled: false;
  permissionedImplemented: false;
  autonomousImplemented: false;
  requiredConfig: string[];
  blockers: RuntimeBlocker[];
};

export const runtimeSafetyContract = {
  defaultMode: 'mock' as const,
  supportedModes: ['mock', 'read-only', 'permissioned', 'autonomous'] as const,
  readOnlyAllowedActions: ['status', 'read_only_scan'] as const,
  realExecutionEnabled: false as const,
  permissionedImplemented: false as const,
  autonomousImplemented: false as const,
  commandExecutionAllowed: false as const,
};

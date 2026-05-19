import type { RuntimeBlocker, RuntimeProviderStatus } from './types.ts';
import { runtimeSafetyContract } from './types.ts';

export const omxRuntimeContract = {
  provider: 'omx' as const,
  aliases: ['openclaw'] as const,
  displayName: 'OMX / OpenClaw',
  env: {
    mode: 'OMX_RUNTIME_MODE',
    readOnlyWorkspaceDir: 'OMX_READONLY_WORKSPACE_DIR',
  },
  safety: runtimeSafetyContract,
  readOnlyScope: ['workflows', 'logs', 'state'] as const,
  implementation: 'stub' as const,
  forbiddenInWeek1: ['command_execution', 'permissioned_run', 'autonomous_run'] as const,
};

export function omxRuntimeStatus(): RuntimeProviderStatus {
  const requiredConfig = [`${omxRuntimeContract.env.mode}=read-only`, omxRuntimeContract.env.readOnlyWorkspaceDir];
  const blockers: RuntimeBlocker[] = [{
    code: 'OMX_READ_ONLY_STUB',
    message: 'OMX/OpenClaw read-only contract is defined, but provider adapter is not implemented in Week 1 foundation.',
    requiredConfig,
  }];
  return {
    provider: 'omx',
    mode: 'mock',
    status: 'not-implemented',
    label: 'Runtime Status: Blocked • OMX/OpenClaw read-only adapter not implemented',
    readOnlyAvailable: false,
    realExecutionEnabled: false,
    permissionedImplemented: false,
    autonomousImplemented: false,
    requiredConfig,
    blockers,
  };
}

export const openClawRuntimeContract = omxRuntimeContract;
export const openClawRuntimeStatus = omxRuntimeStatus;

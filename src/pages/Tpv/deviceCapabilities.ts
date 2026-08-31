import type { CapabilityState, EffectiveDeviceCapabilities } from '@/services/tpv.service'
import { TpvCommandType, UI_AVAILABLE_COMMANDS } from '@/types/tpv-commands'

export type DeviceCapabilitiesInput = EffectiveDeviceCapabilities | null | undefined
export type ActivationLifecycleState = 'capabilities-unavailable' | 'not-required' | 'pending' | 'activated'

export interface DeviceActionPolicy {
  activationState: ActivationLifecycleState
  activationPending: boolean
  canDeactivate: boolean
  canConfigurePayments: boolean
  canRequestDisplayInversion: boolean
  supportedRemoteCommands: TpvCommandType[]
}

export type CapabilityStateTranslationKey =
  'capabilities.states.supported' | 'capabilities.states.unsupported' | 'capabilities.states.unknown'

const CAPABILITY_STATE_TRANSLATION_KEYS: Record<CapabilityState, CapabilityStateTranslationKey> = {
  SUPPORTED: 'capabilities.states.supported',
  UNSUPPORTED: 'capabilities.states.unsupported',
  UNKNOWN: 'capabilities.states.unknown',
}

export function canActivate(capabilities: DeviceCapabilitiesInput): boolean {
  return capabilities?.requiresActivation === true
}

export function canConfigurePayments(capabilities: DeviceCapabilitiesInput): boolean {
  return capabilities?.canManagePaymentConfiguration === true
}

export function canAcceptTerminalPaymentRequests(capabilities: DeviceCapabilitiesInput): boolean {
  return capabilities?.canAcceptTerminalPaymentRequests === true
}

export function canSendCommand(capabilities: DeviceCapabilitiesInput, command: TpvCommandType): boolean {
  return capabilities?.supportedRemoteCommands.includes(command) === true
}

export function canRequestDisplayInversion(capabilities: DeviceCapabilitiesInput): boolean {
  return capabilities?.customerDisplay.canRequestInversion === true
}

export function isActivationPending(capabilities: DeviceCapabilitiesInput, activatedAt?: string | null): boolean {
  return canActivate(capabilities) && !activatedAt
}

export function canDeactivate(capabilities: DeviceCapabilitiesInput, activatedAt?: string | null): boolean {
  return canActivate(capabilities) && Boolean(activatedAt)
}

export function getActivationLifecycleState(
  capabilities: DeviceCapabilitiesInput,
  activatedAt?: string | null,
): ActivationLifecycleState {
  if (!capabilities) return 'capabilities-unavailable'
  if (!capabilities.requiresActivation) return 'not-required'
  return activatedAt ? 'activated' : 'pending'
}

/** Commands that are both reported by the device and intentionally exposed in venue/org UI. */
export function getSupportedRemoteCommands(capabilities: DeviceCapabilitiesInput): TpvCommandType[] {
  if (!capabilities) return []
  return capabilities.supportedRemoteCommands.filter(command => UI_AVAILABLE_COMMANDS.includes(command))
}

/** Safe intersection for mixed bulk selections. One unknown legacy projection closes the action set. */
export function getCommonSupportedRemoteCommands(capabilities: DeviceCapabilitiesInput[]): TpvCommandType[] {
  if (capabilities.length === 0 || capabilities.some(item => !item)) return []
  const [first, ...rest] = capabilities as EffectiveDeviceCapabilities[]
  return getSupportedRemoteCommands(first).filter(command => rest.every(item => canSendCommand(item, command)))
}

export function getDeviceActionPolicy(
  capabilities: DeviceCapabilitiesInput,
  activatedAt?: string | null,
): DeviceActionPolicy {
  return {
    activationState: getActivationLifecycleState(capabilities, activatedAt),
    activationPending: isActivationPending(capabilities, activatedAt),
    canDeactivate: canDeactivate(capabilities, activatedAt),
    canConfigurePayments: canConfigurePayments(capabilities),
    canRequestDisplayInversion: canRequestDisplayInversion(capabilities),
    supportedRemoteCommands: getSupportedRemoteCommands(capabilities),
  }
}

export function getCapabilityStateTranslationKey(state: CapabilityState): CapabilityStateTranslationKey {
  return CAPABILITY_STATE_TRANSLATION_KEYS[state]
}

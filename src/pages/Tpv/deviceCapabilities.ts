import type { CapabilityState, EffectiveDeviceCapabilities } from '@/services/tpv.service'
import type { TpvCommandType } from '@/types/tpv-commands'

export type CapabilityStateTranslationKey =
  'capabilities.states.supported' | 'capabilities.states.unsupported' | 'capabilities.states.unknown'

const CAPABILITY_STATE_TRANSLATION_KEYS: Record<CapabilityState, CapabilityStateTranslationKey> = {
  SUPPORTED: 'capabilities.states.supported',
  UNSUPPORTED: 'capabilities.states.unsupported',
  UNKNOWN: 'capabilities.states.unknown',
}

export function canActivate(capabilities: EffectiveDeviceCapabilities): boolean {
  return capabilities.requiresActivation
}

export function canConfigurePayments(capabilities: EffectiveDeviceCapabilities): boolean {
  return capabilities.canManagePaymentConfiguration
}

export function canAcceptTerminalPaymentRequests(capabilities: EffectiveDeviceCapabilities): boolean {
  return capabilities.canAcceptTerminalPaymentRequests
}

export function canSendCommand(capabilities: EffectiveDeviceCapabilities, command: TpvCommandType): boolean {
  return capabilities.supportedRemoteCommands.includes(command)
}

export function canRequestDisplayInversion(capabilities: EffectiveDeviceCapabilities): boolean {
  return capabilities.customerDisplay.canRequestInversion
}

export function getCapabilityStateTranslationKey(state: CapabilityState): CapabilityStateTranslationKey {
  return CAPABILITY_STATE_TRANSLATION_KEYS[state]
}

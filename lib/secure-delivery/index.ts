import type { SecureDeliveryProvider } from './types'
import { zivverProvider } from './zivver'

export type { SecureDeliveryProvider, SecureReportInput, SecureDeliveryResult } from './types'

// Kiest de actieve bezorg-provider. Standaard Zivver; later uitbreidbaar
// (bv. Zorgmail) zonder de aanroepende code te wijzigen.
export function getSecureDeliveryProvider(): SecureDeliveryProvider {
  const choice = (process.env.SECURE_DELIVERY_PROVIDER ?? 'zivver').toLowerCase()
  switch (choice) {
    case 'zivver':
    default:
      return zivverProvider
  }
}

import type { MetadataRoute } from 'next'

// Blokkeert alle zoekmachines voor de hele applicatie.
// Dit is een intern medewerkers- en cliëntenportaal.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: '/',
    },
  }
}

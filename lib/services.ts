// Canonical service catalog. SAT and ACT prep are separately approvable; a
// legacy 'sat-act' id may still appear in older applications and profiles.

export const SERVICE_OPTIONS = [
  { id: 'essays', label: 'Essay Writing' },
  { id: 'sat', label: 'SAT Prep' },
  { id: 'act', label: 'ACT Prep' },
  { id: 'activities', label: 'Activities List Building' },
] as const

export const SERVICE_LABELS: Record<string, string> = {
  essays: 'Essay Writing',
  sat: 'SAT Prep',
  act: 'ACT Prep',
  activities: 'Activities List Building',
  // Legacy fallback so already-stored 'sat-act' values render until they're
  // expanded at the API boundary.
  'sat-act': 'SAT/ACT Prep',
}

export function expandLegacyServiceIds(services: string[] | null | undefined): string[] {
  if (!services) return []
  const out: string[] = []
  for (const id of services) {
    if (id === 'sat-act') {
      if (!out.includes('sat')) out.push('sat')
      if (!out.includes('act')) out.push('act')
    } else if (!out.includes(id)) {
      out.push(id)
    }
  }
  return out
}

export function expandLegacyServicePrices(
  prices: Record<string, number> | null | undefined,
): Record<string, number> {
  if (!prices) return {}
  const out: Record<string, number> = { ...prices }
  const legacy = out['sat-act']
  if (typeof legacy === 'number' && legacy > 0) {
    if (out.sat === undefined) out.sat = legacy
    if (out.act === undefined) out.act = legacy
  }
  delete out['sat-act']
  return out
}

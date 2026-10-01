function norm(v?: string | null): string {
  return String(v ?? '')
    .trim()
    .replace(/\s+/g, '');
}

export function companyMatchKey(pib?: string | null, mb?: string | null): string | null {
  const p = norm(pib);
  const m = norm(mb);
  if (p) return `pib:${p}`;
  if (m) return `mb:${m}`;
  return null;
}

export async function findProjectByName(
  prisma: { project: { findMany: (args: unknown) => Promise<{ id: string; name: string }[]> } },
  tenantId: string,
  name: string,
): Promise<{ id: string; name: string } | null> {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  const projects = await prisma.project.findMany({
    where: { tenantId },
    select: { id: true, name: true },
    take: 500,
  });
  const exact = projects.find((p) => p.name.toLowerCase() === needle);
  if (exact) return exact;
  const partial = projects.find((p) => p.name.toLowerCase().includes(needle));
  return partial ?? null;
}

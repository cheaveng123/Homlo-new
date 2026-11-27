export function computePositionsLeft(
  total: number | string | null | undefined,
  filled: number | string | null | undefined,
): number {
  const needed = Number(total ?? 0);
  const hired = Number(filled ?? 0);
  const safeNeeded = Number.isFinite(needed) ? Math.max(needed, 0) : 0;
  const safeHired = Number.isFinite(hired) ? Math.max(hired, 0) : 0;
  return Math.max(safeNeeded - safeHired, 0);
}

export function formatPositionsLabel(
  filled: number | string | null | undefined,
  total: number | string | null | undefined,
): string {
  const needed = Number(total ?? 0);
  const hired = Number(filled ?? 0);
  const safeNeeded = Number.isFinite(needed) ? Math.max(needed, 0) : 0;
  if (safeNeeded === 0) return "Positions";
  const safeHired = Number.isFinite(hired) ? Math.min(Math.max(hired, 0), safeNeeded) : 0;
  return `${safeHired}/${safeNeeded} position${safeNeeded === 1 ? "" : "s"}`;
}

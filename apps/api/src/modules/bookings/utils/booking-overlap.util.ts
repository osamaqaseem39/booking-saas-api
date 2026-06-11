export function normalizeCourtKindForOverlap(kind: string): string {
  if (kind === 'futsal_court' || kind === 'cricket_court') return 'turf_court';
  return kind;
}

export function wallTimeWindowsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

export type OverlapCheckWindow = {
  courtKey: string;
  start: Date;
  end: Date;
  index: number;
};

export function findOverlappingItemIndices(
  windows: OverlapCheckWindow[],
): [number, number] | null {
  for (let i = 0; i < windows.length; i += 1) {
    for (let j = i + 1; j < windows.length; j += 1) {
      const a = windows[i];
      const b = windows[j];
      if (a.courtKey !== b.courtKey) continue;
      if (wallTimeWindowsOverlap(a.start, a.end, b.start, b.end)) {
        return [a.index, b.index];
      }
    }
  }
  return null;
}

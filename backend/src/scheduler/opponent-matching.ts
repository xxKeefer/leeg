export interface DuoPairing {
  duo1: [string, string];
  duo2: [string, string];
}

export interface MatchResult {
  pairings: DuoPairing[];
  byeDuo: [string, string] | null;
}

function duoPoints(duo: [string, string], standings: Map<string, number>): number {
  return (standings.get(duo[0]) ?? 0) + (standings.get(duo[1]) ?? 0);
}

function duoByeCount(duo: [string, string], byeCounts: Map<string, number>): number {
  return (byeCounts.get(duo[0]) ?? 0) + (byeCounts.get(duo[1]) ?? 0);
}

export function matchDuos(
  duos: [string, string][],
  standings: Map<string, number>,
  byeCounts?: Map<string, number>,
): MatchResult {
  if (duos.length === 0) {
    return { pairings: [], byeDuo: null };
  }

  const sorted = [...duos].sort((a, b) => duoPoints(b, standings) - duoPoints(a, standings));

  let byeDuo: [string, string] | null = null;

  if (sorted.length % 2 !== 0) {
    if (byeCounts) {
      sorted.sort((a, b) => duoByeCount(a, byeCounts) - duoByeCount(b, byeCounts));
      byeDuo = sorted.shift()!;
      sorted.sort((a, b) => duoPoints(b, standings) - duoPoints(a, standings));
    } else {
      byeDuo = sorted.shift()!;
    }
  }

  const pairings: DuoPairing[] = [];
  for (let i = 0; i < sorted.length; i += 2) {
    pairings.push({ duo1: sorted[i], duo2: sorted[i + 1] });
  }

  return { pairings, byeDuo };
}

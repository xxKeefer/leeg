export interface TeamPairing {
  team1: [string, string];
  team2: [string, string];
}

export interface MatchResult {
  pairings: TeamPairing[];
  byeTeam: [string, string] | null;
}

function teamPoints(team: [string, string], standings: Map<string, number>): number {
  return (standings.get(team[0]) ?? 0) + (standings.get(team[1]) ?? 0);
}

function teamByeCount(team: [string, string], byeCounts: Map<string, number>): number {
  return (byeCounts.get(team[0]) ?? 0) + (byeCounts.get(team[1]) ?? 0);
}

export function matchTeams(
  teams: [string, string][],
  standings: Map<string, number>,
  byeCounts?: Map<string, number>,
): MatchResult {
  if (teams.length === 0) {
    return { pairings: [], byeTeam: null };
  }

  const sorted = [...teams].sort((a, b) => teamPoints(b, standings) - teamPoints(a, standings));

  let byeTeam: [string, string] | null = null;

  if (sorted.length % 2 !== 0) {
    if (byeCounts) {
      sorted.sort((a, b) => teamByeCount(a, byeCounts) - teamByeCount(b, byeCounts));
      byeTeam = sorted.shift()!;
      sorted.sort((a, b) => teamPoints(b, standings) - teamPoints(a, standings));
    } else {
      byeTeam = sorted.shift()!;
    }
  }

  const pairings: TeamPairing[] = [];
  for (let i = 0; i < sorted.length; i += 2) {
    pairings.push({ team1: sorted[i], team2: sorted[i + 1] });
  }

  return { pairings, byeTeam };
}

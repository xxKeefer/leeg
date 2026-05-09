export interface GameData {
  winner: "team1" | "team2" | "draw" | null;
  team1Kos: number;
  team2Kos: number;
}

export interface MatchData {
  id: string;
  team1Player1: string | null;
  team1Player2: string | null;
  team2Player1: string | null;
  team2Player2: string | null;
  result: "team1" | "team2" | "draw" | "bye" | null;
  isBye: boolean;
  games: GameData[];
}

export interface StandingEntry {
  playerId: string;
  points: number;
  koDifferential: number;
  rank: number;
  isFinalist: boolean;
}

export interface FfaPlacement {
  playerId: string;
  placement: number | null;
}

const PLACEMENT_POINTS: Record<number, number> = { 1: 6, 2: 4, 3: 2, 4: 0 };

export function deriveMatchResult(games: GameData[]): "team1" | "team2" | "draw" | null {
  let team1Wins = 0;
  let team2Wins = 0;
  let draws = 0;

  for (const g of games) {
    if (g.winner === "team1") team1Wins++;
    else if (g.winner === "team2") team2Wins++;
    else if (g.winner === "draw") draws++;
  }

  if (team1Wins >= 2) return "team1";
  if (team2Wins >= 2) return "team2";

  const totalPlayed = team1Wins + team2Wins + draws;
  if (totalPlayed >= 3) {
    if (team1Wins > team2Wins) return "team1";
    if (team2Wins > team1Wins) return "team2";
    return "draw";
  }

  return null;
}

export function computeStandings(matches: MatchData[], ffaPlacements: FfaPlacement[] = []): StandingEntry[] {
  const stats = new Map<string, { points: number; koDiff: number }>();

  function ensure(playerId: string | null) {
    if (!playerId) return;
    if (!stats.has(playerId)) {
      stats.set(playerId, { points: 0, koDiff: 0 });
    }
  }

  for (const match of matches) {
    if (match.isBye) {
      const byePlayers = [match.team1Player1, match.team1Player2].filter(Boolean);
      for (const pid of byePlayers) {
        ensure(pid);
        stats.get(pid!)!.points += 1;
      }
      continue;
    }

    const team1 = [match.team1Player1, match.team1Player2].filter(Boolean) as string[];
    const team2 = [match.team2Player1, match.team2Player2].filter(Boolean) as string[];
    for (const pid of [...team1, ...team2]) ensure(pid);

    const result = match.result;
    if (!result) continue;

    const pointsTeam1 = result === "team1" ? 3 : result === "draw" ? 1 : 0;
    const pointsTeam2 = result === "team2" ? 3 : result === "draw" ? 1 : 0;

    for (const pid of team1) stats.get(pid)!.points += pointsTeam1;
    for (const pid of team2) stats.get(pid)!.points += pointsTeam2;

    let totalTeam1Kos = 0;
    let totalTeam2Kos = 0;
    for (const g of match.games) {
      totalTeam1Kos += g.team1Kos;
      totalTeam2Kos += g.team2Kos;
    }

    const diff = totalTeam1Kos - totalTeam2Kos;
    for (const pid of team1) stats.get(pid)!.koDiff += diff;
    for (const pid of team2) stats.get(pid)!.koDiff -= diff;
  }

  for (const ffa of ffaPlacements) {
    ensure(ffa.playerId);
    if (ffa.placement != null) {
      stats.get(ffa.playerId)!.points += PLACEMENT_POINTS[ffa.placement] ?? 0;
    }
  }

  const entries: StandingEntry[] = [];
  for (const [playerId, { points, koDiff }] of stats) {
    entries.push({ playerId, points, koDifferential: koDiff, rank: 0, isFinalist: false });
  }

  entries.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.koDifferential - a.koDifferential;
  });

  for (let i = 0; i < entries.length; i++) {
    entries[i].rank = i + 1;
    entries[i].isFinalist = i < 4;
  }

  return entries;
}

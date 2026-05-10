export interface MatchData {
  winner: "duo1" | "duo2" | "draw" | null;
  duo1Kos: number;
  duo2Kos: number;
}

export interface SetData {
  id: string;
  duo1Trainer1: string | null;
  duo1Trainer2: string | null;
  duo2Trainer1: string | null;
  duo2Trainer2: string | null;
  result: "duo1" | "duo2" | "draw" | "bye" | null;
  isBye: boolean;
  matches: MatchData[];
}

export interface StandingEntry {
  trainerId: string;
  points: number;
  koDifferential: number;
  rank: number;
  isFinalist: boolean;
}

export interface FfaPlacement {
  trainerId: string;
  placement: number | null;
}

const PLACEMENT_POINTS: Record<number, number> = { 1: 6, 2: 4, 3: 2, 4: 0 };

export function deriveSetResult(matches: MatchData[]): "duo1" | "duo2" | "draw" | null {
  let duo1Wins = 0;
  let duo2Wins = 0;
  let draws = 0;

  for (const m of matches) {
    if (m.winner === "duo1") duo1Wins++;
    else if (m.winner === "duo2") duo2Wins++;
    else if (m.winner === "draw") draws++;
  }

  if (duo1Wins >= 2) return "duo1";
  if (duo2Wins >= 2) return "duo2";

  const totalPlayed = duo1Wins + duo2Wins + draws;
  if (totalPlayed >= 3) {
    if (duo1Wins > duo2Wins) return "duo1";
    if (duo2Wins > duo1Wins) return "duo2";
    return "draw";
  }

  return null;
}

export function computeStandings(sets: SetData[], ffaPlacements: FfaPlacement[] = []): StandingEntry[] {
  const stats = new Map<string, { points: number; koDiff: number }>();

  function ensure(trainerId: string | null) {
    if (!trainerId) return;
    if (!stats.has(trainerId)) {
      stats.set(trainerId, { points: 0, koDiff: 0 });
    }
  }

  for (const set of sets) {
    if (set.isBye) {
      const byeTrainers = [set.duo1Trainer1, set.duo1Trainer2].filter(Boolean);
      for (const tid of byeTrainers) {
        ensure(tid);
        stats.get(tid!)!.points += 1;
      }
      continue;
    }

    const duo1 = [set.duo1Trainer1, set.duo1Trainer2].filter(Boolean) as string[];
    const duo2 = [set.duo2Trainer1, set.duo2Trainer2].filter(Boolean) as string[];
    for (const tid of [...duo1, ...duo2]) ensure(tid);

    const result = set.result;
    if (!result) continue;

    const pointsDuo1 = result === "duo1" ? 3 : result === "draw" ? 1 : 0;
    const pointsDuo2 = result === "duo2" ? 3 : result === "draw" ? 1 : 0;

    for (const tid of duo1) stats.get(tid)!.points += pointsDuo1;
    for (const tid of duo2) stats.get(tid)!.points += pointsDuo2;

    let totalDuo1Kos = 0;
    let totalDuo2Kos = 0;
    for (const m of set.matches) {
      totalDuo1Kos += m.duo1Kos;
      totalDuo2Kos += m.duo2Kos;
    }

    const diff = totalDuo1Kos - totalDuo2Kos;
    for (const tid of duo1) stats.get(tid)!.koDiff += diff;
    for (const tid of duo2) stats.get(tid)!.koDiff -= diff;
  }

  for (const ffa of ffaPlacements) {
    ensure(ffa.trainerId);
    if (ffa.placement != null) {
      stats.get(ffa.trainerId)!.points += PLACEMENT_POINTS[ffa.placement] ?? 0;
    }
  }

  const entries: StandingEntry[] = [];
  for (const [trainerId, { points, koDiff }] of stats) {
    entries.push({ trainerId, points, koDifferential: koDiff, rank: 0, isFinalist: false });
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

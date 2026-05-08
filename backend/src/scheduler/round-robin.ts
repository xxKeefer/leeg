export interface ScheduleRound {
  roundNumber: number;
  teams: [string, string][];
  byePlayer: string | null;
}

export function generatePartnershipSchedule(playerIds: string[]): ScheduleRound[] {
  const isOdd = playerIds.length % 2 !== 0;
  const participants = [...playerIds];

  if (isOdd) {
    participants.push("__phantom__");
  }

  const n = participants.length;
  const totalRounds = n - 1;
  const rounds: ScheduleRound[] = [];

  const fixed = participants[0];
  const rotating = participants.slice(1);

  for (let r = 0; r < totalRounds; r++) {
    const current = [fixed, ...rotating];
    const teams: [string, string][] = [];
    let byePlayer: string | null = null;

    for (let i = 0; i < n / 2; i++) {
      const p1 = current[i];
      const p2 = current[n - 1 - i];

      if (p1 === "__phantom__") {
        byePlayer = p2;
      } else if (p2 === "__phantom__") {
        byePlayer = p1;
      } else {
        teams.push([p1, p2]);
      }
    }

    rounds.push({
      roundNumber: r + 1,
      teams,
      byePlayer,
    });

    const last = rotating.pop()!;
    rotating.unshift(last);
  }

  return rounds;
}

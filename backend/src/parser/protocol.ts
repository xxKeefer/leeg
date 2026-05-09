export interface ParseResult {
  winner: "p1" | "p2" | "draw";
  p1Kos: number;
  p2Kos: number;
}

export function parseProtocol(protocol: string): ParseResult {
  const lines = protocol.split("\n");

  const playerNames = new Map<string, "p1" | "p2">();
  let p1Kos = 0;
  let p2Kos = 0;
  let winner: "p1" | "p2" | "draw" = "draw";

  for (const line of lines) {
    const parts = line.split("|");

    if (parts[1] === "player" && (parts[2] === "p1" || parts[2] === "p2")) {
      playerNames.set(parts[3], parts[2]);
    }

    if (parts[1] === "faint") {
      const target = parts[2];
      if (target.startsWith("p1")) {
        p2Kos++;
      } else if (target.startsWith("p2")) {
        p1Kos++;
      }
    }

    if (parts[1] === "win") {
      const winnerName = parts[2];
      const side = playerNames.get(winnerName);
      if (side) {
        winner = side;
      }
    }

    if (parts[1] === "tie") {
      winner = "draw";
    }
  }

  return { winner, p1Kos, p2Kos };
}

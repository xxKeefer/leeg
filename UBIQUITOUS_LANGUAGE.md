# Ubiquitous Language

Shared terminology for **leeg** -- a Pokemon League Manager.

## Core Concepts

| Term | Definition | Code mapping |
|---|---|---|
| **League** | A season-long competition with enrolled trainers, a generated schedule, and a finale. Has a lifecycle: draft -> active -> finale -> complete. | `leagues` table |
| **Trainer** | A person competing in a league. Has a name and a Showdown username. | `trainers` table |
| **Team** | The set of pokemon belonging to one trainer. Not a group of trainers. | -- |
| **Duo** | An ad-hoc pairing of two trainers who battle together for one round. Duos rotate every round so each trainer partners with every other exactly once. | `duo1_trainer1 + duo1_trainer2` / `duo2_trainer1 + duo2_trainer2` on `sets` |
| **Round** | A single week of play in the schedule. Contains one or more sets plus possible byes. | `rounds` table |
| **Set** | A best-of-3 series between two duos. First to 2 match wins takes the set. | `sets` table (`bestOf: 3`) |
| **Match** | A single battle within a set. Produces one replay. | `matches` table |
| **Format** | The rules governing how a league is played. Currently only `2hg` (Two-Headed Giant). | `leagues.format` |
| **2HG (Two-Headed Giant)** | A format where two trainers share control of a single doubles battle via voice call, each piloting 3 of the 6 pokemon. | -- |
| **Schedule** | The full round-robin rotation that determines which duos form each round. Generated from the partnership algorithm. | `generatePartnershipSchedule()` |
| **Bye (Individual)** | When odd trainers exist, one trainer sits out a round. Receives 1 point, 0 KO differential. Implemented via a phantom player in the algorithm. | `byeTrainer` in `ScheduleRound` |
| **Bye (Duo)** | When odd duos exist in a round, one duo sits out. Both trainers receive 1 point each. | `byeDuo` in `MatchResult` |
| **Phantom Player** | An algorithmic placeholder representing the individual bye slot. Not a real trainer. | `"__phantom__"` sentinel |
| **Replay** | A Pokemon Showdown replay URL that records a match. Source of the protocol string. | `matches.replayUrl` |
| **Protocol** | The raw poke protocol string from a Showdown replay. Parsed for results and KO counts. Stored for future analytics. | `matches.protocol` |
| **KO** | A pokemon knockout. Counted per match from `\|faint\|` lines in the protocol. | `matches.duo1Kos`, `matches.duo2Kos` |
| **KO Differential** | Net KOs across all matches in all sets for a trainer across the season. Tiebreaker for standings. | `koDiff` in standings computation |
| **Standing** | A single trainer's season record: points, KO differential, rank, finalist status. | `StandingEntry` interface |
| **Standings** | The ranked board of all trainers in a league, sorted by points then KO differential. | `computeStandings()` |
| **Finalist** | A trainer ranked in the top 4 who qualifies for the finale. | `isFinalist` on `StandingEntry` |
| **Finale** | The final round of the season -- a single FFA match among the top 4 trainers. Placement points are added to season totals. | `rounds.roundType = 'finale'` |
| **FFA (Free-For-All)** | Showdown's native format where 4 trainers battle simultaneously in a single match. Used for the finale. | `sets.setType = 'ffa'` |
| **Placement** | A finalist's finishing position (1st-4th) in the FFA. Drives bonus scoring: 1st=6, 2nd=4, 3rd=2, 4th=0. | `ffa_participants.placement` |
| **Result** | The outcome of a match (`duo1`/`duo2`/`draw`) or a set (`duo1`/`duo2`/`draw`/`bye`). Context determines scope. | `matches.winner`, `sets.result` |

## Relationships

| Subject | Relationship | Object |
|---|---|---|
| League | has many | Trainers |
| League | has many | Rounds |
| League | has one | Schedule |
| Round | has many | Sets |
| Set | has up to 3 | Matches |
| Match | produces one | Replay |
| Replay | contains one | Protocol |
| Protocol | is parsed into | Result + KOs |
| Duo | is composed of 2 | Trainers |
| Duo | plays one | Set per Round |
| Standings | is derived from | all Sets + FFA Placements |
| Finalist | qualifies for | Finale |
| Finale | is a single | FFA Match |

## Example Dialogue

> "When the admin generates the **schedule** for a 6-trainer **league**, each **round** pairs trainers into **duos**. Each duo plays a **set** (best of 3 **matches**) against another duo. After all rounds complete, the **standings** determine the top 4 **finalists** who enter the **finale** -- a single **FFA match** with **placement** scoring."

> "A trainer submits a **replay** URL for a **match**. The system fetches the **protocol**, parses `|faint|` lines to count **KOs**, and determines the **result**. Both trainers in the winning **duo** get 3 points and share the **KO differential**."

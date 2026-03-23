---
id: fuf-0e4awr
title: replay parsing
type: feat
status: todo
created: '2026-03-23'
priority: 4
---

## Description

Fetch Showdown replay JSON from replay.pokemonshowdown.com, parse the battle log via @pkmn/protocol + @pkmn/client, store raw log and granular turn events.

## Acceptance Criteria

- [ ] Admin can paste a Showdown replay URL and trigger parsing
- [ ] Parser extracts moves used, damage dealt, KOs, faints, status applications, turns per Pokemon
- [ ] Full raw battle log is stored per game
- [ ] Turn-by-turn events are stored in structured format
- [ ] Parser handles edge cases: mega evolution, terastallize, multi-hit moves, indirect damage
- [ ] Parsed replays are cached to avoid re-fetching

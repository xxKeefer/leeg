---
id: fuf-0e83m2
title: drizzle orm + sqlite with initial schema
type: chore
status: todo
created: '2026-03-23'
parent: fuf-0e40wp
priority: 4
---

## Description

Install drizzle-orm + better-sqlite3. Define full data model schema (Trainer, Pokemon, Season, Week, TeamPairing, Match, Game, BattleLog, PokemonGameStat, TurnEvent). Generate and apply initial migration. Wire up Drizzle client for Nuxt server routes.

## Acceptance Criteria

- [ ] Drizzle schema defines all 10 tables with correct columns and relations
- [ ] Initial migration generates and applies cleanly
- [ ] Drizzle client is importable from server/db/
- [ ] A test inserts and reads a row from at least one table

---
id: fuf-0efqo8
title: season + roster recording api
type: feat
status: done
created: '2026-03-23'
flag: completed
parent: fuf-0e46gu
priority: 4
---

## Description

Server API for creating seasons and recording each trainer's 5 Pokemon. Admin creates a season, then assigns Pokemon (species only) to trainers. No point costs or budget — just the roster.

## Acceptance Criteria

- [x] POST /api/seasons creates a season with a name
- [x] POST /api/seasons/:id/rosters assigns a Pokemon to a trainer
- [x] GET /api/seasons/:id/rosters returns all trainers with their Pokemon
- [x] A trainer can have at most 5 Pokemon per season
- [x] DELETE /api/seasons/:id/rosters/:pokemonId removes a Pokemon from a roster

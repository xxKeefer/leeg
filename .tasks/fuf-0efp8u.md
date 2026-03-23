---
id: fuf-0efp8u
title: trainer crud api
type: feat
status: todo
created: '2026-03-23'
parent: fuf-0e46gu
priority: 4
---

## Description

Server API endpoints for creating, reading, updating, and deleting trainers. Each trainer has a name. Includes validation for duplicate names.

## Acceptance Criteria

- [ ] POST /api/trainers creates a trainer
- [ ] GET /api/trainers returns all trainers
- [ ] GET /api/trainers/:id returns a single trainer
- [ ] PUT /api/trainers/:id updates a trainer
- [ ] DELETE /api/trainers/:id removes a trainer
- [ ] Duplicate name returns a validation error

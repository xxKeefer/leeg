---
id: fuf-0efp8u
title: trainer crud api
type: feat
status: done
created: '2026-03-23'
flag: completed
parent: fuf-0e46gu
priority: 4
---

## Description

Server API endpoints for creating, reading, updating, and deleting trainers. Each trainer has a name. Includes validation for duplicate names.

## Acceptance Criteria

- [x] POST /api/trainers creates a trainer
- [x] GET /api/trainers returns all trainers
- [x] GET /api/trainers/:id returns a single trainer
- [x] PUT /api/trainers/:id updates a trainer
- [x] DELETE /api/trainers/:id removes a trainer
- [x] Duplicate name returns a validation error

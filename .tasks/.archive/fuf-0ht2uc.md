---
id: fuf-0ht2uc
title: foreign key error on trainer delete
type: fix
status: done
created: '2026-03-23'
flag: completed
parent: fuf-0e46gu
priority: 4
---

## Description

Deleting a trainer with roster entries causes a foreign key constraint error. Need cascade delete or guard against deleting trainers with dependencies.

## Acceptance Criteria


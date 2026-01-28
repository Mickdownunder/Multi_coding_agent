# Intent

## Goal
Create a system that can autonomously plan, implement, and verify software changes
using a strict state-machine-driven workflow.

## Primary Objective
The system must be able to:
- Start from an empty repository
- Generate a project structure
- Implement code according to explicit plans
- Verify changes against rules
- Converge to a DONE state without continuous human micromanagement

## Constraints
- Local-first (MacBook, filesystem-based)
- Git as the single source of truth
- Supabase will be used later for backend/state enforcement
- No chat-based coordination between agents

## Non-Goals
- No multi-user collaboration yet
- No production deployment yet
- No AI creativity or feature ideation

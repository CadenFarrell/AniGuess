---
name: capstone-stage-gen
description: "Orchestrator: dispatches all four stage guide subskills in sequence. Triggers capstone-explore-guide, capstone-learn-guide, capstone-modify-guide, capstone-reflect-guide. Each subskill runs independently — safe for local models. Use when student says 'generate my stage guides', 'update my stage guides', or triggered automatically by capstone-kickoff."
---

# Capstone Stage Generator — Orchestrator

## Description
Orchestrator skill. Dispatches the four stage guide subskills in sequence. Contains no generation logic of its own — each subskill handles its own context window and output file independently.

**Each subskill reads:** `planning/project-brief.md` + `planning/prd-index.md` (~1.3K tokens)
**Each subskill writes:** One guide file in `planning/stages/`
**Per-invocation cost:** ~2K tokens × 4 = well within any local model

## Trigger Phrases
- "Generate my stage guides"
- "Update my stage guides"
- "Regenerate all guides"
- Automatically triggered by `capstone-kickoff`

---

## Behavior

Run the following subskills **in sequence** (not parallel — each needs the project files to be stable):

1. **`capstone-explore-guide`** → writes `planning/stages/explore-guide.md`
2. **`capstone-learn-guide`** → writes `planning/stages/learn-guide.md`
3. **`capstone-modify-guide`** → writes `planning/stages/modify-guide.md`
4. **`capstone-reflect-guide`** → writes `planning/stages/reflect-guide.md`

Create `planning/stages/` directory if it doesn't exist.

After all four complete, confirm to the student:

> "Your stage guides are ready in `planning/stages/`. Start with the EXPLORE guide to validate your feature set. Each guide is short and action-oriented — work through the checkboxes as you go.
>
> When your PRD or stack changes, run individual guides to regenerate just what changed:
> - 'Regenerate my explore guide'
> - 'Regenerate my learn guide'
> - etc."

---

## Selective Regeneration

When called with "Update my [specific] guide", dispatch only that subskill:
- "Update my explore guide" → dispatch `capstone-explore-guide` only
- "Update my learn guide" → dispatch `capstone-learn-guide` only
- etc.

This keeps regeneration fast and local-model-friendly.

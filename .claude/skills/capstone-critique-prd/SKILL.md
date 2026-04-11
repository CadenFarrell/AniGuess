---
name: capstone-critique-prd
description: "Evaluates specification quality of the student's capstone PRD. Reads prd-index.md + spot-checks 1-2 prd/*.md section files (~2-3K tokens). Safe for local models. Triggered by capstone-critique or when student says 'critique my PRD'."
---

# Capstone Critique — Specification Quality

## Description
Evaluates the quality of the student's PRD. Reads the PRD index and spot-checks individual section files. Scores on the Two-Developer Test, acceptance criteria quality, data model completeness, and edge case coverage. Safe for local models.

## Trigger Phrases
- "Critique my PRD"
- "Evaluate my specification"
- "Is my spec ready?"
- Automatically triggered by `capstone-critique`

---

## Behavior

**Read (in this order):**
1. `planning/prd-index.md` — overview of all features and their summaries
2. `planning/project-brief.md` — MVP scope and exclusions (for context)
3. Up to 2 `planning/prd/*.md` section files — spot-check the most complex features (not all files)

**Write output to:** Return as inline response (not a file). `capstone-critique` aggregates all subskill outputs.

**Context budget:** Stay under 3K tokens of input. If `prd/*.md` files are large, read only the first feature file and the most complex one.

---

## Evaluation

### Two-Developer Test
Count decisions that are undefined or ambiguous. Two developers given this PRD — would they build the same thing?

- **0–3 undefined decisions** → Strong
- **4–7 undefined decisions** → Adequate
- **8+ undefined decisions** → Weak

### Acceptance Criteria Quality
For each feature's AC, check:
- Is it testable? (specific, measurable, unambiguous)
- Does it cover the happy path AND at least one error/edge case?
- Is it written as behavior, not implementation?

### Data Model Completeness
- Are all entities named with their fields and types?
- Are relationships specified (one-to-many, etc.)?
- Are constraints explicit (required, unique, max length, etc.)?
- Are cascading effects handled (what happens when X is deleted)?

### Edge Cases
- Is at least one error state per feature specified?
- Are boundary conditions addressed?
- Are exclusions explicit (what the app intentionally does NOT do)?

---

## Output Format

```markdown
## Specification Quality

**Score:** Strong / Adequate / Weak

**Two-Developer Test:** [N] undefined decisions found
[List the top 3 most critical undefined decisions]

**Acceptance Criteria:** [Assessment — are they testable?]
[Note 1-2 specific AC that are strong, and 1-2 that need work]

**Data Model:** [Complete / Mostly complete / Incomplete]
[Note any missing relationships, types, or constraints]

**Edge Cases:** [Covered / Partially covered / Missing]
[Note which features have good error handling spec and which don't]

**Top 3 Spec Improvements:**
1. [Most important thing to add or clarify]
2. [Second most important]
3. [Third most important]
```

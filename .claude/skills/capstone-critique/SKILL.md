---
name: capstone-critique
description: "Orchestrator: dispatches all four critique subskills then aggregates into a final evaluation. Triggers capstone-critique-prd, capstone-critique-process, capstone-critique-code, capstone-critique-reflection. Each subskill is safe for local models. Use when student says 'critique my capstone', 'evaluate my project', or 'is my capstone ready?'"
---

# Capstone Critique — Orchestrator

## Description
Orchestrator skill. Dispatches four focused critique subskills, then aggregates their outputs into a single structured evaluation report. Contains no evaluation logic of its own — each subskill is independently runnable and local-model-safe.

**Per-subskill context:** 2–3K tokens input, focused output
**Full critique total:** ~4 subskill passes + aggregation

## Trigger Phrases
- "Critique my capstone"
- "Evaluate my project"
- "Grade my capstone deliverables"
- "Is my capstone ready?"
- "Review my final work"

---

## Behavior

Run the following subskills **in sequence**, collecting each output:

1. **`capstone-critique-prd`** — Specification quality (Two-Developer Test, AC quality, data model)
2. **`capstone-critique-process`** — Process quality, decision quality, living documentation
3. **`capstone-critique-code`** — Implementation coverage, structure, runnability
4. **`capstone-critique-reflection`** — AI harnessing, reflection depth

After all four complete, aggregate into the final evaluation report:

---

## Aggregated Output Format

```markdown
# Capstone Evaluation — [Project Name]

**Date:** [today]
**Evaluated by:** capstone-critique

## Summary
[2–3 sentence overall assessment synthesizing all four subskill findings]

## Dimension Scores

| Dimension | Score | Key Evidence |
|-----------|-------|--------------|
| Specification Quality | Strong / Adequate / Weak | [one-line evidence from capstone-critique-prd] |
| Process Quality | Strong / Adequate / Weak | [from capstone-critique-process] |
| Decision Quality | Strong / Adequate / Weak | [from capstone-critique-process] |
| Living Documentation | Strong / Adequate / Weak | [from capstone-critique-process] |
| Implementation | Strong / Adequate / Weak | [from capstone-critique-code] |
| AI Harnessing | Strong / Adequate / Weak | [from capstone-critique-reflection] |
| Reflection Depth | Strong / Adequate / Weak | [from capstone-critique-reflection] |

## Strengths
[Bulleted list of specific things done well, drawn from all four subskill outputs]

## Areas for Growth
[Bulleted list of the top gaps across all dimensions — constructive, not critical]

## Notable Moments
[Any particularly impressive decisions, pivots, custom skills, or insights]

## Recommendation
[Overall readiness: Ready to demo / Nearly ready (address X first) / More work needed]
[Suggested next steps specific to the student's project and gaps]
```

---

## Selective Critique

Individual subskills can be run independently without the full orchestration:
- "Critique my PRD" → `capstone-critique-prd` only
- "Critique my process" → `capstone-critique-process` only
- "Critique my code" → `capstone-critique-code` only
- "Critique my reflection" → `capstone-critique-reflection` only

---

## Usage Notes

- Designed to be run by the **student** as self-assessment before the demo
- Can also be run by an **instructor** using the student's artifacts
- The dimension table gives the quick picture; detail is in each subskill output
- For instructor use: the evaluation guides grading conversation, not final grade

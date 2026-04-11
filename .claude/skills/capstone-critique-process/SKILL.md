---
name: capstone-critique-process
description: "Evaluates process quality, decision quality, and living documentation for the student's capstone. Reads project-brief.md + decision-log.md (~2-3K tokens). Safe for local models. Triggered by capstone-critique or when student says 'critique my process'."
---

# Capstone Critique — Process & Decisions

## Description
Evaluates process quality, decision quality, and living documentation. Reads the project brief and decision log. Looks for evidence of structured pipeline, meaningful reasoning, framework use, and document evolution. Safe for local models.

## Trigger Phrases
- "Critique my process"
- "Evaluate my decision log"
- Automatically triggered by `capstone-critique`

---

## Behavior

**Read (in this order):**
1. `planning/project-brief.md` — original vision and toolchain decisions
2. `planning/decision-log.md` — all entries from start to finish

**Write output to:** Return as inline response (not a file). `capstone-critique` aggregates all subskill outputs.

**Context budget:** Stay under 3K tokens of input. If decision-log.md is very long, read the first 3 and last 3 entries — they show starting point and final state.

---

## Evaluation

### Process Quality
Did the student follow a structured pipeline?
- Evidence of: brainstorm → spec → plan → build cycle
- Multiple sprint checkpoints (multiple dated decision log entries)
- Iteration — did the PRD evolve, or was it written once and never touched?
- **Strong:** 5+ log entries, clear pipeline progression, evidence of document updates
- **Adequate:** 3+ entries, basic pipeline, some iteration
- **Weak:** 0–2 entries, no evidence of iteration, one-shot approach

### Decision Quality
Are decisions well-reasoned?
- Do entries explain WHY, not just WHAT?
- Are trade-offs acknowledged?
- Do decision-making frameworks appear? (SWOT, MoSCoW, RICE, etc.)
- When new evidence contradicted a prior decision, did the student pivot?
- **Strong:** Frameworks applied, trade-offs discussed, pivots supported by evidence
- **Adequate:** Some rationale, brief explanations
- **Weak:** "I chose X" with no reasoning, no frameworks, no trade-offs

### Living Documentation
Did docs stay current?
- Do log entries mention updating PRD or brief?
- Does the final brief match what was actually built?
- Were stage guides regenerated when scope changed?
- **Strong:** Multiple update entries, docs reflect final state
- **Adequate:** Some updates noted, docs mostly current
- **Weak:** Docs appear static, log is sparse

---

## Output Format

```markdown
## Process Quality

**Score:** Strong / Adequate / Weak

**Pipeline evidence:** [What pipeline phases are visible in the log?]
**Decision log entries:** [Count] entries spanning [date range]

**Decision Quality Score:** Strong / Adequate / Weak
**Framework usage:** [Which frameworks were applied, if any]
**Best decision:** [Quote or summarize the most well-reasoned log entry]
**Weakest decision:** [The entry with least reasoning — what's missing?]

**Living Documentation Score:** Strong / Adequate / Weak
[Evidence of doc updates, or lack thereof]

**Top 3 Process Improvements:**
1. [Most important thing to improve]
2. [Second]
3. [Third]
```

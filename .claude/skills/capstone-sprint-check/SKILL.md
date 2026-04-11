---
name: capstone-sprint-check
description: "Scrum-style checkpoint for capstone projects. Demo what you built, test against acceptance criteria, update living docs, plan the next slice. Use when the student says 'sprint check', 'demo checkpoint', 'review what I built', or 'ready for next slice'."
---

# Capstone Sprint Check

## Description
Scrum-style checkpoint for capstone projects. Demo what you built, test against acceptance criteria, update living documentation, and plan the next slice. Maintains the self-learning loop by ensuring all docs stay current.

## Trigger Phrases
- "Sprint check"
- "Demo checkpoint"
- "What's my progress?"
- "Review what I've built so far"
- "Ready for next slice"

---

## Behavior

Run this at natural checkpoints — after completing a slice, finishing a feature, or when you want to pause and assess. This is NOT a grading moment. It's a reflection and planning tool.

---

## Flow

### Step 1: DEMO — What Did You Build?

Ask the student:
> "Show me what you just built. What's working? What can you demo right now?"

If the student has a running app:
- Ask them to walk through the new functionality
- Note what works and what doesn't
- Identify any surprises (things that work differently than expected)

If they don't have something running:
- What did they work on?
- What blocked them?
- What do they need to get unstuck?

### Step 2: TEST — Acceptance Criteria Check

Read the relevant `planning/prd/NN-*.md` section file for the current slice/feature (the slice task card references which PRD section it fulfills).

For each acceptance criterion:
> "Let's walk through your acceptance criteria one by one:"
> - AC 1: [criterion] — Pass / Fail / Partial?
> - AC 2: [criterion] — Pass / Fail / Partial?
> [Continue for each]

Record results. If any fail:
> "What's needed to get [failing AC] to pass? Is it a code issue or a spec issue?"

### Step 3: UPDATE — Living Documentation

Based on what was learned during the demo and testing:

**Check each document:**

> "Based on what we just saw, does anything need to change?"

- **planning/prd/NN-*.md** — Any acceptance criteria need rewriting in THIS feature's spec? Any new edge cases? (Update the specific section file + `prd-index.md` summary)
- **planning/slices/*.md** — Any task cards need updating? Any new slices needed? Any to cut? (Update specific cards + `implementation-plan.md` index)
- **planning/project-brief.md** — Any fundamental decisions changed? (stack, platform, audience, MVP scope?)

**For each change, update the document AND append to `planning/decision-log.md`:**

```markdown
## [Date] — Sprint Check After [Slice/Feature Name]

**Context:** Completed [what was built]. Sprint check revealed [key findings].

**What Changed:**
- [Document]: [What changed and why]
- [Document]: [What changed and why]

**Acceptance Criteria Results:**
- [N] passed, [N] failed, [N] partial

**Frameworks Applied:** [If any were used during discussion]

**What I Learned:** [Student fills in]
```

### Step 4: REGENERATE — Update Stage Guides (If Needed)

If scope or stack changed significantly:
> "Your [MVP scope / tech stack / feature set] changed. Let me regenerate your stage guides to match."

Invoke `capstone-stage-gen` to regenerate affected guides.

If nothing significant changed, skip this step.

### Step 5: PLAN NEXT — What's the Next Slice?

> "Looking at your implementation plan, the next slice is: [slice name/description]"
> "Does this still make sense as the next thing to build? Or should we reprioritize?"

If reprioritizing:
- Discuss what changed
- Update implementation-plan.md
- Log the decision

### Step 6: SKILL CHECK — Do You Need New Tools?

> "For the next phase, do you need any new skills or tools?"

Consider:
- Is the next slice in a new domain area?
- Did the student struggle with something that a skill could automate?
- Are there community skills that could help?

If yes, note the skill to create and suggest using Superpowers `writing-skills`.

---

## Quick Sprint Check (5-minute version)

For rapid checkpoints:
> "Quick check: (1) What works? (2) What doesn't? (3) What's next? (4) Anything blocking you?"

Update `planning/decision-log.md` with a brief entry. Skip doc regeneration unless something major changed.

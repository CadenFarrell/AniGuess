---
name: capstone-explore-guide
description: "Generates planning/stages/explore-guide.md for the student's specific project. Reads only project-brief.md and prd-index.md (~1.3K tokens). Safe for local models. Triggered by capstone-stage-gen or when student says 'regenerate my explore guide'."
---

# Capstone Explore Guide Generator

## Description
Generates a project-specific EXPLORE stage guide. Reads the minimal context needed (project brief + PRD index) and writes a single short, action-oriented guide. Safe for local models.

## Trigger Phrases
- "Generate my explore guide"
- "Regenerate my explore guide"
- Automatically triggered by `capstone-stage-gen`

---

## Behavior

**Read (in order, stop early if file doesn't exist):**
1. `planning/project-brief.md` — project name, stack, MVP features, toolchain
2. `planning/prd-index.md` — feature summaries (NOT the full `prd/` section files)

**Write:** `planning/stages/explore-guide.md`

**Rules:**
- SHORT — 15-25 bullet points total, not pages of text
- Every item is actionable: test this, ask this, try this, look at this
- Reference specific ecosystem skills by name (e.g., "Use gStack `/design-consultation`")
- Include actual copy-paste prompts the student can use
- Adapt entirely to the student's stack and domain — no generic advice

---

## Output Template

Fill in `[brackets]` from the project brief. Generate specific items per MVP feature — do not use generic placeholders in the final output.

```markdown
# EXPLORE Guide — [Project Name]

> Goal: Make sure your features are complete, your stack is solid, and your assumptions are correct before writing your PRD.

## Test Your Assumptions
- [ ] Ask your AI: "For a [project type] built with [stack], what are the 3 most common architectural mistakes beginners make?"
- [ ] Ask your AI: "Walk me through the data model for [core entity]. What relationships or constraints am I missing?"
- [ ] Try: Generate the [main component / screen / module] and review it. Does it match your mental model?
- [ ] Try: Ask for [key feature] implemented two different ways. Which fits your project better and why?

## Validate Each MVP Feature
[For EACH MVP feature listed in the project brief, generate one specific validation item:]
- [ ] **[Feature name]:** Ask your AI: "What edge cases does [feature] need to handle that I haven't specified yet?"
- [ ] **[Feature name]:** Can you describe exactly what happens when [specific user action]? If not, the spec is incomplete.
[Repeat for each feature — minimum one item per MVP feature]

## Explore Your Stack
- [ ] Ask your AI: "What are current best practices for [their framework/language] as of [current year]?"
- [ ] Experiment: Set up a minimal [stack] project and get the main screen / entry point running
- [ ] Look at: [One specific stack-appropriate thing — e.g., "the component tree" for React, "the scene graph" for a game, "the route handlers" for an API]
[Add 1-2 more stack-specific items based on their choices]

## Use Your Toolchain
[Only include tools relevant to their project:]
- [ ] [If web/UI:] Run gStack `/design-consultation` to generate a design system for your project
- [ ] [If any project:] Ask Superpowers brainstorming to review your feature list for scope risks
- [ ] [If applicable:] Search for [domain]-specific skills on ClawHub or skills.sh
- [ ] [If game:] Look for sprite/tilemap/physics skills relevant to your engine choice

## Update Your Docs
After exploring, update `planning/project-brief.md` with any decisions that changed, and append a new entry to `planning/decision-log.md` with what you learned.
```

---

## Regeneration

When regenerating (called after changes):
1. Read `planning/project-brief.md` and `planning/prd-index.md`
2. Note what changed since last generation (check decision log date on last entry)
3. Rewrite the guide to reflect the current state
4. Append to `planning/decision-log.md`: which guide was regenerated and why

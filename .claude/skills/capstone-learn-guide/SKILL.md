---
name: capstone-learn-guide
description: "Generates planning/stages/learn-guide.md for the student's specific project. Reads only project-brief.md and prd-index.md (~1.3K tokens). Safe for local models. Triggered by capstone-stage-gen or when student says 'regenerate my learn guide'."
---

# Capstone Learn Guide Generator

## Description
Generates a project-specific LEARN stage guide focused on building and validating the PRD and implementation plan. Reads minimal context and writes one short, action-oriented guide. Safe for local models.

## Trigger Phrases
- "Generate my learn guide"
- "Regenerate my learn guide"
- Automatically triggered by `capstone-stage-gen`

---

## Behavior

**Read (in order, stop early if file doesn't exist):**
1. `planning/project-brief.md` — project name, stack, MVP features, toolchain
2. `planning/prd-index.md` — feature summaries (NOT the full `prd/` section files)

**Write:** `planning/stages/learn-guide.md`

**Rules:**
- SHORT — 15-25 bullet points total
- Every item is actionable: validate this, ask this, write this, check this
- Focus on spec quality and plan correctness, not building
- Generate feature-specific validation prompts from the actual MVP feature list
- Adapt to the student's domain and stack

---

## Output Template

Fill in `[brackets]` from the project brief. Generate specific items per MVP feature.

```markdown
# LEARN Guide — [Project Name]

> Goal: Turn your project brief into an airtight PRD and a build plan you can actually execute.

## Build Your PRD
- [ ] Use Superpowers brainstorming: "Help me turn this project brief into a full PRD. Decompose it into `planning/prd-index.md` (summaries) and one `planning/prd/NN-[feature].md` file per MVP feature."
- [ ] For each `planning/prd/*.md` file, write acceptance criteria. Test: "Could two developers implement this identically?"
- [ ] Ask your AI: "Apply the Two-Developer Test to this feature spec. List every decision that's undefined: [paste feature spec]"
- [ ] Ask your AI: "What validation rules does [core entity] need? Give specific edge cases — empty input, max length, invalid format."

## Validate Each Feature Spec
[For EACH MVP feature, generate one validation prompt:]
- [ ] **[Feature name]:** Ask: "What error states can occur in [feature]? What should the user see for each one?"
- [ ] **[Feature name]:** Ask: "Is the acceptance criteria for [feature] testable? How would I verify it passes?"
[Repeat for each feature]

## Validate Your Data Model
- [ ] Ask your AI: "Review my data model for [project]. Are there missing relationships, missing constraints, or fields that should have types specified?"
- [ ] Ask your AI: "What happens to [related entity] when I delete [core entity]? Is that handled?"
- [ ] [If applicable:] Ask your AI: "What indexes does this data model need for good query performance?"

## Plan Your Build
- [ ] Use Superpowers writing-plans: "Decompose this PRD into vertical implementation slices. Output `planning/implementation-plan.md` as an index and one `planning/slices/slice-NN-[name].md` task card per slice."
- [ ] Verify: Each slice task card is self-contained — has context, what to build, acceptance criteria, dependencies, done-when
- [ ] Verify: Each slice is independently demoable
- [ ] Verify: Slice 01 is the absolute minimum — hardcoded data, basic display, zero dependencies
- [ ] [If applicable:] Ask your AI: "What are the dependencies between these slices? Which must come first?"

## Create Domain Skills
- [ ] What [domain]-specific skill would speed up your implementation? (e.g., a sprite creator, a form generator, a SQL schema builder)
- [ ] Use Superpowers writing-skills to create it
- [ ] [Suggest 1-2 specific skills based on their chosen domain]

## Update Your Docs
After validation, update the relevant `planning/prd/*.md` files and `planning/prd-index.md`, then append to `planning/decision-log.md` with any spec decisions that changed.
```

---

## Regeneration

When regenerating:
1. Read `planning/project-brief.md` and `planning/prd-index.md`
2. Rewrite to reflect current spec state
3. Append to `planning/decision-log.md`: guide regenerated, reason

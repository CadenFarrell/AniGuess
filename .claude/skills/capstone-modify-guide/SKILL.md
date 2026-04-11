---
name: capstone-modify-guide
description: "Generates planning/stages/modify-guide.md for the student's specific project. Reads only project-brief.md and prd-index.md (~1.3K tokens). Safe for local models. Triggered by capstone-stage-gen or when student says 'regenerate my modify guide'."
---

# Capstone Modify Guide Generator

## Description
Generates a project-specific MODIFY stage guide focused on stretch features, refinement, and making the demo impressive. Reads minimal context and writes one short, action-oriented guide. Safe for local models.

## Trigger Phrases
- "Generate my modify guide"
- "Regenerate my modify guide"
- "What should I add next?"
- Automatically triggered by `capstone-stage-gen`

---

## Behavior

**Read (in order, stop early if file doesn't exist):**
1. `planning/project-brief.md` — project name, stack, MVP features, stretch goals, exclusions
2. `planning/prd-index.md` — feature summaries (NOT full section files)

**Write:** `planning/stages/modify-guide.md`

**Rules:**
- SHORT — 15-25 bullet points total
- Focus on what comes AFTER MVP ships — stretch features, polish, demo impact
- Generate project-specific suggestions, not generic "add more features" advice
- Reference stretch goals from the project brief if they exist
- Adapt to the student's domain — a game needs different polish than a REST API

---

## Output Template

Fill in `[brackets]` from the project brief. Be specific about their domain and stack.

```markdown
# MODIFY Guide — [Project Name]

> Goal: MVP is defined. Now think about what makes this demo-worthy — and build the stretch features that matter most.

## Brainstorm Beyond MVP
- [ ] Ask your AI: "Given a [project type] that does [brief description], what features would make users say 'wow' vs just 'okay'?"
- [ ] Ask your AI: "Here are my Should Have / Could Have features: [list from project brief]. Apply [RICE / MoSCoW / Impact-Effort] to rank them."
- [ ] Decide: What is the ONE stretch feature that would make your demo most impressive?
[Add 1-2 domain-specific brainstorm items]

## Refine What You Have
- [ ] Ask your AI: "How could I improve the UX / usability of [weakest or most complex MVP feature]?"
[Pick 2-3 refinement items specific to their domain:]
- [ ] [If UI/web:] Ask: "Suggest 3 micro-interactions that would make [feature] feel polished and responsive"
- [ ] [If game:] Ask: "What visual or audio feedback would make [core mechanic] feel satisfying?"
- [ ] [If data/API:] Ask: "What visualizations or summaries would make this data more useful to the user?"
- [ ] [If CLI:] Ask: "How could I improve the output formatting and error messages to feel professional?"
- [ ] Look at: 2-3 similar apps or tools — what do they do well that you could adapt (not copy)?

## Plan v1.5
- [ ] Pick 2-3 stretch features to add after MVP ships
- [ ] Write brief acceptance criteria for each (one sentence each — testable)
- [ ] Add each as a new `planning/prd/NN-[feature].md` file and update `planning/prd-index.md`
- [ ] Add corresponding slice task cards in `planning/slices/`

## Level Up Your Toolchain
- [ ] What custom skill would help build your stretch features? Create it with Superpowers writing-skills.
- [ ] Search ClawHub / skills.sh for [domain]-specific community skills you haven't tried yet
[Add 1-2 tool suggestions specific to their project type:]
- [ ] [If web:] Try gStack `/qa` for browser-based testing of your UI
- [ ] [If any:] Try gStack `/cso` for a lightweight security audit
- [ ] [If data-heavy:] Ask your AI to suggest a caching or performance improvement

## Update Your Docs
Add stretch features as new `planning/prd/*.md` section files, update `planning/prd-index.md` with summaries, and append to `planning/decision-log.md` with your stretch feature decisions and rationale.
```

---

## Regeneration

When regenerating:
1. Read `planning/project-brief.md` and `planning/prd-index.md`
2. Note current progress — what stretch features have been added since last generation?
3. Rewrite to reflect what's been built vs what remains
4. Append to `planning/decision-log.md`: guide regenerated, reason

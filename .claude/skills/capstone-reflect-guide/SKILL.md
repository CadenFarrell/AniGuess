---
name: capstone-reflect-guide
description: "Generates planning/stages/reflect-guide.md for the student's specific project. Reads only project-brief.md and prd-index.md (~1.3K tokens). Safe for local models. Triggered by capstone-stage-gen or when student says 'regenerate my reflect guide'."
---

# Capstone Reflect Guide Generator

## Description
Generates a project-specific REFLECT stage guide focused on process reflection, demo preparation, and final report drafting. Reads minimal context and writes one short, action-oriented guide. Safe for local models.

## Trigger Phrases
- "Generate my reflect guide"
- "Regenerate my reflect guide"
- "Help me prepare for my demo"
- Automatically triggered by `capstone-stage-gen`

---

## Behavior

**Read (in order, stop early if file doesn't exist):**
1. `planning/project-brief.md` — project name, goals, stack, toolchain choices
2. `planning/prd-index.md` — feature summaries

**Write:** `planning/stages/reflect-guide.md`

**Rules:**
- SHORT — 15-25 bullet points total
- Focus on process reflection, not just describing what was built
- Generate demo talking points specific to their project domain
- Reference their actual toolchain choices in reflection prompts
- The report section should connect to their specific decisions and pivots

---

## Output Template

Fill in `[brackets]` from the project brief.

```markdown
# REFLECT Guide — [Project Name]

> Goal: Step back from the code. Understand what you built, how you built it, and what you learned about the process of software development.

## Review Your Journey
- [ ] Read `planning/decision-log.md` from start to finish — all entries, in order
- [ ] Count your pivots. What caused each one? New information? A failed experiment? A sprint demo?
- [ ] Which decisions were easy? Which were hard? Can you articulate why?
- [ ] What did you learn about [their domain] that you didn't know when you started?
- [ ] What's the biggest gap between what you planned and what you shipped? Why did it happen?

## Evaluate Your AI Workflow
- [ ] Which tools from your toolchain were most valuable? Rank your top 3 with a sentence explaining why each.
- [ ] [Reference their specific toolchain items:] How did you use [tool from their stack]? What worked? What didn't?
- [ ] Did you create custom skills? Were they worth building? What would you improve?
- [ ] Which prompting patterns produced the best results for [their domain]?
- [ ] What would you do differently with your AI workflow if you started over?

## Prepare Your Demo
- [ ] Identify: What's the ONE thing you most want to show? What moment makes the project feel real?
- [ ] Practice: Can you explain your overall architecture in 2 minutes without jargon?
- [ ] Practice: Pick one decision from your decision log — can you explain what you decided, why, and what you learned?
- [ ] [Domain-specific demo tip — e.g., for a game: "Show the core game loop, not the menus"; for a web app: "Show a complete user flow, not individual screens"]
- [ ] Prepare for: "What would you build next if you had more time?"

## Draft Your Final Report
Your report should tell the story of HOW you built this, not just WHAT you built.

Cover these sections (in your own words — not a template):
- [ ] **Vision:** What you set out to build and why (from `planning/project-brief.md`)
- [ ] **Evolution:** How your thinking changed — at least 3 specific pivots or learnings (from `planning/decision-log.md`)
- [ ] **Specification:** How you approached the PRD — what frameworks you used and why they helped
- [ ] **Build approach:** How you broke work into slices, how sprint checkpoints changed your direction
- [ ] **AI workflow:** Which ecosystems and skills you used, what you created, what you'd recommend to another student
- [ ] **What I'd do differently:** Honest reflection on process, tooling, and decisions

## Run Self-Assessment
- [ ] Use `capstone-critique` to get an AI evaluation of all your deliverables
- [ ] Read it carefully — do you agree? Where do you disagree and why?
- [ ] Address any Weak ratings before your demo
- [ ] Note: the critique is a conversation starter, not a final grade
```

---

## Regeneration

When regenerating:
1. Read `planning/project-brief.md` and `planning/prd-index.md`
2. Update demo talking points to reflect what was actually built
3. Append to `planning/decision-log.md`: guide regenerated, reason

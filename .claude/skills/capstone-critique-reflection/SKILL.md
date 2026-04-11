---
name: capstone-critique-reflection
description: "Evaluates AI harnessing and reflection depth for the student's capstone. Reads skills/ directory + reflect-guide.md + final report if present (~2K tokens). Safe for local models. Triggered by capstone-critique or when student says 'critique my reflection'."
---

# Capstone Critique — AI Harnessing & Reflection

## Description
Evaluates how effectively the student harnessed AI tools and the depth of their process reflection. Reads the skills directory, reflect guide, and final report. Safe for local models.

## Trigger Phrases
- "Critique my reflection"
- "Evaluate my AI workflow"
- Automatically triggered by `capstone-critique`

---

## Behavior

**Read (in this order):**
1. `skills/` directory listing — what custom skills did they create?
2. `planning/stages/reflect-guide.md` — what reflection was suggested
3. `planning/project-brief.md` — what toolchain they planned to use (ecosystem section)
4. Final report if present (`planning/report.md` or similar) — look for process reflection

**Write output to:** Return as inline response (not a file). `capstone-critique` aggregates all subskill outputs.

**Context budget:** Stay under 2K tokens of input. Skim the report for process reflection — don't read every word.

---

## Evaluation

### AI Harnessing
How effectively did the student use AI tools?
- Which ecosystems did they install? (Superpowers, gStack, etc.)
- Did they create custom domain-specific skills? How many? How sophisticated?
- Evidence of workflow sophistication (not just basic prompting)
- Did they use the right tools for the right jobs?
- **Strong:** Multiple ecosystems used + custom skills created + clear workflow rationale
- **Adequate:** Superpowers used for planning + some skill usage + basic workflow
- **Weak:** Minimal tool usage, no custom skills, basic prompt-and-paste

### Reflection Depth
Does the reflection show genuine learning about PROCESS?
- Does it describe what was built, or WHY things were done certain ways?
- Can the student articulate what they'd do differently?
- Do they understand why specific tools/approaches worked or didn't?
- Is there connection between their experience and broader software development principles?
- **Strong:** Insightful process reflections, specific lessons with examples, clear articulation of changes
- **Adequate:** Some process reflection, general lessons learned
- **Weak:** Describes what was built without reflecting on why or what was learned

---

## Output Format

```markdown
## AI Harnessing

**Score:** Strong / Adequate / Weak

**Ecosystems used:** [List what they actually used]
**Custom skills created:** [N skills] — [names and brief description of each]
**Workflow sophistication:** [Assessment with specific evidence]
**Best tool usage example:** [Most impressive use of an AI tool]
**Missed opportunity:** [Tool or skill they could have used but didn't]

## Reflection Depth

**Score:** Strong / Adequate / Weak

**Process vs description ratio:** [Is the reflection mostly "I built X" or mostly "I learned Y about process"?]
**Strongest insight:** [Quote or summarize the most insightful reflection]
**What's missing:** [What would make the reflection stronger?]

**Top 3 Reflection Improvements:**
1. [Most important gap in reflection]
2. [Second]
3. [Third]
```

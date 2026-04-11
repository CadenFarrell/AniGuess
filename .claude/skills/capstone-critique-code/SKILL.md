---
name: capstone-critique-code
description: "Evaluates implementation quality for the student's capstone. Reads implementation-plan.md + scans src/ structure + reads 1-2 slice task cards (~2-3K tokens). Safe for local models. Triggered by capstone-critique or when student says 'critique my code'."
---

# Capstone Critique — Implementation

## Description
Evaluates implementation quality by scanning the source code structure and checking implementation against the plan. Does NOT read all source files — scans structure and samples key files. Safe for local models.

## Trigger Phrases
- "Critique my code"
- "Evaluate my implementation"
- Automatically triggered by `capstone-critique`

---

## Behavior

**Read (in this order):**
1. `planning/implementation-plan.md` — slice index, what was planned
2. `planning/slices/slice-01-*.md` — first slice (baseline feature)
3. List `src/` directory structure (do NOT read all files — just the tree)
4. Read 1–2 key source files (the entry point and the most complex module — judge from the tree)

**Write output to:** Return as inline response (not a file). `capstone-critique` aggregates all subskill outputs.

**Context budget:** Stay under 3K tokens of input. Prioritize breadth (structure scan) over depth (full file reads).

---

## Evaluation

### PRD vs Implementation Alignment
How many MVP features are actually implemented?
- Check each slice in the plan — is there corresponding code?
- **Strong:** All MVP features implemented
- **Adequate:** Most MVP features implemented (≥70%)
- **Weak:** Few MVP features present (<70%)

### Code Structure
Is the code organized?
- Is it split into logical files/modules (not one giant file)?
- Does it follow conventions for the chosen stack?
- Are concerns separated (data, logic, UI)?
- **Strong:** Well-organized, follows stack conventions, clear structure
- **Adequate:** Mostly organized, minor structure issues
- **Weak:** One giant file or no clear structure

### Does It Run?
Signs the code works (or doesn't):
- Is there an entry point that makes sense?
- Are there obvious syntax or import issues visible from structure?
- Are there test files or README instructions for running?

### Stack Conventions
Does the code follow patterns appropriate for the chosen language/framework?
- e.g., React components follow hooks pattern; Python uses proper modules; C# uses classes

---

## Output Format

```markdown
## Implementation Quality

**Score:** Strong / Adequate / Weak

**MVP Feature Coverage:** [N of M] MVP features appear implemented
[List which features are present and which are missing]

**Code Structure:** [Well-organized / Mostly organized / Disorganized]
[Describe the structure — number of files, key modules, separation of concerns]

**Stack Convention Adherence:** [Follows conventions / Minor issues / Not following conventions]
[Note specific examples]

**Runnability Assessment:** [Likely runnable / Uncertain / Issues visible]
[What's the entry point? Any obvious issues?]

**Top 3 Implementation Improvements:**
1. [Most important structural or completeness issue]
2. [Second]
3. [Third]
```

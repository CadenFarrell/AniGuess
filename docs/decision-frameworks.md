# Decision Frameworks Reference

## Decision-Making Frameworks for Software Projects

---

## SWOT Analysis

**Use when:** Evaluating any idea, spec, or decision — especially market-facing projects

```
┌─────────────────────────────────┬─────────────────────────────────┐
│         STRENGTHS               │          WEAKNESSES             │
│         (Internal +)            │          (Internal -)           │
├─────────────────────────────────┼─────────────────────────────────┤
│ What's good about this idea?    │ What's missing or vague?        │
│ What's clear and testable?      │ What could be misinterpreted?   │
│ What decisions are well-made?   │ What assumptions are hidden?    │
└─────────────────────────────────┴─────────────────────────────────┘
┌─────────────────────────────────┬─────────────────────────────────┐
│         OPPORTUNITIES           │           THREATS               │
│         (External +)            │          (External -)           │
├─────────────────────────────────┼─────────────────────────────────┤
│ What could be improved easily?  │ What could cause failure?       │
│ What enhancements add value?    │ What risks aren't addressed?    │
│ What's the growth potential?    │ What dependencies are fragile?  │
└─────────────────────────────────┴─────────────────────────────────┘
```

**Example:** Building a recipe-sharing web app
- **Strengths:** Clear target audience, well-understood data model
- **Weaknesses:** Image hosting costs undefined, no auth plan
- **Opportunities:** Mobile-first design could set it apart
- **Threats:** Competing apps (Allrecipes, etc.) already exist

**Prompt:**
```
Apply SWOT analysis to this project idea:
[DESCRIBE PROJECT]
Be specific about weaknesses and threats to success.
```

---

## Inversion Thinking (Pre-Mortem)

**Use when:** Finding gaps and risks before they become problems

**The Question:**
> "It's 3 months from now and this project failed completely. Why? What was missing from the spec that caused the failure?"

**How it works:**
1. Assume failure has already happened
2. Work backwards to identify causes
3. Address those causes NOW

**Common failure causes to check:**
- Undefined edge cases
- Missing error handling
- Unclear acceptance criteria
- Scope creep opportunities
- Untested assumptions
- Missing data validation

**Example:** A task management CLI tool
- "I didn't define what happens when two tasks have the same name"
- "I assumed the user always has write access to the data file"
- "I never specified what 'done' looks like — just deleted? archived?"

**Prompt:**
```
Use inversion thinking on this specification:
[PASTE SPEC]

The project failed 3 months from now. What went wrong?
What was missing from the spec that caused the failure?
```

---

## 5 Whys

**Use when:** Finding the REAL requirement behind a feature request

**How it works:**
Keep asking "Why?" until you reach the core value (usually 5 times)

**Example:**
```
Feature request: "Users can search by tag"

Why do users need tag search?
→ To find content quickly

Why do they need to find content quickly?
→ They have a lot of items and scrolling is slow

Why is scrolling slow?
→ There's no filtering or organization

Why is filtering important?
→ Users want to find relevant items without distraction

Why do they care about relevance?
→ CORE VALUE: Users want to feel in control and efficient
```

**The insight:** We're not just building tag search — we're building a navigation system that reduces cognitive load. This might mean full-text search, filters, or smart sorting is more valuable than tags alone.

**Prompt:**
```
Apply 5 Whys to this feature: [FEATURE NAME]
Keep asking "Why?" until you find the core value being delivered.
```

---

## MoSCoW Prioritization

**Use when:** Scoping any project, especially for MVP or time-boxed work

```
┌─────────────────────────────────────────────────────────────────┐
│  MUST HAVE (M)                                                  │
│  ─────────────────────────────────────────────────────────────  │
│  • App doesn't work without this                                │
│  • Non-negotiable for launch                                    │
│  • If cut, there's no product                                   │
│                                                                 │
│  Examples: Core data display, primary action, basic persistence │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  SHOULD HAVE (S)                                                │
│  ─────────────────────────────────────────────────────────────  │
│  • Important but app functions without it                       │
│  • High priority for user satisfaction                          │
│  • Plan to include, but can delay if needed                     │
│                                                                 │
│  Examples: Edit/delete, sorting, basic filtering                │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  COULD HAVE (C)                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  • Nice to have                                                 │
│  • Only if time permits                                         │
│  • Won't impact launch if missing                               │
│                                                                 │
│  Examples: Statistics, themes, export, keyboard shortcuts       │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  WON'T HAVE (W)                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  • Explicitly out of scope                                      │
│  • Not this version/release                                     │
│  • May consider for future                                      │
│                                                                 │
│  Examples: Cloud sync, social features, AI integration, mobile  │
└─────────────────────────────────────────────────────────────────┘
```

**Prompt:**
```
Categorize these features using MoSCoW for a 2-week MVP:
[LIST OF FEATURES]

For each, explain WHY it belongs in that category.
```

---

## Weighted Decision Matrix

**Use when:** Comparing 2+ options (tech stacks, hosting providers, frameworks, approaches)

**How it works:**
1. List the options you're comparing
2. Define criteria that matter for your project
3. Assign weights to each criterion (total = 100%)
4. Score each option on each criterion (1–5)
5. Multiply score × weight, sum per option
6. Highest score wins — but review for gut-check

**Example:** Choosing between React and Svelte for a dashboard project

| Criterion | Weight | React | Svelte |
|-----------|--------|-------|--------|
| Team familiarity | 40% | 5 | 2 |
| Bundle size | 20% | 3 | 5 |
| Ecosystem/libraries | 25% | 5 | 3 |
| Learning investment | 15% | 3 | 4 |
| **Weighted Total** | | **4.1** | **3.1** |

React wins — mostly because of existing familiarity, which was weighted highest.

**Key insight:** The weights reveal your actual priorities. If you weigh "learning investment" heavily, you'll get a different answer than if you weigh "ecosystem" heavily.

**Prompt:**
```
Help me build a Weighted Decision Matrix to choose between:
[OPTION A] vs [OPTION B]

For my project: [DESCRIBE PROJECT CONTEXT]
Suggest 4-6 criteria, recommend weights, then score each option.
```

---

## RICE Scoring

**Use when:** Ranking features by value when you have many candidates

**Formula:** `RICE Score = (Reach × Impact × Confidence) / Effort`

| Factor | What It Measures | Scale |
|--------|-----------------|-------|
| **Reach** | How many users affected per month | # of users |
| **Impact** | How much it moves the needle | 0.25 (minimal) to 3 (massive) |
| **Confidence** | How sure are you? | % (0.5 = 50%, 1.0 = 100%) |
| **Effort** | Person-months to build | Months |

**Example:** Prioritizing features for a study tool

| Feature | Reach | Impact | Confidence | Effort | RICE |
|---------|-------|--------|------------|--------|------|
| Flashcard review | 500 | 2 | 0.9 | 1 | **900** |
| Progress charts | 500 | 1 | 0.7 | 2 | **175** |
| Spaced repetition | 500 | 3 | 0.6 | 3 | **300** |
| Social study groups | 200 | 2 | 0.5 | 4 | **50** |

**Insight:** Flashcard review has the highest RICE score — high reach, solid impact, confident estimate, low effort. Social study groups score last despite potential impact because effort is high and confidence is low.

**Prompt:**
```
Apply RICE scoring to these features for my project:
[LIST FEATURES]

Project context: [DESCRIBE PROJECT AND USER BASE]
For each feature, estimate Reach (users/month), Impact (0.25–3),
Confidence (%), and Effort (months). Show the RICE score calculation.
```

---

## Impact/Effort Matrix

**Use when:** Quick triage of a feature list into 4 quadrants

```
         LOW EFFORT          HIGH EFFORT
         ┌──────────────────┬──────────────────┐
HIGH     │  QUICK WINS  ⭐  │  BIG BETS  🎯    │
IMPACT   │  Do these first  │  Plan carefully  │
         │  High ROI        │  Could be worth  │
         │                  │  it if core      │
         ├──────────────────┼──────────────────┤
LOW      │  FILL-INS  📋    │  TIME SINKS  ❌  │
IMPACT   │  Do if you have  │  Avoid — high    │
         │  spare time      │  cost, low gain  │
         └──────────────────┴──────────────────┘
```

**How to use it:**
1. List all proposed features
2. For each, estimate: high or low impact? high or low effort?
3. Plot into the grid
4. Prioritize: Quick Wins → Big Bets (if core) → Fill-Ins → avoid Time Sinks

**Example for a weather app:**
- **Quick Win:** Display current temperature (low effort, high impact)
- **Big Bet:** 7-day forecast with animated radar (high effort, high impact — only if it's the main value)
- **Fill-In:** Celsius/Fahrenheit toggle (low effort, low impact)
- **Time Sink:** Custom background art per condition (high effort, low impact — cut it)

**Prompt:**
```
Sort these features into an Impact/Effort Matrix for my project:
[LIST FEATURES]

For each, classify as High/Low on both Impact and Effort.
Explain your reasoning. Which quadrant does each belong in?
```

---

## Eisenhower Matrix (Urgent/Important)

**Use when:** Managing your own time and task priorities within a project

```
              URGENT              NOT URGENT
         ┌──────────────────┬──────────────────┐
IMPORTANT│   DO NOW  🔥     │   SCHEDULE  📅    │
         │  Crisis, deadlines│ Planning, learning│
         │  Broken builds   │ Architecture      │
         │  Demo blockers   │ Stretch features  │
         ├──────────────────┼──────────────────┤
NOT      │  DELEGATE  📤    │   ELIMINATE  🗑️  │
IMPORTANT│  (or do quick)   │  Busywork, low   │
         │  Some emails     │  value tweaks    │
         │  Minor bug fixes │  Gold-plating    │
         └──────────────────┴──────────────────┘
```

**Project example:**
- **Do Now:** Sprint demo is tomorrow and auth is broken
- **Schedule:** Refactor the data layer before it causes bugs
- **Delegate/Quick:** Update README, fix a minor style issue
- **Eliminate:** Adding Easter eggs before MVP ships

**Prompt:**
```
Apply the Eisenhower Matrix to my current task list:
[LIST TASKS]

Context: [DESCRIBE CURRENT PHASE AND DEADLINE]
Sort into Do Now / Schedule / Delegate / Eliminate.
```

---

## Quick Decision Matrix

| Situation | Use This Framework |
|-----------|-------------------|
| Evaluating a project idea or spec | SWOT |
| Finding hidden risks before they hit | Inversion Thinking |
| Understanding real requirements behind features | 5 Whys |
| Scoping MVP / prioritizing feature list | MoSCoW |
| Choosing between 2+ technologies or approaches | Weighted Decision Matrix |
| Ranking many features by value | RICE Scoring |
| Quick triage of a feature list | Impact/Effort Matrix |
| Managing your own time and task order | Eisenhower Matrix |
| Arguing for/against a feature | 5 Whys + MoSCoW |
| Full spec review | SWOT + Inversion |

---

## Combined Analysis Prompt

For thorough project planning, combine frameworks:

```
Analyze this project plan using multiple frameworks:

[PASTE PROJECT BRIEF OR FEATURE LIST]

1. **SWOT Analysis:**
   - Strengths (what's solid)
   - Weaknesses (what's missing/vague)
   - Opportunities (easy improvements)
   - Threats (failure risks)

2. **Inversion:**
   - Assume the project failed in 3 months
   - What caused the failure?
   - What's missing that would prevent it?

3. **5 Whys:**
   - For the core feature, ask why 5 times
   - What's the real value being delivered?

4. **MoSCoW Check:**
   - Are priorities clearly defined?
   - Is the Must Have list truly minimal?
   - Are Won't Haves explicit?

5. **Impact/Effort Quick Triage:**
   - Which features are quick wins?
   - Which are time sinks to cut?

Provide specific, actionable improvements for each issue found.
```

---

## Beyond Software

These frameworks apply everywhere:

| Framework | Life Application |
|-----------|-----------------|
| **SWOT** | College/job decisions, evaluating a big purchase |
| **Inversion** | Career planning ("What would make this fail?") |
| **5 Whys** | Personal goals ("Why do I really want this?") |
| **MoSCoW** | Trip planning, event planning, budgeting |
| **Weighted Decision Matrix** | Choosing between job offers, apartments, schools |
| **RICE** | Deciding what to learn next, side project prioritization |
| **Impact/Effort** | Weekly planning, deciding what to tackle first |
| **Eisenhower** | Daily productivity, preventing burnout |

---

*Decision Frameworks Reference v2.0 — Capstone Project*

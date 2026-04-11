# Specification Quality Reference

## How to Recognize Bad Specs (and Fix Them)

---

## The Golden Test

> **Can two developers independently implement this spec and produce functionally identical behavior?**

If yes → Executable spec ✅
If no → Needs more work ❌

---

## Smell #1: Vague Requirements

**Symptoms:**
- Words like "fast", "nice", "good", "user-friendly"
- No numbers or measurable criteria
- Subjective terms without definition

**Examples:**

| ❌ Vague | ✅ Executable |
|----------|--------------|
| "App should be fast" | "Item list loads in ≤500ms with 100 records on a mid-range device" |
| "Make it look nice" | "Use the project's design system: primary color #2196F3, 16px body text, 8px border radius" |
| "Handle errors gracefully" | "Network errors: show toast 'Unable to save. Changes saved locally.' with a retry button" |
| "User-friendly interface" | "All primary actions reachable in ≤2 taps/clicks from the main screen" |

**Fix prompt:**
```
This requirement is vague: "[REQUIREMENT]"
Rewrite it with specific, measurable criteria that two developers
would implement identically.
```

---

## Smell #2: Missing Acceptance Criteria

**Symptoms:**
- Feature listed without conditions for "done"
- No way to test if requirement is met
- "It should work" syndrome

**Examples:**

| ❌ No AC | ✅ With AC |
|----------|-----------|
| "User can add an item" | AC1: Tap/click '+' shows add form. AC2: Name field required, 1–50 chars. AC3: Empty submit shows "Name required" error. AC4: Valid submit adds item to list and closes form. AC5: New item appears at bottom of list. |
| "Show search results" | AC1: Results appear within 300ms of last keystroke. AC2: Matching text is highlighted. AC3: Zero results shows "No matches found." AC4: Results ordered by relevance (exact match first). |

**Fix prompt:**
```
This feature has no acceptance criteria: "[FEATURE]"
Write 3-5 testable acceptance criteria.
Each should be verifiable by running the app.
```

---

## Smell #3: Assumed Knowledge

**Symptoms:**
- References to undefined behavior
- "Handle the usual edge cases"
- Assumes reader knows the domain

**Examples:**

| ❌ Assumed | ✅ Explicit |
|-----------|-----------|
| "Display items in the usual order" | "Display items ordered by: (1) pinned first, (2) then by creation date descending" |
| "Standard validation" | "Name: required, 1–50 chars, trimmed whitespace. Empty → 'Required'. Too long → 'Max 50 characters'" |
| "Handle offline mode" | "Offline: queue changes locally. On reconnect: sync in order received. Conflict: server wins, notify user with 'Your changes were updated'" |

**Fix prompt:**
```
This spec assumes knowledge: "[TEXT]"
Make all assumptions explicit.
Define every "standard" or "usual" behavior precisely.
```

---

## Smell #4: Scope Ambiguity

**Symptoms:**
- No "out of scope" section
- Every feature seems equally important
- No version/phase markers
- "And also..." creep

**Examples:**

| ❌ Ambiguous | ✅ Bounded |
|-------------|----------|
| "Build a task manager" | "Build a task manager v1.0. In scope: create/complete/delete tasks, local persistence. Out of scope: cloud sync, sharing, reminders, subtasks." |
| "Add authentication" | "v1.0: local only, no auth required. v2.0: optional cloud backup with email/password auth." |
| "Make it work on mobile" | "v1.0: desktop web only. Responsive layout is a Could Have, not a Must Have." |

**Fix prompt:**
```
This spec has unclear scope boundaries.
Create explicit "In Scope v1.0" and "Out of Scope v1.0" sections.
For each exclusion, briefly explain why it's deferred.
```

---

## Smell #5: Undeclared Data Model

**Symptoms:**
- Features reference data without defining it
- Types, constraints, relationships unclear
- "Store the information" without structure

**Examples:**

| ❌ Undefined | ✅ Defined |
|-------------|----------|
| "Track items" | `Item: { id: UUID, name: string(1-50), createdAt: DateTime, isArchived: boolean }` |
| "Store user preferences" | `Settings: { theme: enum('light','dark','system'), language: string, notificationsEnabled: boolean }` |
| "Remember connections" | `Follow: { followerId: UUID (FK→User), followedId: UUID (FK→User), createdAt: DateTime }` |

**Fix prompt:**
```
This spec references data without defining structure.
Create a data model with:
- Entity name
- Properties with types and constraints
- Relationships (1:1, 1:N, N:N)
- Required vs optional
- Default values
```

---

## Smell #6: Untestable Statements

**Symptoms:**
- Can't write a test for the requirement
- Success is subjective
- "Should feel intuitive"

**The test:** Can you write "Given... When... Then..." for it?

**Examples:**

| ❌ Untestable | ✅ Testable |
|--------------|-----------|
| "App should feel responsive" | "Given: 200 items. When: user scrolls the list. Then: scrolling stays at 60fps with no visible jank." |
| "Intuitive onboarding" | "Given: new user, first launch. When: complete onboarding flow. Then: user has created their first item in ≤60 seconds." |
| "Smooth animations" | "Given: item is completed. When: user taps the checkbox. Then: checkmark animates in over 200ms with ease-out curve." |

**Fix prompt:**
```
This requirement is untestable: "[REQUIREMENT]"
Rewrite as a Given-When-Then statement that can be verified.
```

---

## Smell #7: Missing Edge Cases

**Symptoms:**
- Only happy path described
- No mention of empty states
- Error scenarios ignored
- Boundary conditions undefined

**Common edge cases to check:**

| Area | Edge Cases |
|------|------------|
| **Lists** | Empty (0 items), Single (1 item), Many (100+ items), at max limit |
| **Text input** | Empty, whitespace only, min length, max length, special characters, emoji |
| **Dates/Times** | Today, yesterday, far past, timezone changes, daylight saving |
| **Network** | Offline, slow connection, timeout, partial failure |
| **State** | First launch, after app update, corrupted data, concurrent edits |
| **Permissions** | Not granted, revoked mid-session, degraded access |

**Fix prompt:**
```
Review this spec for missing edge cases:
[SPEC]

For each feature, list edge cases that need acceptance criteria:
- Empty/zero states
- Boundary conditions
- Error scenarios
- Concurrent or timing issues
```

---

## Smell #8: Feature Soup

**Symptoms:**
- Everything listed with equal weight
- No prioritization
- No implementation order
- "And also" bullet points

**Example:**

❌ **Feature soup:**
```
- View list of items
- Add an item
- Delete an item
- Search
- Filter by category
- Sort options
- Export to CSV
- Dark mode
- Notifications
- Cloud backup
- Social sharing
```

✅ **Prioritized:**
```
Must Have (MVP):
- View list of items    (core value)
- Add an item          (core interaction)
- Delete an item       (basic CRUD)

Should Have:
- Search              (usability at scale)
- Filter by category  (organization)

Could Have:
- Sort options        (nice to have)
- Dark mode           (preference)

Won't Have v1.0:
- Export to CSV       (complexity vs. value)
- Cloud backup        (infrastructure cost)
- Social sharing      (scope creep)
- Notifications       (separate permissions flow)
```

**Fix prompt:**
```
Prioritize these features using MoSCoW for a 2-week MVP:
[FEATURE LIST]

Must Have = App doesn't work without it
Should Have = Important but can delay
Could Have = Nice to have, only if time
Won't Have = Not this version
```

---

## Quick Diagnosis Checklist

Run through this for any spec:

| Check | Question | Pass? |
|-------|----------|-------|
| **Measurable** | Can I put a number on it? | ☐ |
| **Testable** | Can I write Given-When-Then? | ☐ |
| **Complete** | Are edge cases covered? | ☐ |
| **Bounded** | Is scope explicit (in and out)? | ☐ |
| **Structured** | Is the data model defined? | ☐ |
| **Prioritized** | Is MoSCoW applied? | ☐ |
| **Unambiguous** | Would 2 devs build the same thing? | ☐ |

---

## The Ultimate Fix Prompt

```
Review this specification for quality issues:

[PASTE SPEC]

Check for these "spec smells":
1. Vague requirements (make measurable)
2. Missing acceptance criteria (add testable ACs)
3. Assumed knowledge (make explicit)
4. Scope ambiguity (add In/Out of scope)
5. Undeclared data model (define structure)
6. Untestable statements (rewrite as Given-When-Then)
7. Missing edge cases (enumerate them)
8. Feature soup (apply MoSCoW)

For each issue found:
- Quote the problematic text
- Explain why it's a problem
- Provide a fixed version
```

---

*Specification Quality Reference v2.0 — Capstone Project*

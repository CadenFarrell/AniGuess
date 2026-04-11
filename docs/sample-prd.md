# Sample PRD: Habit Tracker

## A Complete Example Specification

---

# Product Requirements Document

## DailyStride — Habit Tracker v1.0

---

## 1. Product Overview

### App Name
DailyStride

### One-Sentence Description
A simple, offline-first habit tracking app that helps users build consistency through daily check-ins and streak visualization.

### Platform
.NET MAUI (iOS, Android, Windows, macOS)

### Target User
Adults who want to build positive habits but get overwhelmed by complex apps. They want something simple that "just works" without accounts, sync hassles, or gamification distractions.

### Problem Statement
Existing habit trackers are either too complex (dozens of features, required accounts, subscription walls) or too simple (no streaks, no history, no motivation). Users need a middle ground: enough features to stay motivated, simple enough to actually use daily.

---

## 2. Features

### P0 — Must Have (Core MVP)

#### Feature 1: Display Habit List

**User Story:**
As a user, I want to see my habits for today so I can quickly check what I need to do.

**Acceptance Criteria:**
1. Home screen displays today's date prominently (format: "Wednesday, January 8")
2. All active (non-archived) habits display in a vertical list
3. Each habit shows: checkbox, habit name, current streak count
4. Habits ordered alphabetically by name
5. If no habits exist, show empty state: illustration + "Add your first habit" button

**Data:**
- Reads from: Habit (filtered: IsArchived = false)
- Reads from: Completion (filtered: today's date)

---

#### Feature 2: Mark Habit Complete

**User Story:**
As a user, I want to mark a habit as complete for today so I can track my progress.

**Acceptance Criteria:**
1. Tapping checkbox toggles completion state for today
2. Completed habits show: filled checkbox, subtle background highlight (#E8F5E9)
3. Uncompleting a habit (tap again) removes the completion record for today
4. Toggling updates streak count immediately (no page refresh needed)
5. Visual feedback: checkbox animates over 150ms with scale effect

**Data:**
- Creates/Deletes: Completion record for (HabitId, today's date)

---

#### Feature 3: Persist Data

**User Story:**
As a user, I want my habits and completions saved so they survive app restarts.

**Acceptance Criteria:**
1. All data persists to local SQLite database
2. App state restores correctly after force-close and reopen
3. No data loss on normal app lifecycle events (background, resume)
4. Database location: app's private storage directory
5. No cloud sync (v1.0) — purely local

**Data:**
- Persists: Habit table, Completion table

---

### P1 — Should Have

#### Feature 4: Add New Habit

**User Story:**
As a user, I want to add a new habit so I can start tracking something new.

**Acceptance Criteria:**
1. "+" button in header opens Add Habit modal/page
2. Single text field for habit name
3. Validation: required, 1-50 characters, whitespace trimmed
4. Empty submit: show inline error "Habit name is required"
5. Too long: show inline error "Maximum 50 characters" (with character count)
6. Duplicate names allowed (user's choice)
7. Save button: creates habit, closes modal, new habit appears in list
8. Cancel button: closes modal, no changes saved
9. Keyboard: auto-focus name field, Enter key submits

**Data:**
- Creates: Habit (Id: new Guid, Name: input, CreatedDate: now, IsArchived: false)

---

#### Feature 5: Calculate and Display Streaks

**User Story:**
As a user, I want to see my current streak for each habit so I feel motivated to maintain consistency.

**Acceptance Criteria:**
1. Streak = count of consecutive days with completion, ending today or yesterday
2. Streak resets to 0 if user misses a day (gap > 1 day from last completion)
3. Today incomplete but yesterday complete: streak shows yesterday's count (not yet broken)
4. Today complete: streak includes today
5. Display format: integer next to habit name (e.g., "🔥 7" or just "7")
6. Streak of 0: display "-" (not "0")
7. Streak calculated on app load and after each completion toggle

**Data:**
- Reads: Completion records for habit, ordered by date descending

**Edge Cases:**
- First day ever: streak = 1 if completed today, "-" if not
- Time zones: use device local date, not UTC
- Completion at 11:59 PM: counts for that calendar day

---

#### Feature 6: Edit Habit

**User Story:**
As a user, I want to edit a habit's name so I can fix typos or rename it.

**Acceptance Criteria:**
1. Long-press habit row opens context menu with "Edit" option
2. Edit opens modal with current name pre-filled
3. Same validation as Add (1-50 chars, required)
4. Save updates name, preserves all history and streak
5. Cancel closes without changes

**Data:**
- Updates: Habit.Name

---

#### Feature 7: Delete Habit

**User Story:**
As a user, I want to delete a habit I no longer want to track.

**Acceptance Criteria:**
1. Long-press context menu includes "Delete" option
2. Confirmation dialog: "Delete [habit name]? This will remove all history for this habit."
3. Confirm: deletes habit AND all associated completion records
4. Cancel: closes dialog, no changes
5. Deleted habit removed from list immediately

**Data:**
- Deletes: Habit record
- Deletes: All Completion records where HabitId matches

---

### P2 — Could Have

#### Feature 8: View Completion History

**User Story:**
As a user, I want to see my completion history so I can review my progress over time.

**Acceptance Criteria:**
1. Tap habit row opens detail view
2. Detail view shows: habit name, current streak, calendar grid (GitHub-style)
3. Calendar shows past 12 weeks (84 days)
4. Completed days: filled square (green)
5. Incomplete days: empty square (gray border)
6. Future days: not shown
7. Today: highlighted border
8. Tap day in past: toggle completion for that day (allows backdating)

**Data:**
- Reads: Completion records for habit within date range

---

#### Feature 9: Archive Habit

**User Story:**
As a user, I want to archive a habit I'm pausing (instead of deleting) so I can preserve history.

**Acceptance Criteria:**
1. Long-press context menu includes "Archive" option
2. Archive removes from main list, preserves all data
3. Settings/menu has "View Archived" option
4. Archived list shows archived habits with "Unarchive" option
5. Unarchive returns habit to main list, streak recalculates from last completion

**Data:**
- Updates: Habit.IsArchived = true/false

---

## 3. Data Model

### Entity: Habit

| Property | Type | Constraints | Notes |
|----------|------|-------------|-------|
| Id | Guid | PK, generated on create | Unique identifier |
| Name | string | Required, 1-50 chars, trimmed | Display name |
| CreatedDate | DateTime | Set on create, immutable | For sorting/info |
| IsArchived | bool | Default: false | Soft delete |

### Entity: Completion

| Property | Type | Constraints | Notes |
|----------|------|-------------|-------|
| Id | Guid | PK, generated on create | Unique identifier |
| HabitId | Guid | FK → Habit.Id, required | Which habit |
| CompletedDate | DateOnly | Required | Calendar date (no time) |

**Unique constraint:** (HabitId, CompletedDate) — one completion per habit per day

### Relationships

```
Habit (1) ←──── (N) Completion
```

- One Habit has many Completions
- Deleting Habit cascades to delete Completions

---

## 4. Validation Rules

### Habit Name
- Required (empty → "Habit name is required")
- Length: 1-50 characters (>50 → "Maximum 50 characters")
- Trimmed: leading/trailing whitespace removed before save
- Whitespace-only: treated as empty (fails required check)
- Duplicates: allowed (user can have multiple habits with same name)

### Completion Date
- Cannot be in the future (UI shouldn't allow, but validate anyway)
- Must be valid calendar date

### Streak Calculation
```
function calculateStreak(habitId):
    completions = getCompletions(habitId).orderByDescending(date)
    
    if completions.isEmpty():
        return 0
    
    streak = 0
    expectedDate = today
    
    // Allow yesterday to count if today not yet complete
    if completions[0].date != today:
        expectedDate = yesterday
        if completions[0].date != yesterday:
            return 0  // Streak broken
    
    for each completion in completions:
        if completion.date == expectedDate:
            streak++
            expectedDate = expectedDate - 1 day
        else if completion.date < expectedDate:
            break  // Gap found, streak ends
    
    return streak
```

---

## 5. UI Inventory

### Screens

| Screen | Purpose | Entry Point |
|--------|---------|-------------|
| Home | Display today's habits, check-in | App launch |
| Add Habit | Create new habit | "+" button |
| Edit Habit | Modify habit name | Long-press → Edit |
| Habit Detail | History calendar, stats | Tap habit row |
| Archived | View/restore archived habits | Menu/Settings |

### Navigation Flow

```
┌─────────────┐
│    Home     │ ← App Launch
│  (Habit     │
│   List)     │
└──────┬──────┘
       │
       ├──── "+" ──────────→ Add Habit (modal)
       │
       ├──── Tap row ─────→ Habit Detail
       │
       ├──── Long-press ──→ Context Menu
       │                         │
       │                         ├─→ Edit Habit (modal)
       │                         ├─→ Delete (confirm dialog)
       │                         └─→ Archive
       │
       └──── Menu ────────→ Archived Habits
```

### Key Components

**Home Screen:**
- Header: Date display, "+" button
- Habit List: ScrollView with habit rows
- Habit Row: Checkbox, Name, Streak badge
- Empty State: Illustration + CTA button

**Habit Detail:**
- Header: Habit name, back button
- Streak Display: Large number + "day streak"
- Calendar Grid: 12-week history visualization

---

## 6. Out of Scope (v1.0)

| Feature | Reason | Future Version? |
|---------|--------|-----------------|
| Cloud sync | Adds complexity, requires accounts | v2.0 |
| User accounts | MVP is local-only | v2.0 |
| Notifications/reminders | Platform complexity | v1.5 |
| Multiple lists/categories | Keep it simple | v1.5 |
| Statistics dashboard | Nice-to-have, not core | v1.5 |
| Gamification/badges | Scope creep | Maybe v2.0 |
| Social/sharing | Scope creep | Maybe v2.0 |
| Habit templates | Nice-to-have | v1.5 |
| Dark mode | Polish, not core | v1.2 |
| Widgets | Platform-specific complexity | v2.0 |
| Import/export | Nice-to-have | v1.5 |

---

## 7. Vertical Slices (Implementation Order)

### Slice 1: Static Display
**Scope:** Display hardcoded habits on home screen
**Includes:** Home screen layout, habit row component, hardcoded test data
**Excludes:** Database, real data, interactivity
**Demo:** App launches, shows 3 test habits with fake streaks
**Time estimate:** 30-45 min

### Slice 2: Check-In (In-Memory)
**Scope:** Toggle completion for today (doesn't persist)
**Includes:** Checkbox interaction, state management, visual feedback
**Excludes:** Database persistence, streak calculation
**Demo:** Tap checkbox, it toggles. Restart app, state resets.
**Time estimate:** 30-45 min

### Slice 3: Database Persistence
**Scope:** Habits and completions persist to SQLite
**Includes:** Database setup, repository layer, data loading on startup
**Excludes:** CRUD UI (add/edit/delete)
**Demo:** Check habits, restart app, state preserved.
**Time estimate:** 45-60 min

### Slice 4: Add Habit
**Scope:** Create new habits through UI
**Includes:** Add button, modal/page, form, validation, save to database
**Excludes:** Edit, delete
**Demo:** Tap +, enter name, save. New habit appears in list.
**Time estimate:** 45-60 min

### Slice 5: Streak Calculation
**Scope:** Calculate and display real streaks
**Includes:** Streak algorithm, display in habit row, update on toggle
**Excludes:** History view, backdating
**Demo:** Build streak over multiple days, see count increase. Miss day, see reset.
**Time estimate:** 30-45 min

### Slice 6: Edit & Delete
**Scope:** Modify and remove habits
**Includes:** Long-press menu, edit modal, delete confirmation, cascade delete
**Excludes:** Archive
**Demo:** Edit habit name, delete habit, history removed.
**Time estimate:** 45-60 min

### Slice 7: Habit Detail & History (P2)
**Scope:** View completion calendar
**Includes:** Detail screen, calendar grid, navigation
**Excludes:** Backdating, archive
**Demo:** Tap habit, see 12-week history grid.
**Time estimate:** 60-90 min

### Slice 8: Archive (P2)
**Scope:** Soft-delete with restore
**Includes:** Archive action, archived list, unarchive
**Excludes:** (nothing left)
**Demo:** Archive habit, view in archived list, restore.
**Time estimate:** 30-45 min

---

## 8. Technical Notes

### Technology Stack
- **Framework:** .NET MAUI
- **Architecture:** MVVM (CommunityToolkit.Mvvm)
- **Database:** SQLite (sqlite-net-pcl)
- **UI:** XAML with data binding

### Project Structure
```
DailyStride/
├── Models/
│   ├── Habit.cs
│   └── Completion.cs
├── ViewModels/
│   ├── HomeViewModel.cs
│   ├── AddHabitViewModel.cs
│   └── HabitDetailViewModel.cs
├── Views/
│   ├── HomePage.xaml
│   ├── AddHabitPage.xaml
│   └── HabitDetailPage.xaml
├── Services/
│   ├── IHabitService.cs
│   ├── HabitService.cs
│   └── DatabaseService.cs
└── App.xaml
```

### Dependencies
- CommunityToolkit.Mvvm (MVVM helpers)
- sqlite-net-pcl (SQLite ORM)
- CommunityToolkit.Maui (UI helpers, optional)

---

## Appendix: Two-Developer Test Results

**Undefined decisions remaining:** 2

1. **Animation easing curve for checkbox** — Specified "150ms with scale effect" but not exact easing. Minor, developers might vary.

2. **Empty state illustration** — Specified "illustration" but not which one. Could provide asset or describe.

**Verdict:** This spec is ready for implementation.

---

*Sample PRD v1.0 — DailyStride Habit Tracker*
*Created as reference for AI-Driven PRD Creation Lesson*

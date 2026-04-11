# Capstone Project

## Quick Start

1. Click **"Use this template"** to create your repo
2. Clone it and open in Claude Code
3. Say: **`/capstone-kickoff`**

That's it. The capstone kickoff skill takes over from there.

---

## What's Inside

| Folder | Purpose |
|--------|---------|
| `docs/` | Instructions, references, example PRD — [start here](docs/capstone-overview.md) |
| `planning/` | Your project brief, PRD, implementation slices, decision log — populated by the pipeline |
| `skills/` | Domain-specific skills you create for your project |
| `src/` | Your implementation code |

## The Pipeline

The pipeline is a 7-stage flow:

```
KICKOFF → EXPLORE → LEARN → BUILD → MODIFY → REFLECT → DEMO
```

The capstone skills guide you through each stage. All planning docs update as your project evolves.

**[Full guide](docs/capstone-overview.md)** · **[Decision frameworks](docs/decision-frameworks.md)** · **[Spec quality](docs/spec-quality.md)** · **[Example PRD](docs/sample-prd.md)**

---

## Setup Details

<details>
<summary>First time using Claude Code?</summary>

### Installing Claude Code

- Visit [claude.ai/code](https://claude.ai/code) and follow installation instructions for your platform
- Open a terminal in your cloned repo directory
- Run `claude` to start a session
- The capstone skills will auto-install on first launch

### Basic Usage

- Type naturally — describe what you want to do
- Claude reads your project files and understands the capstone pipeline
- All planning documents are generated and updated by the skills

</details>

<details>
<summary>Skills not loading?</summary>

### Troubleshooting Skills

- Check that `.claude/settings.json` exists in your repo root and contains the plugin reference
- Try restarting Claude Code — plugins resolve on launch
- Manual install if auto-resolution fails: `claude plugins add https://github.com/crawfis/AI-Programming-Capstone.git`
- Verify skills are available by asking: "What capstone skills do I have?"

</details>

<details>
<summary>Working offline or with a different AI tool?</summary>

### Manual Workflow

- The `planning/` directory contains template files that explain what goes in each document. You can fill them in manually using the reference materials in `docs/`
- Read `docs/capstone-overview.md` for the full pipeline guide
- Use `docs/decision-frameworks.md` when making project decisions
- Use `docs/spec-quality.md` to validate your specifications
- Use `docs/sample-prd.md` as a reference for your own PRD
- The template files in `planning/` describe the expected format for each document

</details>

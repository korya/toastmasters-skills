# toastmasters-skills

A Claude Code / Codex plugin marketplace for managing [Toastmasters](https://www.toastmasters.org/) club
participation on [easy-Speak](https://easy-speak.org/).

## What's here

| Plugin | What it does |
| --- | --- |
| **toastmasters** | Check and set meeting attendance, claim roles, and see when you're next speaking on easy-Speak. |

easy-Speak has no API, so the plugin works by driving the site's real web UI in a browser.

## Install

### Claude Code

```
/plugin marketplace add korya/toastmasters-skills
/plugin install toastmasters@korya
```

To try it without installing:

```bash
claude --plugin-dir ./plugins/toastmasters
```

### Codex

Codex reads the same marketplace file — it accepts `.claude-plugin/marketplace.json` for compatibility, so
one catalogue serves both clients:

```bash
codex plugin marketplace add korya/toastmasters-skills
codex plugin add toastmasters@korya
```

Verified end to end: the marketplace resolves, and the plugin installs and enables at
`~/.codex/plugins/cache/korya/toastmasters/`.

Without the plugin system, Codex also discovers skills under `.agents/skills/` — this repo symlinks that to
the plugin's skills directory, so running Codex from inside a clone picks the skill up directly.

> **Codex needs browser automation.** Unlike Claude Code, Codex ships no browser control. Without a browser
> MCP server (Playwright or similar) configured, the skill will load and read correctly but cannot click
> anything. See the skill's *Requirements* section — it's written to tell you this up front rather than
> failing halfway through.

## Usage

Once installed, just ask:

- *"Am I signed up for the next meeting?"*
- *"What roles are still open next week?"*
- *"When am I speaking next?"*
- *"Confirm me for the next three meetings, attending online."*
- *"Sign me up as Timer for the 24th."*

You log in yourself the first time — the skill never handles your password.

Writes are confirmed with you before they happen and verified afterwards, because easy-Speak commits role
signups instantly with no undo prompt and the whole club sees the result.

## Supported hosts

The same software runs at three addresses; the skill works with all of them:

| Host | Clubs |
| --- | --- |
| `easy-speak.org` | Everywhere else |
| `toastmasterclub.org` | UK / Ireland |
| `tmclub.eu` | Mainland Europe |

## Status

Early, but the core works against a live club. Reading the signup board, checking attendance and roles,
setting attendance, and declining a meeting are mapped and exercised for real.

Releasing a role and requesting a speech slot are still documented as **unmapped** — verifying them means
writing to a real club's board, so the skill hands those to you rather than guessing at controls nobody has
observed. Declining is mapped with one gap: nobody has yet declined while holding a role, so whether that
releases the role is unknown.

The reference material the skill was reverse-engineered from ships with it, in
`plugins/toastmasters/skills/easy-speak/references/`.

## Standards

This repo targets three open specs at once, which costs almost nothing because they agree on the part that
matters — a skill is a folder with a `SKILL.md`.

| Spec | What it governs | Where |
| --- | --- | --- |
| [Agent Skills](https://agentskills.io) | `SKILL.md` frontmatter, naming, layout | `skills/easy-speak/` |
| [Agent Plugins](https://agent-plugins.org) | vendor-neutral plugin packaging | `plugins/toastmasters/plugin.json` |
| [Claude Code plugins](https://code.claude.com/docs/en/plugins) | marketplace and install | `.claude-plugin/` |

There is **one** marketplace file, not two. Codex's native location is `.agents/plugins/marketplace.json`,
but it also reads `.claude-plugin/marketplace.json`, and both `claude plugin marketplace add` and
`codex plugin marketplace add` resolve this repo from that single file. A second catalogue listing the same
versions would only be somewhere for the two to disagree.

The Agent Plugins manifest is the portable one; `.claude-plugin/` and `.codex-plugin/` are vendor shells
around the same skill. Agent Plugins reserves `mcp.json` at the plugin root for bundling MCP servers — the
natural place to close the Codex browser gap, if that's ever worth doing.

## Repository layout

```
.claude-plugin/marketplace.json      the marketplace catalogue
plugins/toastmasters/
├── plugin.json                      Agent Plugins manifest (portable)
├── .claude-plugin/plugin.json       Claude Code manifest
├── .codex-plugin/plugin.json        Codex manifest
└── skills/easy-speak/
    ├── SKILL.md                     Agent Skills compliant
    ├── scripts/                     read_board, summarize_board, click_mark
    └── references/                  UI algorithms, site map
```

## Developing this skill

**Invoke it by its namespaced name: `/toastmasters:easy-speak`.** Plugin skills are always prefixed with
the plugin name. Reaching for the bare `/easy-speak` fails and looks exactly like "the plugin isn't
installed", which is the wrong diagnosis.

**Installing takes a snapshot — in both clients.** Install copies the plugin into a cache and pins it:

| Client | Cache |
| --- | --- |
| Claude Code | `~/.claude/plugins/cache/korya/toastmasters/<version>/` |
| Codex | `~/.codex/plugins/cache/korya/toastmasters/<version>/` |

Neither is a symlink (verified by editing a bundled script and watching the cache not follow). So once
installed, editing your working tree changes nothing about what the agent loads. Worse, `version` is pinned
in the manifests, so an update won't pull your edits either until you bump it.

While iterating, don't install — load from disk.

**Claude Code** takes a plugin directory directly, and it wins over an installed plugin of the same name for
that session:

```bash
claude --plugin-dir ./plugins/toastmasters
```

Use `/reload-plugins` to pick up edits without restarting.

**Codex** has no equivalent flag, but it discovers skills under `.agents/skills/`, which this repo symlinks
to the plugin's skills directory. So running Codex from inside a clone reads your working tree live — that
is the Codex dev loop:

```bash
cd toastmasters-skills && codex
```

Reinstall only when you want to test the real install path:

```bash
claude plugin uninstall toastmasters
claude plugin marketplace update korya
claude plugin install toastmasters@korya

codex plugin remove toastmasters@korya
codex plugin add toastmasters@korya
```

**A running session won't see a newly installed plugin.** Skills are listed at session start. After
installing, restart before concluding anything about whether it triggers — this has misled two agents
already.

**Check before pushing.** Claude Code ships a validator; for Codex, adding the marketplace and listing it is
a serviceable smoke test that the catalogue parses and the plugin resolves:

```bash
claude plugin validate .                      # marketplace
claude plugin validate ./plugins/toastmasters # plugin

codex plugin marketplace add .
codex plugin list --marketplace korya
```

## Licence

MIT — see [LICENSE](LICENSE).

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

Codex discovers skills under `.agents/skills/`. Clone the repo and point Codex at it:

```bash
git clone https://github.com/korya/toastmasters-skills
ln -s "$PWD/toastmasters-skills/plugins/toastmasters/skills/easy-speak" ~/.agents/skills/easy-speak
```

Running Codex from inside the cloned repo also works — `.agents/skills/` is symlinked to the plugin's
skills directory for that purpose.

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

**Installing takes a snapshot.** `/plugin install` copies the plugin into
`~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/` and records the commit it came from. It is not
a symlink: once installed, editing your working tree changes nothing about what Claude actually loads. And
because `version` is pinned in `plugin.json`, a plugin update won't pull your edits either until you bump it.

So while iterating, don't install — load from disk:

```bash
claude --plugin-dir ./plugins/toastmasters
```

A `--plugin-dir` plugin takes precedence over an installed one of the same name for that session, so this
works even with `toastmasters@korya` installed. Use `/reload-plugins` to pick up edits without restarting.

Reinstall only when you want to test the real install path:

```bash
claude plugin uninstall toastmasters
claude plugin marketplace update korya
claude plugin install toastmasters@korya
```

**A running session won't see a newly installed plugin.** Skills are listed at session start. After
installing, restart before concluding anything about whether it triggers.

**Validate before pushing:**

```bash
claude plugin validate .                      # marketplace
claude plugin validate ./plugins/toastmasters # plugin
```

## Licence

MIT — see [LICENSE](LICENSE).

---
name: easy-speak
license: MIT
compatibility: Requires browser automation the agent can drive (Claude Code with the Chrome extension, or any agent with a browser MCP server such as Playwright). Needs an easy-Speak account; the user logs in themselves.
description: Manage Toastmasters club participation on easy-Speak (easy-speak.org, toastmasterclub.org, tmclub.eu) by driving the site's web UI in Chrome — check or set meeting attendance, claim roles, see when you're next speaking, and read the agenda, roster or club calendar. Use this whenever the user mentions easy-Speak, Toastmasters, their club meetings, meeting roles (Toastmaster, Table Topics Master, Evaluator, Grammarian, Timer, Quizmaster, Ah-Counter), or asks things like "am I speaking soon", "what roles are open next week", "confirm me for the next three meetings", "sign me up as Timer", or "who's on the agenda" — even when they never name the website.
---

# easy-Speak

easy-Speak is the meeting-management system many Toastmasters clubs run on: a phpBB-era PHP app with no
API, behind Cloudflare, so this skill drives the real web UI in a browser.

## First, work out which hands you have

The only way to do anything is to drive the page, and what you can do depends on how you reach it. Check
before promising anything — "I'll confirm your attendance" followed by "I can't click" is the failure to avoid.

| What you have | How to work |
|---|---|
| A JavaScript tool in the page (Claude Code + Chrome extension, or a browser MCP server) | **Scripted path** — the rest of this file. Reads the board in one call, clicks by tag. Fast and safe. |
| Only screenshots and clicks (ChatGPT's cloud browser) | **Visual path** — follow `references/visual-operation.md`. The bundled scripts will not run there, and declining cannot be completed at all. |
| No browser at all | Say so plainly, and offer to talk the member through the steps themselves. |

Both paths perform the same operations from `references/operations.md`, with one exception: **declining
needs the JavaScript tool**, because its popup window is unreachable any other way. On the visual path, hand
that one operation to the member.

## The one idea that makes this simple

Almost everything lives on **one page**: `/signup.php`, the *Sign Up for Meetings* board. It is a single
table — **role rows × upcoming-meeting columns** — and it simultaneously answers:

- Am I confirmed for the next meeting(s)?
- Which roles are still open?
- Who is speaking, and am I one of them?

...and it is also where you change all of those. Start there, and only go elsewhere for detail (full
agenda, roster, months further out) — `references/site-map.md` covers the rest of the site.

## Getting a session

1. Pick the host: `toastmasterclub.org` (UK/Ireland), `tmclub.eu` (mainland Europe), `easy-speak.org`
   (everywhere else). Same software, three installs. Ask once if unsaid, then remember it.
2. Open `https://<host>/signup.php` and **wait ~5s** — Cloudflare shows a `Just a moment...` page first, and
   a read taken too early returns the challenge, not the site.
3. Confirm you're logged in — the board read returns your name in `user`, or `error: not logged in`.
4. If not, **hand the tab over and ask them to log in** — the form is in `portal.php`'s left sidebar. Never
   type the password; it's theirs.

Sessions expire between conversations — check for `user` every time (`references/gotchas.md` says why).

## Reading the board

Run `scripts/read_board.js` in the page — never read the grid by eye — and parse the JSON it returns:

```
{ "user":      "Dmitri Kochelorov",
  "dateRange": "14 Sep 26 - 05 Oct 26",
  "meetings":  [{"id": "700001", "label": "24 Aug 26", "me": "none"}],
  "myRoles":   [{"role": "Timer", "id": "700001"}],
  "controls":  {"700001": {"inPerson": "es-0", "notAttending": "es-2"}},
  "roles":     [{"role": "Evaluator", "id": "700001", "taken": "1 Carol Example",
                 "open": [{"slot": "2", "mode": "inPerson", "mark": "es-4"}]}] }
```

`me` is one of `inPerson`, `online`, `notAttending`, `undecided`, or `none`.

**Ask for only what you need.** Tool output is cut off at about 950 characters, so the script takes two
placeholders: `ONLY` (which meetings get role detail — `null`, a meeting id, or a list) and `MARKS` (`true`
only when you're about to click). Over budget it returns a short error naming what to narrow, never a
truncated board. The default `ONLY = null, MARKS = false` always fits; scope to one meeting id with
`MARKS = true` before a write. The script's header has the detail.

To **verify** a write, run `scripts/summarize_board.js` instead — same facts, one screen, cheap to re-run.

## Changing things

The rhythm for every write is **read → confirm → click → re-read → report what you actually saw.**

**Confirm with the user first**, naming the meeting date and the exact value. This isn't ceremony: a click
commits instantly, with no "are you sure" dialog, and the whole club sees it — including the VP Education
planning the agenda around it. Undoing means a release control this skill hasn't mapped yet.

Write mechanics and the traps live in `references/gotchas.md` — **read it before your first write of a
session.** The click-by-click algorithm for each operation is in `references/operations.md`.

## Operations

| | Operation | Notes |
|---|---|---|
| **Read** | List upcoming meetings | `meetings[]` from the board |
| | Check my attendance | `meetings[].me` — mind `none` vs `undecided` |
| | Which roles are open / who's assigned | `roles[]` — needs `ONLY` set to that meeting |
| | When am I next speaking | `myRoles[]` where `role` is Speaker; returned for every meeting |
| | Full agenda for a meeting | `/view_meeting.php?t=<meetingId>` |
| | **Who is / was attending** | Same page, `scripts/read_meeting.js`; the board shows only *you* |
| | Today's or a past meeting | **Not on the board** — sidebar *Last Meeting*, then `read_meeting.js` |
| | Club roster / officers | `/memberlist.php` — see site-map |
| | Meetings further out | `/mycalendar.php?jump=<months ahead>` |
| **Write** | Confirm attendance (in person / online / undecided) | Click the matching `controls` mark |
| | Decline attendance | **Run `scripts/decline.js`** — never click `N` bare; it opens a window nothing can reach |
| | Claim a role | Click an `open` mark; also sets your attendance |
| | Release a role | **Unmapped** — hand to the user |
| | Request a speech slot | **Unmapped** — hand to the user |

Hand the unmapped operations to the user rather than guessing; declining *while holding a role* is
unverified too (`references/gotchas.md`).

## Reporting back

Lead with the answer, then the supporting detail. A table of meetings/roles reads better than prose.

Report what you observed. If the user asked about three meetings and one exists, the first line says so.
If a write didn't visibly take effect, say that instead of assuming success.

From the roster take names and club roles; leave the phone and email columns alone.

**Match the member's vocabulary, not the site's.** "You're down as coming on Monday the 24th" lands;
`status: inPerson` does not. Keep ids, selectors and JSON out of it unless asked.

## Files

- `scripts/read_board.js` — parse the signup board into JSON and tag clickable elements
- `scripts/summarize_board.js` — one-screen view of the board; verifies a write
- `scripts/click_mark.js` — click a tagged element (substitute `__MARK__`)
- `scripts/decline.js` — decline one meeting end to end
- `scripts/read_meeting.js` — one meeting's club-wide attendance or roles
- `references/visual-operation.md` — working with screenshots and clicks only
- `references/operations.md` — step-by-step algorithm for each operation
- `references/gotchas.md` — write mechanics and the traps
- `references/site-map.md` — page map, attendance codes, URL contracts

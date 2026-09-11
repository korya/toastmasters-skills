---
name: easy-speak
license: MIT
compatibility: Requires browser automation the agent can drive (Claude Code with the Chrome extension, or any agent with a browser MCP server such as Playwright). Needs an easy-Speak account; the user logs in themselves.
description: Manage Toastmasters club participation on easy-Speak (easy-speak.org, toastmasterclub.org, tmclub.eu) by driving the site's web UI in Chrome — check or set meeting attendance, claim roles, see when you're next speaking, and read the agenda, roster or club calendar. Use this whenever the user mentions easy-Speak, Toastmasters, their club meetings, meeting roles (Toastmaster, Table Topics Master, Evaluator, Grammarian, Timer, Quizmaster, Ah-Counter), or asks things like "am I speaking soon", "what roles are open next week", "confirm me for the next three meetings", "sign me up as Timer", or "who's on the agenda" — even when they never name the website.
---

# easy-Speak

easy-Speak is the meeting-management system many Toastmasters clubs run on. It is a phpBB-era PHP
application with no API, so this skill works by driving the real web UI in Chrome.

## First, work out which hands you have

easy-Speak has no API and sits behind Cloudflare, so the only way to do anything is to drive the page. What
you can do depends on how you reach it — check before promising anything. Announcing "I'll confirm your
attendance" and discovering at the click that you can't is the failure worth designing out.

| What you have | How to work |
|---|---|
| A JavaScript tool in the page (Claude Code + Chrome extension, or a browser MCP server) | **Scripted path** — the rest of this file. Reads the board in one call, clicks by tag. Fast and safe. |
| Only screenshots and clicks (ChatGPT's cloud browser) | **Visual path** — follow `references/visual-operation.md`. The bundled scripts will not run there, and declining cannot be completed at all. |
| No browser at all | Say so plainly, and offer to talk the member through the steps themselves. |

Both paths perform the same operations from `references/operations.md`; they differ only in how they read
the page and how they click — with one exception. **Declining needs the JavaScript tool.** It opens a popup
window that no browser-automation tool can reach, and the only way through is to intercept it in the page.
On the visual path, hand that one operation to the member.

## The one idea that makes this simple

Almost everything lives on **one page**: `/signup.php`, the *Sign Up for Meetings* board. It is a single
table — **role rows × upcoming-meeting columns** — and it simultaneously answers:

- Am I confirmed for the next meeting(s)?
- Which roles are still open?
- Who is speaking, and am I one of them?

...and it is also where you change all of those. Start there for nearly every request, and only go
elsewhere for detail (full agenda, roster, months further out). `references/site-map.md` covers the rest of
the site.

## Getting a session

1. Pick the host: `toastmasterclub.org` (UK/Ireland), `tmclub.eu` (mainland Europe), `easy-speak.org`
   (everywhere else). Same software, three installs. Ask once if unsaid, then remember it.
2. Open `https://<host>/signup.php` and **wait ~5s** — Cloudflare shows a `Just a moment...` page first, and
   a read taken too early returns the challenge, not the site.
3. Confirm you're logged in — the board read returns your name in `user`, or `error: not logged in`.
4. If not, **hand the tab over and ask them to log in** — the form is in `portal.php`'s left sidebar. Never
   type the password. It's theirs, and no automation win is worth holding someone's credentials.

Sessions expire between conversations — check for that `user` field every time (`references/gotchas.md` explains the failure mode).

## Reading the board

Run `scripts/read_board.js` in the page (via the browser JavaScript tool) and parse the JSON it returns:

```
{ "user":      "Dmitri Kochelorov",
  "dateRange": "14 Sep 26 - 05 Oct 26",
  "meetings":  [{"id": "700001", "label": "24 Aug 26", "me": "none"}],
  "myRoles":   [{"role": "Timer", "id": "700001"}],
  "controls":  {"700001": {"inPerson": "es-0", "notAttending": "es-2"}},
  "roles":     [{"role": "Evaluator", "id": "700001", "taken": "1 Carol Example",
                 "open": [{"slot": "2", "mode": "inPerson", "mark": "es-4"}]}] }
```

Use the script rather than reading the page by eye — `references/gotchas.md` says why.

`me` is one of `inPerson`, `online`, `notAttending`, `undecided`, or `none`.

**Ask for only what you need.** Tool output is cut off at about 950 characters, so the script takes two
placeholders: `ONLY` (which meetings get role detail — `null` for none, a meeting id, or a list) and `MARKS`
(`false` to read, `true` when you're about to click). Over budget it returns a short error naming what to
narrow rather than a truncated board, because a truncated board looks like a smaller club rather than a
broken read. The default `ONLY = null, MARKS = false` answers most questions and always fits; scope to one
meeting id with `MARKS = true` before a write.

To **verify** a write, run `scripts/summarize_board.js` instead — same facts, one screen, cheap to re-run.
It prints every meeting's attendance and then as many full role blocks as fit, naming any it left out.

## Changing things

The rhythm for every write is **read → confirm → click → re-read → report what you actually saw.**

**Confirm with the user first**, naming the meeting date and the exact value. This isn't ceremony: clicking a
role icon is a side-effecting GET that commits the instant it's clicked, with no "are you sure" dialog, and
the change is immediately visible to the whole club — including the VP Education planning the agenda around
it. Undoing means finding a release control this skill hasn't mapped yet.

Full write mechanics — click-by-mark, re-reading after the reload, readyState polling — and
the traps that bite hand-rolled approaches live in `references/gotchas.md`. **Read it before
your first write of a session.** The click-by-click algorithm for each operation is in
`references/operations.md`.

## Operations

| | Operation | Notes |
|---|---|---|
| **Read** | List upcoming meetings | `meetings[]` from the board |
| | Check my attendance | `meetings[].me` — mind `none` vs `undecided` |
| | Which roles are open / who's assigned | `roles[]` — needs `ONLY` set to that meeting |
| | When am I next speaking | `myRoles[]` where `role` is Speaker; returned for every meeting |
| | Full agenda for a meeting | `/view_meeting.php?t=<meetingId>` |
| | **Who else is attending** | Same page — the `Total Attendance` table; the board shows only *your* status |
| | Club roster / officers | `/memberlist.php` — see site-map |
| | Meetings further out | `/mycalendar.php?jump=<months ahead>` |
| **Write** | Confirm attendance (in person / online / undecided) | Click the matching `controls` mark |
| | Decline attendance | **Run `scripts/decline.js`** — never click `N` bare; it opens a window nothing can reach |
| | Claim a role | Click an `open` mark; also sets your attendance |
| | Release a role | **Unmapped** — hand to the user |
| | Request a speech slot | **Unmapped** — hand to the user |

Two operations are unmapped and declining-while-holding-a-role is unverified — the specifics
are in `references/gotchas.md`; hand those to the user rather than guessing.

## Reporting back

Lead with the answer, then the supporting detail. A table of meetings/roles reads better than prose.

Report what you observed. If the user asked about three meetings and one exists, the first line says so.
If a write didn't visibly take effect, say that instead of assuming success.

When reading the roster, take names and club roles and leave the phone and email columns alone — a headcount
doesn't need the club's contact details pulled into a transcript.

**Match the member's vocabulary, not the site's.** These are club members, not engineers. "You're down as
coming on Monday the 24th" lands; `status: inPerson` does not. Keep ids, selectors and JSON out of it unless
asked, and ask one plain question at a time.

## Files

- `scripts/read_board.js` — parse the signup board into JSON and tag clickable elements
- `scripts/summarize_board.js` — one-screen view of the board; use this to verify a write
- `scripts/click_mark.js` — click a tagged element (substitute `__MARK__`)
- `scripts/decline.js` — decline one meeting end to end, without opening an unreachable window
- `references/visual-operation.md` — how to work with screenshots and clicks only, when the scripts can't run
- `references/operations.md` — step-by-step algorithm for each operation, including the unmapped ones
- `references/gotchas.md` — write mechanics and the traps; read before the first write
- `references/site-map.md` — page map, attendance codes, URL contracts, provenance

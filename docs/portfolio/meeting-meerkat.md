# :material-bell-ring-outline: Replacing a paid automation with a self-built meeting bot

<div class="sj-meta" markdown>

:material-briefcase-outline: **Type:** Python service (internal automation, self-hosted)

:material-calendar-month-outline: **Date:** July 2026

:material-account-wrench-outline: **Role:** DevOps

</div>

---

## :material-lightbulb-outline: The idea { data-toc-label="The idea" }

We were paying a monthly fee for a no-code automation tool that did one small job: post a "meeting starting soon" nudge into the right Slack channel, based on a tag in each meeting's title. It worked, but it was a recurring cost and a third-party black box for something we could easily run ourselves. And since I was working on company-wide cost-saving initiative, I decided to rebuild it as a small in-house service.

## :material-cog-outline: What I built { data-toc-label="What I built" }

A small Python service that runs once a minute under `cron`. On each run it:

- Reads the scheduling account's Google Calendar over a read-only scope, and finds any meeting starting in the next couple of minutes.
- Parses the event: the channel tag in the title (written as `[#channel]`), the time, the Google Meet link, and the description (converting the calendar's HTML into Slack formatting so it reads cleanly).
- Posts a formatted "starting soon" message to the Slack channel named in that tag.
- Announces each meeting exactly once, keyed on the event id plus its start time, so recurring meetings and rescheduled ones are each handled correctly.
- Falls back gracefully: if the bot isn't in the tagged channel, the message still lands in a default channel with a short "invite me there" note, so a mis-tagged meeting never silently disappears.

## :material-shield-lock-outline: Building it safely { data-toc-label="Building it safely" }

The part I cared most about was giving it as little power as possible, since it runs unattended on a shared server with internal production services (my newly acquired security side again):

- Read-only calendar access, so the bot can never change anyone's calendar, and a Slack bot token scoped to `chat:write` and nothing else.
- A dedicated non-root service account for it to run under, so if the bot or one of its dependencies were ever compromised, the blast radius is a near-powerless identity, not the box that also runs version control, error tracking and CI.
- The tokens and OAuth client kept out of version control and locked down by file permissions, owned by that service user.
- A lockfile so a slow run can't overlap with the next minute's run and stack up.
- A crash alert: if the bot itself ever errors, it posts to an alerts channel before it exits, so an unattended failure doesn't go unnoticed. Monitoring the monitor.
- A `DRY_RUN` mode and a dedicated test channel, so I could iterate and test what it would post before pointing it at anything real.

## :material-toolbox-outline: Tech stack { data-toc-label="Tech stack" }

Python, the Google Calendar API with read-only OAuth 2.0, the Slack API, `cron` scheduling on Linux, Linux service accounts and file-permission-based secrets handling, and idempotent, self-monitoring design (dedupe state, lockfile, crash alert).

## :material-check-circle-outline: The outcome { data-toc-label="The outcome" }

The paid tool is gone. The bot has been running daily on `cron` ever since, it's more punctual than the thing it replaced, and it's one of the pieces that fed into a wider cost-saving effort. Because we own it now, anyone on the team can operate it, change the channels, or rotate its credentials, and I documented all of that for handover.

## :material-robot-outline: How I actually worked on this { data-toc-label="How I actually worked" }

My company is very AI-forward, so I built this by pairing with AI as a real-time guide, using it to learn the concepts as I went (OAuth scopes and token lifetimes, Linux service accounts and file permissions, `cron`, idempotent design) rather than to copy-paste blind. I drove every decision and checked the behaviour myself with dry runs and a dedicated test channel before it went near real ones. The security choices in particular were mine to insist on: running it as a non-root least-privilege user, keeping the calendar scope read-only, and keeping the secret tokens out of version control and locked down by file permissions. Getting to work this openly with AI is one of the things I value about an AI-forward team: it lets me take on work that would have felt out of reach not long ago, and actually learn as I go.

# :material-file-search-outline: Diagnosing a build trigger that failed silently

<div class="sj-meta" markdown>

:material-briefcase-outline: **Type:** DevOps case study (CI incident diagnosis)

:material-calendar-month-outline: **Date:** July 2026

:material-account-wrench-outline: **Role:** DevOps

</div>

---

## :material-clipboard-text-outline: The brief { data-toc-label="The brief" }

The team distributes prebuilt binaries of a large C++ application, so that artists and other non-engineers don't have to compile it themselves. When an engineer commits C++ changes, a commit trigger in our version-control system kicks off a job on our CI server that rebuilds those binaries and publishes them back into version control for the rest of the team to sync.

One day that stopped. New commits no longer produced new builds, so the published binaries went stale and people were blocked at launch with "missing modules" errors, unable to sync to the latest work. The tricky part: there was no error anywhere. Nothing had failed loudly, builds just quietly weren't happening, because nothing had been set up to catch this kind of silent failure. I'd taken the system over without a handover, so I was working it out from scratch.

## :material-magnify: Diagnostics and troubleshooting { data-toc-label="Diagnostics and troubleshooting" }

My first priority was getting the team moving again, so I kicked off the build manually to push fresh binaries out to them. That also handed me my first clue: the manual run worked perfectly, even though the last automated build was days old. So the build machine and the pipeline were healthy, and the fault was upstream: something was no longer triggering the build, or the trigger was being rejected.

Then I traced the mechanism. A commit trigger runs a shell script on matching commits, and that script calls the CI server's remote-build API, authenticating as a specific user with an API token. Both the trigger definition and the script were intact and unchanged, so this wasn't a deleted trigger or an edited script.

The timing was the next clue. Builds had carried on working fine through the cloud provider's scheduled full-server reboot for a critical security patch. They only stopped later, right after the version-control service restarted on its own, when a routine `apt` update I ran for something unrelated triggered a restart of the services flagged as needing one, that service among them. So nobody had edited anything by hand. The restart had simply made an existing change take effect.

The step that cracked it was splitting the request in two. I authenticated to the CI server as the trigger's user against a read-only endpoint that just echoes who you are, and got a `200`: the account and token were valid, so "token revoked" was ruled out. Then I reproduced the actual build request and got a `403`, "missing the Build permission." So the issue was authorisation: the login was valid, but the account no longer had permission to start the build.

The permission model explained the rest. The CI server used a project-based permission model, and the trigger's user was never named in it explicitly. It had only ever been able to start builds through a broad "authenticated users can build" grant, and at some point that grant seems to have been narrowed to read-only. I couldn't tell exactly when or by whom, but the running service had kept working on its old state until the restart, which is when the narrowed permission finally bit. And because the trigger script always exited success, it swallowed the rejection, which is exactly why the whole thing failed invisibly for days.

## :material-bullseye-arrow: Root cause { data-toc-label="Root cause" }

The trigger authenticated as a departed engineer's account whose ability to start builds came only from a broad "authenticated users can build" permission. At some point that grant seems to have been reduced to read-only, and the change took full effect once the service restart cleared the old running state. From then on the trigger's build requests were rejected with a `403`, and the script's unconditional success-exit hid the rejection completely.

## :material-wrench-outline: How I fixed it { data-toc-label="How I fixed it" }

The steer was to get this pipeline working again, not to re-engineer it, since the team was already moving away from this workflow. So the priority was restoring service, and I captured the durable hardening as tracked follow-ups.

- Restored service the least-privilege way: granted the account Build and Read on that one job only, not admin, putting it back to a known-good state without over-granting.
- Verified end to end with a test commit: I committed a harmless placeholder file under a watched source path, then watched the trigger fire and the CI server queue the build on its own, confirming the full chain (commit to trigger to script to build) worked automatically again.
- Logged the underlying fragilities as follow-ups for when the pipeline is prioritised again: move the trigger onto a dedicated service account rather than a person's, stop hardcoding the API token in a readable script, and make the script surface failures instead of exiting success silently.

## :material-toolbox-outline: Tech stack { data-toc-label="Tech stack" }

Commit-based triggers in version control, a CI server and its remote-build API, HTTP and API debugging with `curl` (status codes and authenticated requests), authentication versus authorisation in a project-based permission model, Linux server diagnostics, hypothesis-driven bisection to isolate the failing layer, prebuilt-binary distribution, and clear documentation.

## :material-check-circle-outline: The outcome { data-toc-label="The outcome" }

The team was unblocked first, and the automation was restored and verified working end to end the same day. The "it just stopped for no reason" turned out to be a silent `403`: the account's permission to start builds had quietly been narrowed, and a routine restart made it take effect. The deeper weaknesses (a departed employee's account used as a service identity, a plaintext token, and a failure mode that hid itself) were documented and ticketed for a proper fix.

## :material-robot-outline: How I actually worked on this { data-toc-label="How I actually worked" }

I worked through this by pairing with AI as a real-time guide and rubber duck, both to move fast while people were blocked and to learn the concepts as I went (version-control triggers, how prebuilt binaries map to commits, the CI server's permission model, and the difference between authentication and authorisation). I drove every command and check myself, and I isolated the cause with evidence rather than guesswork: proving authentication was fine (a read-only identity check returning `200`) before checking authorisation (the build request returning `403`). Getting to work this openly with AI is one of the things I value about an AI-forward team, it lets me pick up unfamiliar systems quickly and actually understand them.

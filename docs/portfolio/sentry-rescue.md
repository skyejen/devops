# :material-lifebuoy: Rescuing a self-hosted Sentry that had been down for weeks

<div class="sj-meta" markdown>

:material-briefcase-outline: **Type:** DevOps case study (production incident and rebuild)

:material-calendar-month-outline: **Date:** July 2026

:material-account-wrench-outline: **Role:** DevOps

</div>

---

## :material-clipboard-text-outline: The brief { data-toc-label="The brief" }

The whole brief was one line: "the cloud server's vCPU is at 101%, I think it started when I reinstalled Sentry, need to look into."

The system: a self-hosted Sentry instance (crash and error tracking for the game and internal tools), running roughly 70 containers via Docker Compose on a shared cloud server, the same box as our version-control system and CI/CD. The vCPU had been sat at 101% for weeks and Sentry was flat-out unusable.

## :material-magnify: Diagnostics and troubleshooting { data-toc-label="Diagnostics and troubleshooting" }

Looked at the container states and logs first. A wall of services stuck in `Restarting` with high restart counts, so this was a crash-loop on boot. Traced the crashes to missing Kafka topics (the consumers had nothing to read from), and noticed the instance was running an unstable `nightly` build instead of a `stable` release.

The clean reinstall then kept dying, and not where I expected. It failed every time at a newer storage component (`seaweedfs`), and the error didn't obviously say why. Instead of retrying the same install and hoping (which was tempting), I stepped back and mapped the actual disk layout: fast NVMe for the OS, slow HDD for bulk storage (a network block-storage volume that version control and CI were also hammering). I confirmed with `iostat` that the HDD was running about 99% utilised with high I/O latency. That was the real culprit: a latency-sensitive service kept landing on a saturated disk and couldn't form its cluster.

So there were three things feeding the mess:

- The broken `nightly` build plus missing Kafka topics, which caused the original crash-loop and the 101% CPU.
- A latency-sensitive storage service repeatedly landing on the slow, saturated disk, which is why the reinstall kept failing.
- Crash-dump storage that had grown with nothing capping it (about 900 GB), filling the disk.

## :material-wrench-outline: How I fixed it { data-toc-label="How I fixed it" }

- Reinstalled Sentry cleanly on a `stable` release, with the Docker data root on the fast NVMe so the storage service could actually form its cluster.
- Kept only the big, latency-insensitive crash-dump filestore on the roomy HDD (bind-mounted), so it can't fill the smaller OS disk. I ran a write test to confirm the data physically lands on the HDD.
- Restored HTTPS on the web UI: reapplied the `nginx` TLS config and certificate on the right port, and fixed a healthcheck that was still probing the old one.
- Recreated the org, the projects and the admin account, and created a brand-new least-privilege shared account that hadn't existed before (my security side kicking in), storing both sets of credentials in the team password manager, in the right folders.
- Documented the final setup (architecture, config, disk layout, backup locations, operational commands) and wrote a step-by-step checklist for reinstalling from scratch, so the next person doesn't have to rediscover everything I did.

## :material-toolbox-outline: Tech stack { data-toc-label="Tech stack" }

Docker and Docker Compose, self-hosted Sentry, `nginx` and TLS, Linux disk and I/O diagnostics (`iostat`, NVMe vs HDD), storage architecture and bind mounts, and clear documentation.

## :material-check-circle-outline: The outcome { data-toc-label="The outcome" }

From crash-looping and unusable, a shared server stuck at 101% for weeks, to clean, healthy and stable: CPU back near idle, HTTPS working, crash-dump storage safely off the OS disk, a fresh least-privilege account, and the whole thing documented and ready to wire into the game client.

## :material-robot-outline: How I actually worked on this { data-toc-label="How I actually worked" }

A lot of this was unfamiliar ground for me. My company is very AI-forward, so I'm lucky to be able to openly lean on AI to learn new things, step out of my comfort zone, and support the team wherever they need me. I used it as a real-time guide and rubber duck to learn the concepts as I went (Docker internals, storage backends, disk I/O, TLS), then turned that into my own commands, decisions and checks. This is an internal production system, so I would never blindly copy-paste onto it. I made sure I understood the why behind every step before I ran it.

## :material-bell-outline: A reliability check I added alongside it { data-toc-label="A reliability check I added alongside it" }

The Windows build machine's Docker engine wasn't restarting after unattended reboots, which silently broke the CI pipeline until someone noticed a failed build. I built a small PowerShell and Task Scheduler job that checks on every boot whether Docker is running, and posts a Slack alert if it isn't. This already saves me time checking, and it means the team knows if something is off. What a bit of Windows automation can achieve: my own little reliability-and-monitoring helper.

# :material-server-network: The Living Stars - infrastructure and operations

<div class="sj-meta" markdown>

:material-briefcase-outline: **Type:** Side project - hosting, CI/CD, database, and backups

:material-calendar-month-outline: **Date:** May 2026

:material-account-wrench-outline: **Role:** CI/CD and Ops

</div>

---

## :material-clipboard-text-outline: The setup { data-toc-label="The setup" }

The Living Stars is a live web app (an interactive knowledge-graph star map, see the [companion write-up on the app itself](https://skyejen.github.io/generalist-tech/portfolio/living-stars/)), which I built as my solo side-project. This piece is about everything around it: getting it hosted, giving it a real database, deploying it automatically, keeping dev and prod separate, and setting up backups for proper data loss prevention.

## :material-sitemap-outline: Architecture { data-toc-label="Architecture" }

- **Source:** a GitHub repository (under its own organisation).
- **Hosting and delivery:** Cloudflare Pages, which serves the built site from a global CDN (copies cached close to each visitor for speed).
- **Data:** Supabase (managed PostgreSQL) holds nodes, positions, connections, categories, and rich-text content.

A push to the production branch becomes a live site with no manual step in between.

## :material-rocket-launch-outline: Continuous deployment { data-toc-label="Continuous deployment" }

Deployment runs through Cloudflare Pages' git integration with automatic deployments enabled. On each push it runs the pipeline itself, initialise, clone, build (Vite), deploy, and publishes. Production tracks a dedicated production branch, kept separate from my working branches on purpose so nothing reaches the live site by accident. Other branches get their own preview deployments on unique URLs, so I can see a change live before it ships. A typical build and deploy takes around twenty seconds.

## :material-database-sync-outline: Automated database backups { data-toc-label="Automated backups" }

Cloudflare handles the app, but the data lives in Supabase, and on the free tier there's no safety net if something goes wrong. So I built one: a scheduled GitHub Action that backs the database up on its own, into a dedicated backup repository within the organisation.

- Runs on a cron schedule, twice a day (midnight and noon UTC), plus a manual trigger.
- Installs the Postgres 17 client to match the Supabase server version, then runs pg_dump against the database (public schema, plain SQL, `--clean --if-exists`, no owner or ACL noise).
- Configured to keep the most recent 60 dumps (a 30-day rolling window at twice daily) and prune the rest.
- Commits each backup back to that dedicated repository, so there's a versioned, timestamped history off Supabase entirely.
- The database password is held as a GitHub secret, never in the code.

The result is a self-running, 30-day rolling backup history with next to no ongoing effort, and a clean restore path if I ever need one.

## :material-tune-variant: Environments and data { data-toc-label="Environments and data" }

- A separate dev setup (run locally against its own Supabase project) and a live prod, each with their own configuration and keys.
- A dedicated showcase dataset, so the tool can be demonstrated safely without touching real content.
- A stress-test dataset, built to check the force simulation and rendering stay smooth as the graph grows.

## :material-school-outline: What I got out of it { data-toc-label="What I got out of it" }

This was my first time running something real end to end, on my own: pushing code and watching it go live, keeping a real database healthy, splitting dev from prod, and trusting that the data is safe if a day goes badly. Setting up safety nets and solid workflows, and being genuinely in control of (and accountable for) the whole thing, was a refreshing and empowering experience.

That said, the learning was a by-product. The real reason for the project was that it was a surprise for my wonderful boyfriend, and that was the fuel to make it run smoothly and securely. More on that in the [companion write-up](https://skyejen.github.io/generalist-tech/portfolio/living-stars/)!

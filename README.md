# skyejen / devops

DevOps portfolio and write-ups, part of [skyejen.github.io](https://skyejen.github.io).

Live at **https://skyejen.github.io/devops**

## Local development

This site shares a design system with my other repos via the `sj-theme` git submodule.

```bash
git clone https://github.com/skyejen/devops.git
cd devops
git submodule update --init            # pull in sj-theme
pip install "mkdocs-material>=9.7,<10" "pymdown-extensions>=10,<11"
mkdocs serve                           # http://127.0.0.1:8002
```

## Structure

- `docs/portfolio/` — DevOps case studies
- `docs/sj-theme/` — shared theme (git submodule)
- `overrides/` — theme customisations

Deploys automatically to GitHub Pages on push to `main` (see `.github/workflows/deploy.yml`).

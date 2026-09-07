---
name: project-nordicos-repo-layout
description: Estructura y convenciones de versionado del repo NordicOS (dotfiles) relevantes para preparar commits
metadata:
  type: project
---

Repo NordicOS: dotfiles versionados bajo `home/` (espejo de `$HOME`), con
`install.sh` como script de restauración vía symlinks. Convenciones a
respetar al preparar commits:

- `backups/` está en `.gitignore` (incluye subdirectorios de cuarentena tipo
  `backups/quarantine-<timestamp>/`) — nunca debe colarse en un commit.
- `.claude/agent-memory/` SÍ se versiona (memoria de proyecto persistente de
  los agentes del pipeline AIEOS). `.claude/pipeline-state.json` NO se versiona
  (estado efímero, ignorado desde 2026-09-07).
- `docs/requirements/` contiene documentos de análisis funcional generados
  durante el pipeline (etapa Analysis) — se versionan como documentación de
  ingeniería legítima.
- Scripts ejecutables (`bin/*.sh`, `home/.local/bin/*.sh`) deben quedar con
  modo 100755 en el índice de git — verificar con `git ls-files -s <path>`
  antes de comitear.
- Estilo de commits: Conventional Commits en español (`fix`, `feat`, `chore`,
  `docs`, `refactor`), cuerpo detallado en español explicando el porqué y
  listando archivos/cambios relevantes por bullet.

**Why:** Evita colar basura versionada (cuarentenas, estado efímero) y
mantiene el historial de dotfiles limpio y coherente con lo ya establecido.

**How to apply:** Antes de cualquier `git add` en este repo, correr
`git status --ignored` y confirmar que `backups/` y
`.claude/pipeline-state.json` no aparecen como untracked/staged.

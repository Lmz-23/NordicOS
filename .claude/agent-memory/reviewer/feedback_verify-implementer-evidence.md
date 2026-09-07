---
name: verify-implementer-evidence
description: En NordicOS, contrastar siempre la evidencia autorreportada por el implementador contra el estado real de git antes de aceptarla
metadata:
  type: feedback
---

Nunca aceptes como cierto lo que el agente implementador reporta haber hecho. Contrasta cada afirmación contra `git status --short` / `git diff HEAD` y el estado real del sistema antes de fundamentar el veredicto en ella.

**Why:** En el ciclo del 2026-09-07 (reparación post-mudanza del repo) `devops` reportó explícitamente haber corregido una línea en `bin/sync-tracking.sh`; ese archivo estaba intacto en git y el cambio real estaba en `install.sh`. El reporte era una misatribución, no una regresión — pero un veredicto basado en el reporte habría evaluado un archivo equivocado.

**How to apply:** Antes de evaluar cualquier "desviación reportada", localiza el cambio en el diff real. Si no aparece ahí, el hallazgo es de trazabilidad del reporte, no del código. Vale también para evidencia de ejecución (idempotencia, manifiestos, units habilitadas): reprodúcela con comandos de solo lectura cuando sea barato hacerlo.

Ver [[nordicos-repo-move-debt]].

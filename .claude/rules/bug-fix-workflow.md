# Bug-Fix Workflow

Cómo el equipo arregla bugs. Este flujo aplica a CADA bug. Es un loop cerrado: el bug
entra como issue, sale como fix verificado, y cada fallo mejora el sistema.

## El loop

1. **Toma un issue.** Los bugs viven como GitHub Issues con label `bug`. Toma el de
   mayor severidad primero.
2. **Causa raíz antes que fix.** NO escribas un fix sin entender por qué pasa. Reproduce
   el bug, encuentra la causa real. Un fix sin causa raíz comprobada = bug que regresa.
   - Bugs de TPV / pagos → revisa Firebase Crashlytics primero (MCP disponible).
   - Errores de servidor → betterstack.
3. **Fix + test de regresión.** TODO fix trae un test que (a) falla con el bug presente,
   (b) pasa con el fix. Sin ese test, el bug puede volver en silencio.
4. **Verde local.** `npm run pre-deploy` (build + lint + tests) en verde ANTES de abrir
   el PR. Detalle completo: `.claude/rules/testing-and-git.md`.
5. **No rompas nada.** Verifica que las features relacionadas siguen funcionando — no
   solo la que arreglaste.
6. **Abre el PR.** Liga el issue con `Closes #N`. En la descripción: causa raíz, el fix,
   y qué test lo cubre.
7. **Espera revisión.** **Nada se mergea sin revisión de Jose.** El empleado + Claude
   llegan hasta "PR abierto y en verde" — el merge lo da Jose. (Esta política se
   relajará conforme se construya confianza.)

## Definition of Done

Un bug está "hecho" sólo cuando:

- [ ] Causa raíz identificada y escrita en el PR
- [ ] Fix aplicado
- [ ] Test de regresión que falla sin el fix y pasa con él
- [ ] `pre-deploy` / CI en verde
- [ ] PR abierto y ligado al issue (`Closes #N`)
- [ ] Revisado y mergeado por Jose

## Capa de aprendizaje (importante)

Si para resolver el bug batallaste porque un mapa o una regla estaba mal o incompleta
— el `SCHEMA_MAP.md`, el `CLAUDE.md`, el ecosystem map, una `.claude/rule` — **arréglalo
en el mismo PR** o abre un issue aparte. El sistema de onboarding se mejora con cada
fallo real; un mapa que confundió a un agente es un bug del mapa.

# /retomar

Retomá el trabajo en este repo desde donde quedó, usando el journal de sesiones en `docs/`.

Este comando asume la convención de journal: `docs/00-index.md` (índice, apunta siempre a la entrada más
reciente) + `docs/journal/<fecha>.md` (una entrada por sesión de trabajo, con un cierre "Próxima sesión —
empezar acá"). La crea `/cerrar` la primera vez que se usa — si todavía no existe, no hay nada que retomar
(ver Paso 0).

## Paso 0 — Ubicá el proyecto

El directorio actual puede ser este repo (`nextjs-starter`) o un workspace que lo contiene como subcarpeta
(p. ej. junto a un `nestjs-starter` hermano). Encontrá el dir que contiene `docs/00-index.md` **y** un repo
git:

- Si el cwd ya cumple ambas condiciones, usalo.
- Si no, buscá con Glob `**/docs/00-index.md` y usá esa carpeta como base (`<dir>`).
- Si no aparece ningún `docs/00-index.md` en todo el árbol: **no hay journal todavía** — probablemente es la
  primera sesión de este proyecto. Decilo, mostrá `git -C <dir> log --oneline -5` y `git -C <dir> status -sb`
  para dar contexto igual, y no sigas con los pasos de abajo.

Corré git siempre como `git -C <dir> …`.

## Pasos

1. Leé `<dir>/docs/00-index.md` y la entrada **más reciente** (por fecha) de `<dir>/docs/journal/`.
2. Mirá el estado real del repo: `git -C <dir> status -sb` y `git -C <dir> log --oneline -5`.
3. Resumí en pocos bullets: en qué estado quedó el proyecto y qué dice la sección "Próxima sesión — empezar
   acá" de la última entrada.
4. Chequeá si hay algo del entorno local que levantar antes de seguir (p. ej. `pnpm dev`, o si el backend
   asociado necesita estar corriendo para probar algo).
5. Proponé el próximo paso concreto y **esperá el OK** antes de implementar o de tomar cualquier acción que
   cambie estado externo (deploys, push, etc.).

No toques nada hasta que se confirme.

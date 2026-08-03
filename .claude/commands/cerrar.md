# /cerrar

Cerrá la sesión de trabajo en este repo, dejando un journal claro para la próxima vez que se corra
`/retomar`.

## Paso 0 — Ubicá el proyecto

El directorio actual puede ser este repo (`nextjs-starter`) o un workspace que lo contiene como subcarpeta.
Encontrá el dir que contiene (o debería contener) `docs/00-index.md` y un repo git:

- Si el cwd ya es un repo git, usalo como `<dir>`.
- Si no, buscá con Glob `**/docs/00-index.md` o el repo git más cercano y usá esa carpeta como base.

Corré git siempre como `git -C <dir> …`.

## Pasos, en orden

1. **Verificá.** `git -C <dir> status -sb`; corré los checks relevantes si aplica (`pnpm lint`, `pnpm
   typecheck`, `pnpm build`). Reportá honesto — si algo falla o quedó a medias, no lo escondas ni lo
   maquilles en el journal.
2. **Journal.** Si `<dir>/docs/00-index.md` y `<dir>/docs/journal/` no existen todavía, creálos ahora (es
   normal en la primera sesión del proyecto): un índice mínimo en `00-index.md` que enlace a la entrada de
   hoy, y `docs/journal/<fecha-de-hoy>.md` con:
   - qué se hizo en la sesión,
   - decisiones tomadas y por qué,
   - una sección **"Próxima sesión — empezar acá"** con next steps concretos y accionables.

   Si ya existían, actualizá o creá la entrada de hoy y mantené `00-index.md` apuntando a la más reciente.
3. **Memoria.** Si surgió algo durable (una preferencia del usuario, una decisión de UI/arquitectura, un
   gotcha no obvio), guardalo o actualizalo en la memoria persistente. No dupliques lo que ya vive en el
   repo (código, `CLAUDE.md`, el journal mismo).
4. **Commit + push.** Commiteá lo pendiente en pasos chicos y coherentes, y pusheá. Respetá la identidad
   git configurada localmente en este repo — **nunca firmes ni agregues atribución a Claude** (sin
   `Co-Authored-By`, sin "Generated with Claude" ni similares).
5. **Resumen final.** Un mini-resumen (3-5 bullets) de lo hecho + el próximo paso concreto para la próxima
   sesión.

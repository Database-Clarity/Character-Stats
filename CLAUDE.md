# CLAUDE.md

Destiny 2 character-stat database (ability cooldowns, stat curves, movement speeds) that
third-party apps like DIM and D2ArmorPicker download, plus a React web editor used to
maintain it. The detailed guides are [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) (data model,
how to add fields, entities and stats, versioning), [src/editor/README.md](src/editor/README.md)
(editor architecture) and [docs/EDITOR.md](docs/EDITOR.md) (end-user editor guide). Read the
relevant one before making non-trivial changes. This file only summarizes them.

## Branches

- `master` still holds the old v1 codebase. Active v2 work happens on `v2.0-overhaul`.
- `update.json` and `versions/1.*` are the published v1 data. v2 exports go to
  `versions/<major>/` (for example `versions/2/`) and are created by the data build.

## Commands

Requires Node 24 and npm 11.

```sh
npm run typecheck      # app + core-only check (core must not depend on DOM or Node)
npm test               # Vitest: tests/**/*.test.ts and src/editor/**/*.test.ts
npm test -- tests/movement.test.ts          # run a single test file
npm test -- -t "name of the test"           # filter tests by name
npm run format         # Prettier (4 spaces, single quotes, width 100, trailing commas)
npm run validate       # sources + en.json placeholders + export checked against schema.json
npm run schema         # regenerate schema.json from the registries
npm run dev -- --port <port> --strictPort   # editor at http://localhost:<port>/Character-Stats/editor/
npm run build          # editor -> dist/
```

- Don't use port 5173 for the dev server: it's reserved for the owner. Pick another port,
  and stop only the servers you start.
- In the dev editor, choose **Use local dev data** to edit an in-memory copy of the repository
  data. This needs no GitHub token, and Save and Publish are disabled.
- For live manifest names and icons, set `VITE_BUNGIE_API_KEY` in the root `.env.local`
  (gitignored).

After changing a registry, run `npm run schema`, `npm test`, `npm run validate`,
`npm run typecheck` and `npm run format:check`.

## Architecture

```text
sources/*.json + locale/en.json -> src/core (registries) -> src/cli  -> versions/<major>/, update.json
                                                          -> src/editor (React, GitHub API)
```

- **`src/core/`** is shared, browser-safe TypeScript. `config/tsconfig.core.json` type-checks it
  with no DOM or Node types, so don't import `node:*` or browser APIs there. Everything is
  re-exported from `src/core/index.ts`.
  - The field builders in `fields/builders.ts` produce `FieldSpec`s (types are in
    `fields/types.ts`). One spec drives validation, export, schema generation **and** the
    editor forms, so there is no per-stat editor wiring.
  - `entities/index.ts` holds each entity's TypeScript interface next to its `EntitySpec`,
    plus `entityRegistry`. `stats/*.ts` has one `StatSpec` per stat, registered in
    `stats/index.ts` (`statRegistry`). Movement lives in `movement/index.ts`.
  - `curves/` expands raw `Values` or piecewise `Segments` (Constant, Linear, or Expression;
    expressions use a custom parser with no `eval`).
  - `calc.ts` has the cooldown, regen, super-duration and `movementSpeed` calculators.
    `locale.ts` handles `{{Field}}` placeholders and tooltip rendering.
  - The pipeline modules are `validate.ts`, `export.ts`, `schemaGen.ts` and `sources.ts`
    (parsing, plus `serializeSource`: 4-space JSON with a trailing LF).
- **`src/cli/`** holds the Node entry points: `validate`, `schema` and `build-data`. `io.ts`
  loads sources and runs Ajv against `schema.json`.
- **`src/editor/`** is a React 19 + Vite app with no UI library and plain CSS in `styles/`.
  `state/store.tsx` holds the working edits, `github/client.ts` is the only REST boundary,
  `manifest/` holds the Bungie manifest (web worker, IndexedDB cache) and `components/` the
  views. Pure logic is split into tested `*.ts` helpers next to the components.
- Use registry metadata (`role`, `abilityKind`, `itemRef`, `lengthOf`, `indexLabel`) for
  meaning-dependent behavior. Never branch on collection or field names.

## Rules and gotchas

- **Generated files: don't hand-edit them.**
  - `schema.json` is produced by `npm run schema`.
  - `versions/`, `update.json` and the generated entries in `CHANGELOGS.md` are written by
    `npm run build:data`, which normally runs in the `build-data.yml` workflow (the editor's
    **Publish** button). To try it locally, pass `-- --out-dir <dir>` so the root files stay
    untouched.
  - The schema version baseline is `defaultConfig.schemaVersion` in `src/core/config.ts`. Its
    patch component must stay `0`; the build picks the patch number automatically.
- **Locale:** edit only `locale/en.json`. The other locale files are managed by Crowdin.
  Locale IDs are `<Stat>.<Key>`. Unknown placeholders and formatters are validation errors.
- When you add or change an entity interface, update the key maps and the `it.each` table in
  `tests/entity-interfaces.test.ts`. That parity test checks interface keys against
  `spec.fields`.
- Keep a field's `key` stable, because consumers depend on it. Change `label` to rename it in
  the editor.
  - `published: false` keeps a field in the source but leaves it out of the export and schema
    (for data that isn't ready yet).
  - `exported: false` is for permanent author-only metadata such as `Notes`.
- "Enhanced-only" curves use the domain `[100, 200]`, so export index 0 is stat 100.
- Numeric constraints encode structure, not guessed balance ranges. Don't invent gameplay
  values. Unknown movement values are written as 0 tiers or a ×1 multiplier, with
  `Notes: "Value unknown — needs testing"`.
  - Weapon `ReloadSpeed` and `Handling` curves are known placeholders.
- Keep core calculation results exact. Round only for display, for example with
  `formatMovementSpeed` in `src/editor/components/previewData.ts`.
- TypeScript runs with `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
  Omit an optional property rather than assigning `undefined` to it.
- When behavior changes, update the matching doc (`docs/DEVELOPMENT.md`,
  `src/editor/README.md` or `docs/EDITOR.md`) in the same change.
  - The data/schema and editor sections above are kept in sync with those docs, and README
    covers consumer-facing versioning.

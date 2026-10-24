# Development

## Architecture

```text
sources/ + locale/en.json -> src/core -> CLI / web editor -> versions/<schema-version>/
```

- [`sources/`](../sources/) contains stat and movement input JSON. [`locale/en.json`](../locale/en.json) is the editable English source; translated locale files are Crowdin-managed.
- [`src/core/`](../src/core/) is shared, browser-safe TypeScript. Field/entity/stat registries drive validation, export, schema generation, and editor forms.
- [`src/cli/`](../src/cli/) contains validation, data-build, and schema-generation entry points. The React editor is in [`src/editor/`](../src/editor/).
- [`versions/`](../versions/) contains published exports. [`update.json`](../update.json) identifies the current schema version.

The current stat registry contains Health, Melee, Grenade, Super, Class, and Weapons. Historical 1.x exports remain unchanged.

## Setup and scripts

Use Node.js 24 and npm 11. Install dependencies with `npm install`.

| Command                                      | Purpose                                                                                                                                                                                       |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                                | Start the Vite editor development server. Choose **Use local dev data** to edit a read-only in-memory copy of repository data without a token; Save and Publish are unavailable in this mode. |
| `npm run build`                              | Build the editor into `dist/` for `/Character-Stats/editor/`.                                                                                                                                 |
| `npm test`                                   | Run the Vitest suite.                                                                                                                                                                         |
| `npm run typecheck`                          | Type-check the app and the DOM/Node-independent core.                                                                                                                                         |
| `npm run format`                             | Format core, CLI, editor, tests, config files, and `package.json` with Prettier.                                                                                                              |
| `npm run format:check`                       | Check those files for Prettier formatting without writing changes.                                                                                                                            |
| `npm run validate`                           | Validate sources, English placeholders, and exported JSON against `schema.json`.                                                                                                              |
| `npm run schema`                             | Generate `schema.json` from the core registry.                                                                                                                                                |
| `npm run build:data`                         | Validate and write the current version's pretty/minified export and `update.json`.                                                                                                            |
| `npm run build:data -- --schema-version X.Y` | Build a specified version; use a new version for a breaking release.                                                                                                                          |

`build:data` also accepts `--out-dir <directory>`. It uses the output's existing `update.json` version, falling back to the repository's current version when no version is supplied. Validation errors prevent export writes. These are the CLI's supported flags; see [`src/cli/build-data.ts`](../src/cli/build-data.ts).

## Adding a field to a stat

Stat definitions live in one file per stat under [`src/core/stats/`](../src/core/stats/), for example [`melee.ts`](../src/core/stats/melee.ts). Add a field builder call to that stat's `fields` list. Builder calls return `FieldSpec`s; descriptions belong inline in the options for that field.

```ts
import { curve, integerField, numberField } from '../fields/builders';

fields: [
    curve('NewCurve', {
        domain: [0, 100],
        items: { min: 0 },
        description: 'Describe the value represented at each stat point.',
    }),
    numberField('NewScalar', {
        min: 0,
        description: 'Describe this non-integer value.',
    }),
    integerField('NewCount', {
        min: 0,
        description: 'Describe this whole-number value.',
    }),
];
```

Use the actual helper for the data kind: `curve`, `numberField`, `integerField`, `numberArrayField`, `integerArrayField`, or `localeField`. `curve` sets a default nonnegative item constraint; specify `domain` and any field-specific constraints. `hashField`, `nameField`, and `notesField` are the shared entity helpers. Most fields are required by default; set `required: false` for optional fields. Add matching values under `Fields` in the affected [`sources/stats/`](../sources/stats/) file(s). For a curve, source JSON may use raw `Values` or validated piecewise `Segments` (see below).

## Adding an entity or collection

Entity TypeScript interfaces and their `EntitySpec`s live together in [`src/core/entities/index.ts`](../src/core/entities/index.ts). For a new or changed entity property, add the matching interface property and builder call in `EntitySpec.fields`. Use the builders there, add a new spec to `entityRegistry`, and add the collection to a stat's `collections` map (or [`src/core/movement/index.ts`](../src/core/movement/index.ts) for movement). For example, a stat's map can include `collections: { CooldownItems: cooldownItemSpec }`. Add the corresponding optional collection property and type import to `StatSource` or `MovementSource` in [`src/core/sources.ts`](../src/core/sources.ts), then add matching records to the source JSON. Use `uniqueKey` for an entity's non-default identity key and `anyOf` for alternative required-field groups where appropriate.

For example, this follows the existing entity pattern:

```ts
import type { EntitySpec } from '../fields/types';
import { hashField, nameField, notesField, numberField } from '../fields/builders';

export interface CooldownItem {
    Hash: number;
    Name: string;
    BaseCooldown: number;
    Notes?: string;
}

export const cooldownItemSpec: EntitySpec = {
    name: 'CooldownItem',
    fields: [
        hashField(),
        nameField(),
        numberField('BaseCooldown', {
            exclusiveMin: 0,
            round: 3,
            description: 'Base cooldown in seconds.',
        }),
        notesField(),
    ],
};
```

Register the spec in the `entityRegistry` literal:

```ts
export const entityRegistry = {
    Ability: abilitySpec,
    SuperAbility: superAbilitySpec,
    Override: overrideSpec,
    MovementClass: movementClassSpec,
    CooldownItem: cooldownItemSpec,
} as const;
```

Then use it from a stat, e.g. `collections: { CooldownItems: cooldownItemSpec }`. For a new stat-source collection, add its type import and property to `StatSource` in `src/core/sources.ts`, then populate the collection in the stat's source JSON. For example, `CooldownItems?: CooldownItem[]` is the type shape for the collection above.

When adding or changing an entity interface, update the parity fixtures and `it.each` cases in [`tests/entity-interfaces.test.ts`](../tests/entity-interfaces.test.ts). Add a key map for all interface properties (including optional ones), then add it alongside the new spec in the test table:

```ts
const cooldownItemKeys = {
    Hash: true,
    Name: true,
    BaseCooldown: true,
    Notes: true,
} satisfies Record<keyof CooldownItem, true>;

// Add to the existing it.each entries:
{ name: 'CooldownItem', spec: cooldownItemSpec, keys: cooldownItemKeys }
```

The parity test compares the interface keys with `spec.fields`; run `npm test` to verify it.

## Adding a stat

Create a file in [`src/core/stats/`](../src/core/stats/) exporting a `StatSpec`. A minimal curve-based stat uses the same `StatSpec` and builder shape as the existing stat definitions:

```ts
import type { StatSpec } from './types';
import { curve } from '../fields/builders';

export const exampleSpec: StatSpec = {
    name: 'Example',
    hash: 1234567890, // Use the stat's real manifest hash.
    collections: {},
    fields: [
        curve('CooldownScalars', {
            domain: [0, 100],
            items: { min: 0 },
            description: 'Describe the curve and its stat-point indexing.',
        }),
    ],
};
```

Import and export the new spec from [`src/core/stats/index.ts`](../src/core/stats/index.ts), and add it to `statRegistry`:

```ts
import { exampleSpec } from './example';
// Add `exampleSpec` to the existing exports and statRegistry array.
export { exampleSpec };
export const statRegistry = [
    healthSpec,
    meleeSpec,
    grenadeSpec,
    superSpec,
    classSpec,
    weaponsSpec,
    exampleSpec,
] as const;
```

Add `sources/stats/<stat>.json` with matching `Hash`, `Name`, `Fields`, and any registered collections. Add the stat's required English strings in [`locale/en.json`](../locale/en.json): `Overview`, `BaseStatTooltip`, and `EnhancedStatTooltip`, plus `ChargeBasedScalingTooltip` when the stat has `Abilities`. Locale IDs are generated from the stat name and key. The registry drives the editor's stat navigation; no editor-specific wiring is needed.

After changing a registry, run `npm run schema`; [`schema.json`](../schema.json) is generated and must never be hand-edited. Then run `npm test`, `npm run validate`, `npm run typecheck`, and `npm run format:check` as appropriate. Update focused tests if they assert a fixed stat list or generated schema.

## Curve sources and expressions

A curve is either raw `{"Values":[...]}` with one finite value per integer x, or a piecewise object with `Domain`, optional `Round`, and `Segments`. The field builder specifies its domain, commonly `0-100`, `0-200`, or `101-200`. Raw values are ordered from the domain's lower bound.

These are separate valid segment examples for a `0-100` field; each covers that domain exactly once:

```json
{ "Domain": [0, 100], "Round": 3, "Segments": [{ "Type": "Constant", "From": 0, "To": 100, "Value": 1 }] }
{ "Domain": [0, 100], "Segments": [{ "Type": "Linear", "Points": [[0, 1], [50, 0.75], [100, 0.5]] }] }
{ "Domain": [0, 100], "Segments": [{ "Type": "Expression", "From": 0, "To": 100, "Expression": "1 - 0.005*x" }] }
```

`Constant` and `Expression` segments have inclusive integer `From`/`To` bounds. `Linear` segments interpolate between at least two ascending `[x, y]` points. Segments must cover every integer in the domain exactly once. Expressions support numbers, `x`, parentheses, unary signs, `+ - * / ^` (right-associative power), `pi`, `e`, and `min`, `max`, `abs`, `floor`, `ceil`, `round`, `sqrt`, `log` (base 10), `ln` (natural log), `exp`, `pow`, and `clamp`. They are parsed without JavaScript evaluation; non-finite results are invalid.

## Validation, schema, and publishing

`npm run validate` checks sources, locale placeholders, and exported JSON against the committed draft-06 schema. `npm run schema` regenerates that schema from the registries. Warnings do not block data builds; errors do.

In the editor, **Publish** dispatches `build-data.yml` on the selected branch. The workflow tests and validates, builds the versioned JSON and `update.json`, and commits generated data as `github-actions[bot]`. A dispatch on `master` then runs the reusable Pages workflow; it checks out the latest `master`, builds the editor, and deploys the site. Other branches build and commit data without deploying Pages. For end-user editor instructions, use [`docs/EDITOR.md`](EDITOR.md); for the editor's development architecture and limitations, see [`src/editor/README.md`](../src/editor/README.md).

## One-time GitHub setup

1. In repository **Settings > Pages**, set **Source** to **GitHub Actions**.
2. Create a fine-grained personal access token scoped only to `Database-Clarity/Character-Stats`, with **Contents: Read and write**, **Pull requests: Read and write**, **Actions: Read and write**, and **Metadata: Read-only**. Keep the token private; the editor stores it in session storage by default and supports opt-in local storage.

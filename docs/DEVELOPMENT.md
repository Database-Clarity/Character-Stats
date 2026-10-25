# Development

## Architecture

```text
sources/ + locale/en.json -> src/core -> CLI / web editor -> versions/<major>/
```

- [`sources/`](../sources/) contains stat and movement input JSON. [`locale/en.json`](../locale/en.json) is the editable English source; translated locale files are Crowdin-managed.
- [`src/core/`](../src/core/) is shared, browser-safe TypeScript. Field/entity/stat registries drive validation, export, schema generation, and editor forms.
- [`src/cli/`](../src/cli/) contains validation, data-build, and schema-generation entry points. The React editor is in [`src/editor/`](../src/editor/).
- [`config/`](../config/) contains the Vite, Vitest, and core-only TypeScript configurations. Prettier settings are in `package.json`; the root `tsconfig.json` remains for workspace/editor discovery.
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
| `npm run build:data [--release-notes "text"] [--out-dir dir]` | Validate and build data, automatically choosing the next published version. |

With npm, pass optional script arguments after `--`, for example
`npm run build:data -- --release-notes "Adjusted grenade data" --out-dir build-output`.
There is no manual schema-version argument. The version baseline is
`defaultConfig.schemaVersion` in [`src/core/config.ts`](../src/core/config.ts)
(currently `2.0.0`); its patch component must remain `0`. Maintainers bump the
major component for breaking schema or export changes, and the minor component
for backward-compatible additions. The builder compares consumer output with
the previous published JSON: changed output under the same major/minor gets the
next patch version automatically. A higher configured major/minor always publishes
`X.Y.0`, even when the JSON is identical, to alert consumers to newly supported
schema/API features; a lower one is rejected.

The build is a no-op only when the configured and published major/minor match
and both the pretty and minified consumer JSON outputs are unchanged. In that
case, it leaves all outputs, `update.json`'s timestamp, and `CHANGELOGS.md`
untouched, even when release notes were supplied; notes alone do not create a
release on an unchanged baseline. On a published build, `--release-notes` adds
freeform text alongside the generated data-change summary in `CHANGELOGS.md`,
dated in UTC. With `--out-dir`, the builder compares against that directory's
`update.json` when present; if it has no isolated metadata, it reads the prior
published baseline from the repository root. It writes generated files only to
the requested output directory.

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

Use the actual helper for the data kind: `curve`, `numberField`, `integerField`, `numberArrayField`, `integerArrayField`, `enumField`, `objectField`, `objectArrayField`, or `localeField`. `curve` sets a default nonnegative item constraint; specify `domain` and any field-specific constraints. `hashField`, `nameField`, and `notesField` are the shared entity helpers. Most fields are required by default; set `required: false` for optional fields. Add matching values under `Fields` in the affected [`sources/stats/`](../sources/stats/) file(s). For a curve, source JSON may use raw `Values` or validated piecewise `Segments` (see below).
Use `label` for a concise, unit-specific editor name such as `Damage increase (%)` or `Cooldown scalar`; keep the stable `key` unchanged for source and consumer compatibility.

## Dynamic locale placeholders

Dynamic locale strings can substitute a stat property with `{{Field}}`. Unit tokens such as
`{{Percent}}` are literal suffixes, so `{{DamageIncrease}}{{Percent}}` keeps the property's
stored percentage value unchanged. For a scalar that should be displayed as a percentage, use
the explicit formatter `{{EnergyGainScalar|ScalarPercent}}`; it multiplies that value by 100 and
adds `%` without changing the exported source value. Consumers that render dynamic locale strings
must support this formatter. Unsupported formatter expressions and unknown fields are validation
errors.

## Enum and nested-object fields

Enums store strings. Give each allowed value a description; validation and generated schema use the same list:

```ts
import { enumField, objectField, objectArrayField } from '../fields/builders';

enumField('Activation', [
    { value: 'Always', description: 'Active while equipped.' },
    { value: 'Conditional', description: 'Active only while the condition is satisfied.' },
], { description: 'When this source applies.' });

objectField('Rules', rulesSpec, { description: 'Shared rules.' });
objectArrayField('Effects', effectSpec, {
    minItems: 1,
    description: 'Effects supplied by this source.',
});
```

Both nested helpers take an `EntitySpec`. Fields validate recursively, nested curves expand on export, and nested `Notes` stay editor-only. Arrays support `minItems`, `maxItems`, and `lengthOf`; an entity's `uniqueKey` controls duplicate checks (Movement effects use `Type`). Nested specs generate inline object schemas, so they do not have to be separately registered unless another consumer needs them. Enum and nested-object editing currently uses a generic read-only JSON preview; full editor controls come in step 2.

Set `published: false` on a field whose source data must be retained and validated but is not ready for consumers. The editor marks it **Unpublished**; export and schema omit it recursively. This is distinct from `exported: false`, which is for permanent author-only metadata such as `Notes`. Change `published` to `true` (or remove it) when measurements are ready, then regenerate the schema. `Movement.Rules.JumpHeight` is an unpublished, zero-valued curve placeholder, not published jump-height data.

## Ability cooldown calculations

Class, Grenade and Melee cooldowns apply their `CooldownScalars` curve after base replacements and override multipliers. Super cooldowns are independent of the Super stat. They use `BaseCooldown`, with applicable `CooldownOverride` replacements and `Scalar` multipliers only. `effectiveCooldown` handles both kinds. `calculateCooldown` ignores its curve argument for Super abilities. When a stat has no `CooldownScalars`, both calculators use identity scaling (factor 1), preserving base replacements and override multipliers. `ActiveRegenScalars` and `EnergyGainScalar` still scale Super regeneration and external energy gains.

## Movement data and calculations

`sources/movement.json` contains one `Rules` object, `Classes`, and `Sources`. Hidden Mobility is measured in tiers, not the old 0-100 stat points. Walk speed uses tiers 0-13; class bases differ by activity only when `BaseMobilityTierPVP` is present. Source `Effects` are generic object arrays with an enum `Type` and cumulative `Values`: index 0 is one stack, index 1 is two stacks, and so on. `BoostedValues` replaces that effect's values when every `BoostRequiresAll` item is equipped. Both arrays must have equal lengths. Unknown tiers use 0 and unknown multipliers use 1, with `Notes: "Value unknown — needs testing"`.
Machine guns and rocket launchers use `OverweightMultiplier`, which affects grounded non-sprint speeds only. `GroundedMultiplier` continues to affect all grounded movement, including sprint.

`RefType` selects `DestinyInventoryItemDefinition` (`item`) or `DestinyItemCategoryDefinition` (`itemCategory`). A source hash of 0 is allowed with a warning through `hashField(..., { warnIfZero: true })`; use it only for unverified references. Conditional sources need English text at `Movement.Sources.<Hash>.Condition`; missing text is a warning. Wraithwalk remains on the verified inventory-item Heartshadow Catalyst hash (3072857252), which links to sandbox perk 3936394000; no perk RefType is needed. MIDA's extra forward bonus, Wraithwalk's grounded bonus, and The Scientific Method's grounded bonus remain neutral placeholders. Other unmeasured frames/perks and unspecified Exotic Power Weapon penalties are not guessed.

`movementSpeed({ classHash, activity, sources, direction, posture, sprint?, ads?, heldWeaponSources?, adsMultiplierOverride? }, movement?)` uses repository movement data by default; pass a validated `MovementSource` as the optional second argument to calculate an edited preview. `activity` is `PVE` or `PVP`. Direction (`Forward` or `Strafe`) and posture (`Standing` or `Crouched`) are independent, so crouched strafing is represented directly. `sprint: true` requires `Forward` and `Standing`. It returns `{ tier, speed, cappedBy? }` with unrounded m/s, and `cappedBy` names the limiting rule.

Callers resolve held weapons, category membership, and activation conditions before passing active non-ADS bonuses. For ADS, `heldWeaponSources` identifies source hashes belonging to the one held weapon being inspected. These hashes must also be present in `sources`. Only that subset's ADS effects replace the global multiplier; omitted or empty selection uses the global value, even when `sources` contains ADS overrides for all three loadout weapons. Call the calculator once per weapon with its own subset; source order never selects the weapon. Conflicting values within the selected subset are rejected instead of merged. An explicit `adsMultiplierOverride` takes priority when a caller has already resolved a value. For example, a sidearm uses `ads: true, heldWeaponSources: [14]` with source 14 in the supplied sources, while another weapon uses its own source hashes or an empty array for default ADS.

`AlsoMatches` lists additional inventory-item or plug hashes that activate the same source. `Hash` remains its primary identity. The calculator accepts either the primary hash or an alias, including in `heldWeaponSources`, and rejects activating the same source through multiple hashes. Validation rejects repeated or ambiguous primary hashes and aliases. `AlsoMatches` and `BoostRequiresAll` use `itemRef: 'item'` for item-picker controls. Lightweight aliases cover all Lightweight Frame plugs and movement-granting grenade-launcher Micro-Missile frames, not rocket-sidearm or pulse-rifle frames with the same name.

Do not apply Lightweight Frame and MIDA Synergy to the same held weapon, or both variants of MIDA Synergy together. Legacy MIDA Synergy is an alias of the ordinary SMG source. Macro-Tool has a separate conditional source: when held with MIDA Multi-Tool equipped, it grants a 1.1 forward multiplier without Lightweight Mobility tiers or a separate `SprintMultiplier`. `boosted: true` asserts that all required equipment is present; it does not add the prerequisite item's own effects. `stacks` defaults to 1 and saturates at the last recorded value. Duplicate source hashes, unknown hashes, invalid stack counts, incompatible sprint direction/posture, and simultaneous ADS/sprint are rejected.

The calculator adds Mobility tiers, clamps them, evaluates walk speed, multiplies applicable effects, and finally applies the lowest relevant cap. `ForwardMultiplier` applies to forward walking while standing or crouched and to sprint, but never to strafing. On sprint, it stacks multiplicatively with applicable `SprintMultiplier` and `GroundedMultiplier` effects; all sprint multipliers apply before the forward cap. `GroundedMultiplier` affects every supported grounded state, including sprint, and never jump height. ADS stacks with both direction and posture multipliers. All movement uses the forward cap (9 m/s); strafing also uses the strafe cap (6 m/s), and either crouched direction also uses the crouch cap (4 m/s). Sprint ignores Mobility and the walking base, strafe, crouch, and ADS multipliers.

Keep core calculation results exact. Editor speed previews use `formatMovementSpeed` from `src/editor/components/previewData.ts` for fixed two-decimal display (6.39625 becomes **6.40**, 3.825 becomes **3.83**). The formatter handles floating-point noise without changing the core result. The step-1 editor remains a generic read-only JSON fallback; the formatter is ready for step-2 movement previews.

## Adding an entity or collection

Entity TypeScript interfaces and their `EntitySpec`s live together in [`src/core/entities/index.ts`](../src/core/entities/index.ts). For a new or changed entity property, add the matching interface property and builder call in `EntitySpec.fields`. Use the builders there, add a new spec to `entityRegistry`, and add the collection to a stat's `collections` map (or [`src/core/movement/index.ts`](../src/core/movement/index.ts) for movement). For example, a stat's map can include `collections: { CooldownItems: cooldownItemSpec }`. Add the corresponding optional collection property and type import to `StatSource` or `MovementSource` in [`src/core/sources.ts`](../src/core/sources.ts), then add matching records to the source JSON. Use `uniqueKey` for an entity's non-default identity key and `anyOf` for alternative required-field groups where appropriate.

For behavior that depends on an entity's meaning, use registry metadata rather than branching on collection names. Map the Ability, SuperAbility, Override, and MovementClass entity specs respectively to `role: 'ability'`, `role: 'superAbility'`, `role: 'override'`, and `role: 'movementClass'`. Set `StatSpec.abilityKind` to `grenade`, `melee`, `class`, or `super` for a stat with that ability category (for example, `abilityKind: 'grenade'`); consumers such as manifest filtering should derive the category from this metadata. These hints belong to the registries and do not change source JSON or the public export data shape.

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

Add `sources/stats/<stat>.json` with matching `Hash`, `Name`, `Fields`, and any registered collections. Add the stat's required English strings in [`locale/en.json`](../locale/en.json): `Overview`, `BaseStatTooltip`, and `EnhancedStatTooltip`, plus `ChargeBasedScalingTooltip` when a registered collection has `role: 'ability'`. Locale IDs are generated from the stat name and key. In `ChargeBasedScaling`, entry `i` is the charge-rate scalar while `i` charges are stored, and the array length is the ability's maximum charges. The `AbilityName`, `ChargeCount`, and `ChargeBasedScaling` tooltip tokens are supplied by the consumer per ability, not stat properties; see the [CBSD example](CBSD_example.md). The registry drives the editor's stat navigation; no editor-specific wiring is needed.

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

Numeric limits encode structure and mathematical meaning, not guessed game-balance ranges. Keep finite numbers, integer hashes/HP/counts, uint32 manifest ranges, curve domains, parallel-array lengths, and nonnegative magnitudes. Cooldowns, recharge-rate multipliers and movement multipliers remain positive. Energy scalars can be zero and have no upper bound. Base Mobility tiers have no upper bound; the calculator clamps effective tiers to the configured curve cap. Mobility tier effects may be negative penalties.

In the editor, **Publish** dispatches `build-data.yml` on the selected branch. The
workflow tests and validates, builds the versioned JSON and `update.json`, and
commits generated data as `github-actions[bot]`. Builds on any branch can update
that branch's generated data; only a dispatch on `master` also deploys Pages.
Before tests and the build, the workflow fast-forwards to the latest branch head.
If the branch advances after that and the generated-data push is rejected, the
workflow fails safely rather than rebasing stale generated output. A maintainer
should retry the workflow; the new build recomputes the patch version and
changelog against the latest published data.

For v2 and later, `update.json.schemaVersion` is the full `X.Y.Z` version, while
the export directory is `versions/<major>/` (for example, all `2.x.x` exports
are under `versions/2/`). Legacy v1 metadata remains `X.Y`, including when a
patch release was published, and historical v1 directory names are
inconsistent. Consumers should derive the major directory only for v2+ and
continue using the exact legacy paths for v1.

Partner apps do not currently consume locale strings, but future breaking schema releases should version locale files (keep the previous-version keys or use a versioned locale folder) so consumers pinned to an older `schemaVersion` continue to work. For end-user editor instructions, use [`docs/EDITOR.md`](EDITOR.md); for the editor's development architecture and limitations, see [`src/editor/README.md`](../src/editor/README.md).

## One-time GitHub setup

1. In repository **Settings > Pages**, set **Source** to **GitHub Actions**.
2. Create a fine-grained personal access token scoped only to `Database-Clarity/Character-Stats`, with **Contents: Read and write**, **Pull requests: Read and write**, **Actions: Read and write**, and **Metadata: Read-only**. Keep the token private; the editor stores it in session storage by default and supports opt-in local storage.

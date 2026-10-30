# Web editor

Run `npm run dev`, open the URL Vite prints, and choose **Use local dev data**. The
local source reads repository JSON through Vite raw imports; it never writes to
these files. Local edits can be reviewed/discarded, but Save and Publish are disabled.
The local button and data imports are excluded from production builds. No Vite
middleware or configuration changes are needed.

## Structure and flow

- `App` mounts the manifest provider and one `EditorProvider`. The compact shell
  provides stat navigation, validation, quick jump (Ctrl/Command+K), semantic change counts,
  previous/next change (Alt+Up/Down), Save, Publish, and account disconnect.
  Validation issues offer **Go to**: `issueTarget` in `state/editing.ts` maps core issue paths
  to a stat/tab/item/field target, and navigation falls back to the closest rendered
  ancestor `data-field` when the path points inside a control.
  `issueLocationLabel` and `fieldLabel` in `state/locationLabels.ts` turn those paths into
  readable registry labels (`Grenade › Abilities › Flux Grenade › Name`) for the issue list
  and the Changes dock.
  `RepositoryMenu` (the ☰ account menu at the right of the top bar, with Recovery and Sign out) and `ValidationPanel` (the issues
  list) are separate components. `App`'s keyboard/wheel listeners register once and read the latest
  state through a ref.
  Clicked editor selections are recorded in browser history; Back/Forward restores
  the stat, tab, group, or item selection without changing working values. Wheel
  selection bursts are committed after five seconds of inactivity.
- `data/` loads original file text and the Git branch head; `github/client.ts` is
  the REST boundary. A load racing a branch update is rejected.
- `state/store.tsx` holds originals, working values, legacy unparsed drafts, and
  **isolated item drafts** keyed by file/collection. Item drafts survive navigation
  and saves but never enter source serialization, validation, or pending changes
  until explicitly added. Discarding a source clears its corresponding drafts.
  Core validation and serialization remain authoritative.
- `state/paths.ts` holds the source path constants (`MOVEMENT_FILE`, `LOCALE_FILE`, `STATS_DIR`)
  and `statFilePath`, which finds a stat's file; use them instead of path literals.
- `state/editing.ts` contains tested pure helpers: identity-based change targets,
  cyclic change navigation (including shared locale consumers), spec-based draft defaults, atomic requirement /
  `lengthOf` parallel-array row edits and table reverts. Collection order alone is not a field change.
- `StatView` renders registered fields and collection tabs without per-stat form
  wiring. `FieldInput` handles all field kinds; numeric arrays have individual
  controls, not JSON textareas. `EntityForm` groups fields from their spec.
  Enums use described selects, objects use collapsible nested forms, and object
  arrays use reorderable/removable spec-driven rows. Nested field paths flow into
  modified markers, validation and Go-to targets. Structural array changes revert
  at the parent; same-length row edits are tracked by slot and field. Unpublished
  fields retain their controls and show a source-only badge.
- `EntityList` owns the three-pane collection layout, pinned draft row, sorted
  source/deleted rows, and per-item actions. Hash edits keep the selected item and
  focus stable across identity changes. `ItemMenu` is a keyboard-operable menu
  portaled outside scrolling panes, so it cannot be clipped by list boundaries; its row
  triggers stay faintly visible until hover, focus or selection.
  On widths of 701-1279px, Context opens beside the editor and the list steps aside while an
  item is selected (with no selection the empty editor steps aside instead); below that it is an
  overlay `min(400px, 100%)` wide. At 600px
  and below the list and the editor take turns in one column: selecting an item or group
  shows its editor, and **← List** (or browser Back) returns to the list. Draft **Discard**
  confirms only when the draft differs from its initial value; item **Revert changes** confirms when more than
  one field changed or the item is unsaved. Quick jump and phone selection focus the item
  heading; **+** focuses the new draft's first field.
- `RequirementEditor` handles reference arrays with subclass/parallel-column
  semantics; `ReferenceArrayInput` handles ordinary `intArray` + `itemRef` fields.
  Reference chips, grouped pickers, and enabled parallel columns use `lengthOf`, not field
  name switches. Reverting Requirements restores the whole requirement/parallel-array
  table atomically. `ChargeBasedScaling` and Movement arrays use `indexLabel` hints.
- `CurveEditor` uses core expansion/validation; converting Values to Segments
  preserves every expanded value exactly and verifies equality before applying.
  `convertCurve` reuses the previous or saved curve, with its rounding, when it expands to the
  same values, so switching back without edits leaves no change.
  `CurvePlot` is a small SVG plot with x/y crosshair and saved overlay. Segment
  controls and raw-domain values are structured inputs. Enhanced-only curves use
  the 100-200 domain, so the editor can set the base/zero-enhancement value at
  stat 100 while retaining the existing 101-200 values. Optional **View JSON** is read-only.
- `TextEditor` uses core locale rendering/placeholder validation and previews
  the base ability without applying overrides. Its preview controls are outside the
  scrolling content; the context slider follows the same structure. `ContextPanel`
  asks core for each single-override result and filters on `appliedOverrides`;
  subclass filters remain explicitly unresolved.
- `EditorPrimitives` provides persisted collapsibles, changed-field framing,
  numeric sliders, and IntersectionObserver-based outlines with Collapse/Expand
  all. Go-to navigation expands target ancestors, focuses and highlights fields.
- `ManifestUI` uses only the public `manifest/` contract for status, identity
  lookup, icons, subclasses, and search. One search shows role-matched Suggested
  results followed by Other matches; disabled/unavailable manifest states explain
  why and allow creation of a blank draft. `ClassIcon` supplies accurate local
  class glyphs when a class definition has no icon URL. `QuickJump`
  searches registered stats/tabs and source item names/hashes. The UI still works without a manifest.
- Movement shows Rules plus Classes/Sources collections. The Rules tab lists the
  `Rules` object's fields directly with an outline, using the same `FieldsPage` as stat
  Fields tabs. `MovementContext`
  validates working data before calling core `movementSpeed` and keeps Mobility,
  Sprint, Walk, Strafe, Crouch and ADS results visible together. Class and activity
  are global settings; every row shows its signed delta against the same settings
  with no active optional sources. Caps and calculation errors remain visible.
  Active sources retain their stack, boosted and per-held-weapon ADS controls;
  selecting a WhileHeld source replaces the previous one, and unchecking it clears
  that selection without removing Always or Conditional sources. The summary and
  source selector stay together in one panel; below 1280px that panel is a toggled
  panel opened with **Speed preview**, like Context on other stats.
  Invalid data and conflicting ADS choices show errors, not fallback speeds.
  Source RefType scopes lookups/icons/hash pickers to items or item categories;
  collection manifest drafts infer RefType from the picked definition table.
  Movement Sources place AlsoMatches immediately after Hash and RefType.
- `PendingChanges` groups semantic changes by stat/tab/item/field and shows
  structured array/curve changes by index or segment with old &rarr; new values and
  keyboard-accessible expanded old/new details. It keeps stable per-file line diffs
  and confirmed file/all discard.
- `SaveDialog` serializes with core `serializeSource`; English JSON retains insertion
  order, four spaces, and trailing LF. A save uses one commit and an unforced ref
  update or a new branch + PR. If the branch head moves but `sources/**` and
  `locale/en.json` are unchanged, the stored head fast-forwards; otherwise the user
  can reload while keeping pending edits for a rebase attempt, or cancel. A PR failure
  after commit is reported separately, and the editor switches to the saved branch.
- Local recovery uses IndexedDB with independent scopes for each GitHub owner/repository/branch
  and for Local (read-only dev); it never stores GitHub credentials. Each edit queues an
  asynchronous latest-state write, while the rolling history is debounced by 750 ms,
  capped at 30 snapshots, and retained for 7 days; pruning removes only snapshots beyond the
  newest 30 or older than 7 days. Startup offers restore, discard, or **Continue without
  restoring**, which marks the stored snapshot IDs as kept (`kept` in `useRecovery`): they are
  exempt from the 30-snapshot cap (`appendSnapshot`) and survive the post-save cleanup
  (`keptAfterSave`), expiring only by age; discard asks for confirmation here and in the
  Recovery dialog and stays enabled for unreadable data. The Recovery dialog (☰ repository menu) and React
  error-boundary fallback show timestamped snapshots with change counts and restore/export
  JSON/discard actions. Recovery data preserves the
  snapshot's original base head; a successful Save clears the session's autosaves for both the
  original and resulting branch scopes. If startup storage fails, **Continue without restoring** disables
  local recovery for the session; an alert and notice warn that recovery will not persist. Other IndexedDB errors, including quota failures, are surfaced, and the existing
  beforeunload warning remains. Signing out leaves local recovery intact and directs the user
  to Recovery (☰ menu) to discard it. An edit can still be lost if a crash occurs before its
  asynchronous transaction completes; snapshots are recovery, not backup or undo/redo history.
- `PublishDialog` dispatches `build-data.yml` on the saved branch and shows recent
  runs. It states that `master` builds data and deploys Pages, while other branches
  build data only. Version selection is automatic; there is no manual schema-version
  input. Raising major/minor publishes `X.Y.0` even with identical consumer JSON as
  a feature alert; only identical pretty/minified outputs at the same major/minor
  are a no-op. Local dev mode cannot save or publish.

## Editor polish and assets

- Plots measure their container with `ResizeObserver` and render in CSS-pixel SVG
  coordinates, preserving tick text proportions. The hover label follows pointer
  coordinates independently of the nearest-value crosshair. `curveValueRange.ts`
  widens the value axis to round 1/2/2.5/5 × 10ⁿ ticks and labels the stat domain
  with integer ticks, so gridlines never show unrounded values.
- `FieldHelp` (in `EditorPrimitives`) is the field info button: a real button with a
  popover that opens on click, tap or keyboard, previews on mouse hover, and closes on
  Escape or an outside click. It shows the spec's editor-only `help`, falling back to
  `description`, and is safe inside `<summary>` headings.
- `textFormat.ts` holds count pluralization (`1 error`, `2 files`) and the display
  name for collection keys (`SuperAbilities` shows as **Super abilities**; Quick jump
  still matches the raw key).
- `HashInput` is the digits-only text input for `hash` fields (no stepping, at most 10 digits); `NumberInput` sets
  `inputMode` (decimal by default, numeric for integers). `draftValidation.ts` is a context that
  hides a new draft's field errors until the field blurs or Add is attempted (`ItemEditorPane` owns
  the state). `curveChanges.ts` marks segment/value inputs that differ from saved with
  `data-changed`, which `StatView` prefers over the first input only for change navigation (a request
  carrying a change `id`: Alt+Up/Down, Changes dock **Go to**), not validation or Quick jump.
  `groupRowsByBaseCooldown` accepts a cooldown snapshot so `EntityRows` keeps rows in their group
  while a text field in the editor has focus (`nextCooldownSnapshot`); any other value change, such as
  a revert or restore, regroups immediately. `ManifestPicker` takes
  `existing` hashes (listed last, disabled); `pickedEntry` fills an empty Name on a hash pick.
- `numberStep.ts` is the tested numeric-step helper: integer fields step by one,
  fields constrained to 0–1 by hundredths, and other values by their decimal
  precision (including scientific notation). Numeric arrays and curve values use it.
  `NumberInput` stepper buttons are outside the Tab order; ArrowUp/ArrowDown step the input.
- `manifest/prismatic.ts` detects prismatic ability plugs from manifest type names
  ending in `| Light Ability` / `| Darkness Ability`, never source name suffixes.
  Every manifest icon surface gets the same small corner marker.
- Any `intArray` with `itemRef` uses removable identity chips and a manifest picker.
  Resolved hash chips show the manifest name followed by the hash in muted monospace text.
  Plain reference arrays have no wildcard or negative-subclass semantics; requirement
  tables retain those spec-declared semantics and their atomic parallel columns.
- The outline grows to fit its labels up to `min(30vw, 480px)` and wraps beyond that.
  It can collapse; below 1100px it automatically becomes a closed floating
  disclosure. Labels wrap at word boundaries rather than truncating.
- First manifest load blocks editing with a modal showing the current loading step
  and indexing progress. Errors (including missing API-key configuration) offer an
  explicit **Continue without manifest** action. Later refreshes stay nonblocking.
  The top-bar manifest badge refreshes on click; Sign out and Recovery are in the ☰
  repository menu at the right of the top bar. Destructive confirmations reuse `Modal`,
  not browser confirm/alert: `Modal` returns focus to its opener when it is still on the
  page, and `ConfirmDialog` opens with Cancel focused.
- A stat without `CooldownScalars` still previews its fixed base cooldown through
  core and has no cooldown-stat slider. Other stat-dependent text previews retain
  their stat controls.
- **Save** writes source edits (`sources/`, `locale/en.json`) in one branch commit,
  or creates a PR. On `master`, it redeploys the site and sends English text to
  Crowdin, but does not change the data apps download. **Publish** regenerates
  `versions/<major>/` and `update.json` from committed source data; on `master`, it
  also redeploys the site. Tooltips and the dialogs distinguish these operations.

Class glyphs (`assets/class-titan.svg`, `assets/class-hunter.svg`,
`assets/class-warlock.svg`) are unmodified SVGs from
[justrealmilk/destiny-icons](https://github.com/justrealmilk/destiny-icons/tree/394ed051455e938f72ddd600d42cf87600ec7172/general),
revision `394ed051455e938f72ddd600d42cf87600ec7172`, under
[CC0 1.0 Universal](https://github.com/justrealmilk/destiny-icons/blob/394ed051455e938f72ddd600d42cf87600ec7172/LICENSE).
CSS inverts their black fill for the dark UI. The owner-provided
`assets/mobility.png` is the Movement navigation glyph.

## Specs and styles

This movement editor step adds no core helpers or behavior. Earlier editor
domain-core additions are optional presentation hints on `FieldSpec`:
`itemRef`, `refSubclassFilters`, and `indexLabel`. Requirements, charge scaling,
and Movement speed arrays opt into them in `core/entities/index.ts`. Existing
validation/export APIs are unchanged. Schema generation deliberately selects its
own keys, so hints do not leak into `schema.json` (verified byte-for-byte).

Plain CSS is split into base/shell, forms, collections, overlays, and a small
responsive entry stylesheet. It uses neutral graphite surfaces, 13px base text, 4px spacing units,
24-28px controls, hairline borders, 3px corners, and Clarity green/cyan accents.
The compact phone shell is `(max-width: 800px), (max-height: 500px)` in `styles.css` and
`compactShellQuery` in `App.tsx`; keep the two in sync. Touch sizing lives in one
`@media (pointer: coarse)` block at the end of `styles.css`.
There are no UI libraries, decorative shadows, or page-level card stacks. The
logo in `assets/` is also the favicon. Focus rings, explicit labels, native
collapsible summaries, dialogs, and keyboard menus are retained.

Vite's `envDir` points to the repository root. Put `VITE_BUNGIE_API_KEY` in the
ignored root `.env.local` for live manifest names/icons in development. No key is
required to edit local source data. See [the guide](../../docs/EDITOR.md) for the
complete interaction walkthrough.

## Authentication and limitations

Use a repository-scoped fine-grained PAT with Contents R/W, Pull requests R/W,
Actions R/W and Metadata R. Session storage is the default; Remember me opts into
local storage. Tokens are sent only to `api.github.com`. Disconnect clears both
credential stores, but leaves local recovery snapshots intact; use **Recovery** in the ☰
repository menu to discard those snapshots. Browser storage is not encrypted: use a trusted device.

Edits and unadded item drafts remain in memory while editing and are also recorded
by local recovery; closing/reloading still warns for dirty files or unadded item
drafts. Recovery writes are asynchronous and do not guarantee that the last edit
survives a crash before its IndexedDB transaction completes. There is no merge UI,
undo/redo stack, or non-English editing. Concurrent source changes during editing
offer reload with pending edits as a rebase attempt, or cancel. A workflow run may
not be listed immediately after dispatch; use Refresh runs or the Actions link.
Subclass-filter overrides remain unresolved as reported by core. Tooltip charge
preview uses the first stored charge scaling entry; cooldown preview uses the
selected ability and current overrides.

Validation: `npm run format`, `npm run typecheck`, `npm test`, `npm run build`,
`npm run validate`. Run `npm run schema` and check `git diff -- schema.json` when
changing spec hints. Pure regression tests live in `state/editing.test.ts`,
`state/store.test.ts`, and `github/client.test.ts`; manifest tests are colocated
with its module. Redesign captures live in `docs/editor-screenshots/`.

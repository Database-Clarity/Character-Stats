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
- `data/` loads original file text and the Git branch head; `github/client.ts` is
  the REST boundary. A load racing a branch update is rejected.
- `state/store.tsx` holds originals, working values, legacy unparsed drafts, and
  **isolated item drafts** keyed by file/collection. Item drafts survive navigation
  and saves but never enter source serialization, validation, or pending changes
  until explicitly added. Discarding a source clears its corresponding drafts.
  Core validation and serialization remain authoritative.
- `state/editing.ts` contains tested pure helpers: identity-based change targets,
  cyclic change navigation (including shared locale consumers), spec-based draft defaults, atomic requirement /
  `lengthOf` parallel-array row edits and table reverts. Collection order alone is not a field change.
- `StatView` renders registered fields and collection tabs without per-stat form
  wiring. `FieldInput` handles all field kinds; numeric arrays have individual
  controls, not JSON textareas. `EntityForm` groups fields from their spec.
- `EntityList` owns the three-pane collection layout, pinned draft row, sorted
  source/deleted rows, and per-item actions. Hash edits keep the selected item and
  focus stable across identity changes. `ItemMenu` is a keyboard-operable menu
  portaled outside scrolling panes, so it cannot be clipped by list boundaries.
  On widths below 1280px, Context becomes an explicitly toggled side overlay.
- `RequirementEditor` recognizes `intArray` + `itemRef` spec hints. Reference
  chips, grouped pickers, and enabled parallel columns use `lengthOf`, not field
  name switches. Reverting Requirements restores the whole requirement/parallel-array
  table atomically. `ChargeBasedScaling` and Movement arrays use `indexLabel` hints.
- `CurveEditor` uses core expansion/validation; converting Values to Segments
  preserves every expanded value exactly and verifies equality before applying.
  `CurvePlot` is a small SVG plot with x/y crosshair and saved overlay. Segment
  controls and raw-domain values are structured inputs. Optional **View JSON** is read-only.
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
  why and allow creation of a blank draft. `ClassIcon` supplies distinct local
  geometric class symbols when a class definition has no icon URL. `QuickJump`
  searches registered stats/tabs and source item names/hashes. The UI still works without a manifest.
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
- `PublishDialog` dispatches `build-data.yml` on the saved branch and shows recent
  runs. It states that `master` builds data and deploys Pages, while other branches
  build data only; the first v2 release requires schema version `2.0`. Local dev mode
  cannot save or publish.

## Specs and styles

The only domain-core additions are optional presentation hints on `FieldSpec`:
`itemRef`, `refSubclassFilters`, and `indexLabel`. Requirements, charge scaling,
and Movement speed arrays opt into them in `core/entities/index.ts`. Existing
validation/export APIs are unchanged. Schema generation deliberately selects its
own keys, so hints do not leak into `schema.json` (verified byte-for-byte).

Plain CSS is split into base/shell, forms, collections, overlays, and a small
responsive entry stylesheet. It uses neutral graphite surfaces, 13px base text, 4px spacing units,
24-28px controls, hairline borders, 3px corners, and Clarity green/cyan accents.
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
stores. Browser storage is not encrypted: use a trusted device.

Edits and unadded item drafts live only in memory. Navigation within the app retains them; closing/reloading
warns for dirty files or unadded item drafts. There is no merge UI, autosave, offline persistence, undo stack or
non-English editing. Concurrent source changes during editing offer reload with
pending edits as a rebase attempt, or cancel. A workflow run may not be listed immediately after dispatch;
use Refresh runs or the Actions link. Subclass-filter overrides remain unresolved
as reported by core. Tooltip charge preview uses the first stored charge scaling
entry; cooldown preview uses the selected ability and current overrides.

Validation: `npm run format`, `npm run typecheck`, `npm test`, `npm run build`,
`npm run validate`. Run `npm run schema` and check `git diff -- schema.json` when
changing spec hints. Pure regression tests live in `state/editing.test.ts`,
`state/store.test.ts`, and `github/client.test.ts`; manifest tests are colocated
with its module. Redesign captures live in `docs/editor-screenshots/`.

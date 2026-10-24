# Web editor

Run `npm run dev`, open the URL Vite prints, and choose **Use local dev data**. The
local source reads repository JSON through Vite raw imports; it never writes to
these files. Local edits can be reviewed/discarded, but Save and Publish are disabled.
The local button and data imports are excluded from production builds. No Vite
middleware or configuration changes are needed.

## Structure and flow

- `App` connects a data source and mounts one `EditorProvider` (reducer + context).
- `data/` loads original file text and the Git branch head; `github/client.ts` is a
  small REST wrapper. A load that races a branch update is rejected.
- `state/store.tsx` holds originals, working JSON and unparsed input drafts. Core
  `validateSources` and `validatePlaceholders` produce issues. Dirty files are
  detected by comparing stable serializations, not object identity.
- `StatView` uses the public stat and movement registries. `FieldInput` switches on
  field kind; collection forms use the collection's `EntitySpec`. Adding registered
  fields, entities or stats needs no editor wiring.
- `CurveEditor` delegates evaluation/validation to core; `CurvePlot` lazily loads
  Recharts. Raw-to-segment conversion creates an equivalent point at each integer
  stat value, with the registry's/default rounding. All three segment types can be
  edited; coverage errors come from core.
- `TextEditor` edits only `locale/en.json`, checks placeholders and previews text
  with core locale rendering. `ContextPanel` delegates cooldown comparisons to core.
- `PendingChanges` shows simple per-file line diffs and provides file/all discard.
- `SaveDialog` serializes source files with core `serializeSource`. English JSON
  keeps insertion order and uses four spaces plus a trailing newline. Every save
  creates blobs, one tree and **one commit**, followed by an unforced ref update
  (direct) or a new branch + PR. A stale head blocks saving. A PR failure after a
  successful commit is reported separately; the editor switches to the saved branch.
- `PublishDialog` dispatches `build-data.yml` on the current saved branch with the
  optional `schema_version`, then offers recent branch runs and an Actions link.

## Authentication and limitations

Use a repository-scoped fine-grained PAT with Contents R/W, Pull requests R/W,
Actions R/W and Metadata R. Session storage is the default; Remember me opts into
local storage. Tokens are sent only to `api.github.com`. Disconnect clears both
stores. Browser storage is not encrypted: use a trusted device.

Edits live only in memory. Navigation within the app retains them; closing/reloading
warns when dirty. There is no merge UI, autosave, offline persistence, undo stack or
non-English editing. Concurrent GitHub changes require reconnecting (review/copy
pending changes first). A workflow run may not be listed immediately after dispatch;
use Refresh runs or the Actions link. Subclass-filter overrides remain unresolved
as reported by core. Tooltip charge preview uses the first stored charge scaling
entry; cooldown preview uses the selected ability and current overrides.

Validation: `npm run typecheck`, `npm run build`, `npm test`. Editor REST and reducer
regressions are colocated in `github/client.test.ts` and `state/store.test.ts`.

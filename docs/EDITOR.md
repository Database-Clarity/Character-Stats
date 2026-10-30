# Web editor guide

Open the editor at [database-clarity.github.io/Character-Stats/editor](https://database-clarity.github.io/Character-Stats/editor/).

## Connect

On **Connect to your repository**, enter the **Fine-grained GitHub personal access token**; **Branch** is a dropdown listing the repository's branches after a token is entered (default `master` when available). The repository is fixed to `Database-Clarity/Character-Stats`. The token needs Contents read/write, Pull requests read/write, Actions read/write, and Metadata read permissions. Select **Remember on this device** only on a trusted device (its help text notes that the token is kept in localStorage); otherwise the token stays in session storage. Select **Connect to GitHub** to load the source JSON and English locale for that branch.

For development only, **Use local dev data** opens the checked-out repository's JSON without a token. It is shown as **Local dev** in the ☰ repository menu: edits exist only in memory, and Save and Publish are disabled. This option is not included in production builds.

## Navigate and edit

The editor is a compact full-height workbench. The left sidebar lists **Health**,
**Melee**, **Grenade**, **Super**, **Class**, **Weapons**, and **Movement**, with stat
icons and change counts. It is one Tab stop; Up, Down, Home and End move between stats (Left and Right too in the phone strip). Tabs and list rows also indicate changes. Each pane scrolls
independently; the page itself stays in place. Below 1280px, **Context** in the
item header opens the cooldown panel beside the editor and hides the item list while an item is
selected (with nothing selected the list stays). At 700px and below it opens as an overlay up to
400px wide (full width on phones); its close button closes it.
Movement uses the same panel for its speed preview; open it with **Speed preview**.
On phones (600px and below) a collection shows either its list or the selected item;
use **← List** or browser Back to return to the list. Phones and landscape phones swap the
sidebar for a stat strip and drop the page title row. Their toolbar keeps Changes, Save and
the manifest badge; **Jump...**, **Publish** and the previous and next change arrows live
in the **☰** repository menu.

Expand the validation bar to list every error and warning. Each issue names its location
with readable labels, for example *Grenade › Abilities › Flux Grenade › Name*; hover it for the
raw source path. **Go to** opens the stat, tab and item that holds the value, focuses the
closest field and collapses the list. The list shows about three issues and scrolls. Curve
coverage problems are merged into ranges (*Uncovered x 51-70*, *Overlapping x 69-70*), one issue
per gap or overlap. Previous/next change (**Alt+Up / Alt+Down**) and **Go to** in the Changes dock on a curve focus the
segment or value input that differs from the saved curve.

Use **Jump...** or **Ctrl+K** (Command+K on macOS) to search stats, tabs, item names, or hashes.
Press **/** outside an input to focus the current collection filter (or open Jump).
Keyboard hints (shortcut list, **Ctrl K**, plot hover text) are hidden on touch screens,
which also hide the number steppers and enlarge buttons and inputs to 32px.
Use arrow keys in tab lists, quick-jump results, and item action menus; **Esc** closes
menus and dialogs. The item list is one Tab stop: Up and Down move between rows and, in grouped lists, cooldown
group headers and **Edit group** buttons; Home and End jump to the first and last; Enter or Space
selects a row, toggles a group header or presses **Edit group**. A row's three-dot menu is not a Tab
stop (it is still clickable); open it with **Shift+F10**, the Menu key or Right Arrow, and close
it with Esc or Left Arrow, which returns focus to the row. Rows of collapsed groups are skipped by the arrow keys.
Dialogs return focus to their opener when it is still on the page;
confirmation dialogs open with **Cancel** focused. Quick jump lands focus on the item heading
(or the selected tab for a stat or tab jump), selecting an item on a phone focuses its heading,
and **+** focuses the new draft's first field. Number stepper buttons are not Tab stops; use
ArrowUp and ArrowDown in the input. Every input has a label and keyboard focus ring. Field labels are readable names; the source key appears beside each one in dimmed monospace text. Fields are required unless tagged *optional*. Select or tap a field's **ⓘ** button for guidance on what to enter; Escape or a click elsewhere closes it.
Hold **Ctrl+Alt** and scroll anywhere in the editor to navigate the character stats:
wheel up selects the previous section and wheel down selects the next, stopping at
either end. The whole stats sidebar highlights while the exact modifiers are held;
number keys do not activate stats. With **Alt** and **Shift** held together, wheel
navigates the current collection's visible, filtered items without wrapping; an
unmodified wheel continues to scroll normally. Clicked stat, tab, cooldown-group,
and item selections participate in browser **Back** and **Forward**. Wheel
navigation records its final selection after five seconds without another
successful navigation step; Back returns to the selection before that scroll burst.
Changing selections this way preserves unsaved edits and drafts.

### Manifest names and icons

The manifest badge in the top bar reports loading, ready, disabled, or error status. When
ready it shows a green dot and **Manifest**; click it to refresh (hover for the loaded
version). On error it reads **Manifest: retry**; hover for the full error. The initial load
blocks editing with a modal showing
the current step and indexing progress; it closes when the manifest is ready.
If loading fails (including **No API key** configuration), the **Manifest unavailable** modal
explains the error and offers **Continue without manifest**. Later refreshes do not block editing.
Names, icons, item types, stat icons, and class icons
come from Bungie's manifest. Source names remain editable: if one differs from its
manifest name, the item header offers **Use manifest name**. Hash inputs show their
resolved identity or an **Unknown hash** warning. Hash inputs are digits-only text boxes:
they have no steppers and ignore arrow keys and the wheel, so an item is never retargeted by
accident. **Pick item** also fills an empty **Name** from the manifest. Hash identity chips show the
resolved name followed by the hash in muted monospace text. Without a manifest,
source names and hashes remain usable; numeric manual entry is always available. Class
definitions without icon URLs use accurate CC0 Destiny class glyphs (source and
licence recorded in the editor README). Prismatic ability icons have a small
multicolour corner marker, detected from manifest ability types, not source names.
Movement uses the provided Mobility glyph. **Sign out** and **Recovery** are in the ☰
repository menu at the right of the top bar; unsaved edits or drafts require an in-app
confirmation before leaving.

### Fields and curves

Forms are generated from the shared core specs. Labels sit beside inputs; hover
the information symbol for the field description. Modified fields have a cyan
edge, dot, and **Revert** (curved arrow) button whose tooltip shows the saved value.

Fields and Text have an **On this page** outline. Select a section to jump to it;
the outline tracks scrolling and can be collapsed. Up to 1365px it starts
collapsed as a slim **On this page** bar above the fields when it has six or fewer entries;
below 1100px it always starts collapsed, and wider screens keep it open. Your own open or close
choice survives crossing 1365px and moving between pages (it is remembered for the session, per
page type), but crossing 1100px resets it. The bar's entries drop down when
opened; collapsed, it is always that bar. Long names are ellipsized
with their full text available on hover. Sections, segments, locale entries, and change
groups collapse using their summary row. **Collapse all / Expand all** helps with
long pages. Collapse preferences are remembered in localStorage, independently of
unsaved data; edits themselves are not persisted.

Curves use a compact plot with an x/y hover crosshair and optional **Compare with
saved** overlay. **Segments** edits Constant, Linear, and Expression segments.
Bounds, values, and rounding use numeric inputs; Linear points use individual x/y
inputs. Add, reorder, collapse, and remove segments with their inline controls.
**Values** edits each integer-domain value numerically. Converting Values to
Segments preserves every evaluated value exactly; the conversion is checked
against the expanded array before it is applied. The **Segments** and **Values** buttons change
the stored format; switching back without edits restores the original curve, including its
rounding, because the previous or saved curve is reused when it expands to the same values.
**View JSON** is read-only
debugging output, not a required editing surface. Core validation checks coverage,
expressions, and numeric constraints. Tick labels retain their natural proportions
at every plot width; the x/y value label follows the pointer, independently of the
nearest-value crosshair. Other number inputs open a numeric (integer) or decimal keyboard on phones. Number controls step by one for integers and by 0.01 for
decimal values, including fields constrained to 0–1; manually entered decimal
precision remains unrestricted. Hold **Shift** and wheel over a numeric input to
step its hovered value by the configured step, respecting bounds and preserving
the value's typed precision. The ordinary wheel remains scrolling without **Shift**.

Enum fields use compact selects with sentence-case option names (for example
*While held*); hover an option for its stored value and description. Object fields
expand into inline spec-driven groups. Object arrays use compact rows with **Add row**
and ↑ / ↓ / × controls.
Nested fields have their own validation, modified marker, and revert button.
Changes **Go to** expands the containing groups and focuses the nested field.
Adding/removing rows is a parent-array change; reordering rows is meaningful.
An inline **unpublished** tag beside the field name means the field is kept in sources but not exported.

### Collections and drafts

Wide screens show **item list | editor | context**. Filter lists by source name,
manifest name, or hash. Select an item to edit it. Editing its **Hash** keeps the
item selected and focused; selection follows the item through identity changes.
Right-click a row or use its three-dot menu (faintly visible, fully opaque on hover, focus or selection); the editor
header has the same menu. **Duplicate** opens an isolated draft; **Delete** marks
saved items as deleted with a strikethrough and a **Restore item** action.
**Revert changes** restores one item (or removes an added item); it asks first when more than
one field changed or the item is unsaved. No global
Duplicate/Delete toolbar is used.

Ability entries can be grouped by identical **BaseCooldown** values within each
collection; entries from different collections are not grouped together. **Edit group** is a
compact button right-aligned under each group header when the group has more than one active entry.
After all editable fields, **Members** shows a responsive grid of compact
icon/name/hash cards. Hover or focus a card for its custom tooltip: identity and
manifest details plus every schema-backed current entry value, including values
that differ within the group and optional values. A normal click also shows the
tooltip; **Shift-click** or **double-click** a member card or context icon to open
that member's individual editor in the current page. Clicking a member card, or pressing Enter or Space on it, pins its details as a small dialog whose
**Open** button is reachable by keyboard (Esc closes it and returns focus to the card); the
**Open** button also works with the mouse while hovering (32px on touch screens). A single touch
tap opens the member directly. **Ctrl-click** does not
trigger current-page navigation; browser modifier behavior is preserved.
Overrides remain a separate editing surface. A group editor can
batch-edit any field that has the same value across every group member. Group
edits preserve each entry's **Hash**. Existing validation, individual editing,
drafts, change review, and export workflows continue to apply.

The list-header **+** creates a draft pinned above the sorted list. It is marked
**DRAFT** and is **not a pending change**. Duplicates also start with empty identity
fields while retaining the copied numeric values and other properties. Drafts survive navigation within the
workspace. A new draft shows no field errors until a field is left or **Add to list** is tried;
the *n validation errors* count beside the button is always visible. **Add to list** with errors
reveals them all and focuses the first. It is disabled while the identity hash is a duplicate.
Adding sorts and selects the item; **Discard** asks first only when the draft differs from the
value it started with, then drops the draft. Override drafts start with no Requirements. There is one draft per collection; finish/discard it before adding from
the manifest. Closing the page warns for drafts as well as unsaved edits.

The **Add from manifest** (diamond-plus icon) button opens a searchable
icon/name/type picker. One search shows **Suggested** results that match the
collection's semantic role first (for example, grenade abilities in Grenade),
then **Other matches** from the rest of the manifest. Items already in the collection are not
suggested: they are listed last under **Already added**, marked and disabled. Both groups are keyboard
navigable; there is no separate search-all checkbox. Overrides have no restrictive
role filter. The picker distinguishes loading, unavailable, and no matches; when
the manifest is disabled or in error, choose **Create blank draft** to enter an
item manually. Choosing a result prefills the draft's Hash and Name; other required
properties still use the spec defaults and validation.

### Requirements and numeric arrays

Override requirements are named/icon references. **0** means **All abilities
(wildcard)**; negative hashes display **Subclass: name** (a repeated name gets a muted suffix on every row that shares it: the class when each has a distinct one, otherwise the hash). **Add requirement** searches
three groups: abilities in this stat, subclass filters, and the wildcard. A manual
hash input works even when the manifest is unavailable. The dialog stays open so you can add
several references (added rows are marked and disabled); close it with **Done** or Esc. On touch screens the search box is not focused when the dialog opens, so the on-screen keyboard stays closed until you tap it. ArrowDown
in the search box moves into the results, and empty groups are hidden while searching. Row ↑ / ↓ / ×
controls reorder/remove references.

Every field whose spec declares `lengthOf` for that reference array is a numeric
column in the same table. Its checkbox enables/disables the optional field.
Adding, removing, or reordering requirements changes every enabled parallel array
atomically. **Revert requirements table** restores Requirements and all of its
`lengthOf` parallel arrays together; columns cannot be reverted independently.
Plain numeric arrays use individual inputs, with Add/Remove controls and meaningful
zero-based labels (for example **Charges stored: 0**).
Every other integer array with an `itemRef` hint (including **BoostRequiresAll**
and **AlsoMatches**) uses removable identity chips and a manifest picker. These
chips show the resolved name followed by the hash in muted monospace text. Plain
hash references do not treat zero as a wildcard or negative values as subclasses.
Manual hashes remain available without a manifest.

### Cooldown context

The stat slider (labelled with the stat, for example *Grenade value*) and adjacent numeric
input remain pinned above the scrolling
context content. An ability selection shows only that ability's base cooldown
and one before-to-after / delta row for each applicable override. An override
selection still shows the abilities it affects, each with its icon (hover or click for
details) and source name; long names wrap. For a cooldown group,
**Applicable overrides** shows each override's individual effect and affected
members, grouping members with identical results; it does not repeat that data
in a separate aggregate cooldown table. The group view omits the otherwise-empty
**Affected abilities** disclosure. Matching **CooldownOverride** replacements
are applied first (the last matching replacement wins), then matching
**Scalar** entries multiply the result, and the cooldown curve applies last.
The curve stat is truncated and clamped to 0–100; final cooldowns are rounded
to three decimals. Individual ability and override views retain their existing
behavior and labels.

Scaled results are always labeled **Cooldown at &lt;value&gt; &lt;Stat name&gt;**, including at the
default 100.
Stats without cooldown scaling, including Super, show **Base cooldown** and
their fixed cooldown without a cooldown-stat slider.
Negative subclass filters are explicitly **unresolved: subclass filter**, never
silently applied. Large tables scroll below their sticky header.

### Movement

Movement has **Rules**, **Classes**, **Sources**, and **Text** tabs. Rules edits
the shared curves, multipliers, and caps. JumpHeight remains tagged **unpublished** until
measured data is available. Classes and Sources use the normal list, isolated
draft, editor, and context layout. Source **RefType** chooses items or item
categories for hash resolution and the field picker. **AlsoMatches** appears
immediately after **Hash** and **RefType** in the source form. **Add from manifest**
offers an Items / Item categories selector and sets RefType to match the result.
Source Effects are spec-driven rows. **Values** and optional **BoostedValues**
are small numeric inputs labelled by stack count starting at 1; core checks their
lengths and effect-type uniqueness.

The speed preview uses the current validated Movement data and core
`movementSpeed`. Pick a class, PvE/PvP, direction, posture, Sprint, and ADS.
Sprint selects forward/standing and turns ADS off; choosing ADS turns Sprint off.
Activate sources explicitly (rows are labelled Always, While held or Conditional), set stack counts, and use **Boosted** to assert all
of that source's prerequisite equipment is present. Conditions and loadout
compatibility are not inferred: select only applicable sources, not both
Lightweight Frame and MIDA Synergy for the same weapon.

For ADS effects, **Held ADS** marks active sources belonging to the one held
weapon being inspected, not all three loadout weapons. No selection uses the
global ADS multiplier. Conflicting selected ADS overrides show an error instead
of silently choosing one. The pinned controls/results show effective tier and speed
to two decimal places. The **Δ vs no sources** heading gives each speed's signed change against the
same class and activity with no active optional sources. A stat row shows **Capped: Forward** (or
Strafe or Crouch) only when a cap actually limits that speed.
Invalid source data blocks the preview until fixed; calculator errors are shown
instead of a stale result. Active-source controls scroll independently below it.

### English text

**Text** edits English locale strings only. The stat slider (*Grenade value*), numeric
input, and ability selector remain pinned, except at 600px and below, where they scroll with the fields. Section titles and the outline use readable
names (*Base stat tooltip*) with the locale ID beside them in dimmed monospace text. Each collapsible locale row has its textarea and
live preview side by side at desktop widths. The preview uses the selected ability's
base data only and does not apply overrides. Placeholder validation and rendering
use core; unknown/unavailable placeholders remain visible in the preview. Text
values associated with a specific entry can also be edited from that entry's own
tab. Where an associated entry's name can be resolved, the Text tab shows the name
while keeping its identifier or fallback visible. Unassociated entries retain
their current presentation. Textareas expand automatically to fit their content.

## Review and save

Select **Changes (N)** to open the review dock, grouped by stat > tab > item >
field. Each row shows the field's label with its key in dimmed monospace text, and a
compact structured diff; arrays identify changed indices and curves changed segment properties
(*Segment 1 · To 70 → 69*) with old &rarr; new values. Switching a curve between Segments and
Values shows one line (*Converted Segments → Values (101 values)*). Expand a change for the full old and new
values in a keyboard-accessible disclosure. **Go to** navigates, expands the target
section, scrolls to it, and briefly highlights it. Top-bar previous / next buttons
and **Alt+Up / Alt+Down** cycle through changes. Counts represent semantic changes,
not just files; an added/deleted item counts once. Shared locale strings count
once, appear under their first registered consumer in Changes, and badge every
affected stat/tab. Per-file line diffs remain available in collapsed **File diff**
sections. **Discard file** and **Discard all** ask for confirmation. Leaving/reloading
warns when edits or unadded drafts remain.

Select **Save** to open **Save changes**. Validation errors block saving; warnings
do not. Enter a **Commit message** and choose **Save method**:

- **Direct commit to current branch** commits the changed files to the branch selected at connection.
- **New branch + pull request** asks for a **New branch name**, **Pull request title**, and optional **Pull request body**, then opens a PR against the selected branch.

The editor writes all changed files in **one commit**. Before saving, it checks
whether the branch head moved. If `sources/**` and `locale/en.json` are unchanged
between the loaded and current heads, it fast-forwards its stored head and continues.
If tracked source files changed, **Branch changed** offers **Reload** (which keeps
pending edits as a rebase attempt) or **Cancel**. After a successful save, the editor
follows the saved branch. If the commit succeeds but PR creation fails, the changes
remain saved on the new branch and the dialog explains that a PR must be opened
manually.

**Save** writes source edits (`sources/`, `locale/en.json`) to the branch or opens
a PR. On `master`, this redeploys the site and sends English text to Crowdin,
but **does not change the data apps download**. Hover Save for this distinction.

## Local recovery

The editor stores local recovery snapshots in IndexedDB, separately from GitHub
credentials. GitHub snapshots are scoped by owner, repository, and branch;
**Local (read-only dev)** has its own scope and does not share snapshots with a
GitHub branch. Each edit queues an asynchronous write of the latest working
state; the rolling snapshot history is debounced by 750 ms, keeps up to 30
snapshots, and retains them for up to 7 days; pruning removes only snapshots beyond the newest
30 or older than 7 days. This is local recovery, not an
undo/redo history.

When stored work is found at startup, a centered card lists the timestamped snapshots, each
with **Restore snapshot** or **Export JSON**. **Continue without restoring** (the default)
keeps those snapshots under **Recovery** in the ☰ repository menu: new autosaves are added
alongside them without pushing them out of the 30-snapshot limit, and a later Save clears only
the new session's autosaves. They expire after 7 days unless you restore or discard them.
**Discard stored recovery data** asks for confirmation; it is disabled only when there is
nothing stored (unreadable data can always be discarded). The **Recovery** dialog from the ☰ menu offers the
same list and discard action, and each entry shows its change count and, for GitHub snapshots, `from` the first seven characters of the branch head. If the editor hits a React error boundary, its recovery screen likewise
offers snapshots to restore or export, or lets you discard recovery data and
reload the editor. Corrupt or incompatible recovery data is reported explicitly
and can be discarded.

Restoring preserves the snapshot's original branch head. Save still performs
the normal branch-head reconciliation; if tracked source files have changed,
**Reload** keeps the restored edits for a rebase attempt, or you can cancel.
After a successful Save, this session's recovery data for both the original scope and the
resulting branch scope is cleared (snapshots you continued past at startup are kept). Signing out does not erase local recovery;
use **Recovery** in the ☰ repository menu to discard stored snapshots when you want them removed.

If startup cannot read IndexedDB, the card shows the error; **Continue without restoring**
turns local recovery off for the session, and an alert and notice explain that recovery will
not persist. Other storage or quota failures are also surfaced as recovery errors.
The existing leave/reload warning for unsaved edits and drafts remains in place.
Writes are asynchronous, so an edit can be lost if the browser or process crashes
before its IndexedDB transaction completes; recovery is not a backup guarantee.

## Publish

Choose **Publish** only after the source changes are committed to the selected
branch. The **Publish data** dialog shows the branch and warns if there are unsaved
edits; unsaved edits must be saved before dispatch. Schema versions are selected
automatically from the code-defined major/minor baseline and changes to the
published consumer data; there is no manual schema-version input. Raising the
major/minor baseline publishes `X.Y.0` even when JSON is unchanged, to alert
consumers to newly supported schema/API features. At the same major/minor, identical
pretty and minified exports are a no-op; a notes-only CLI build on that unchanged
baseline is also a no-op. Select
**Dispatch build workflow**. After dispatch, use **Refresh runs** or **Open Actions
workflow runs** to find the run; it may take a few seconds to appear.

The dialog states the outcome explicitly: on `master`, **Build data and deploy
Pages**; on any other branch, **Build data on `<branch>` &mdash; does not deploy Pages**.
Publishing is unavailable when connected with **Local (read-only dev)** data.
**Publish** regenerates the data apps download (`versions/<major>/` and
`update.json`) from the source edits already committed to that branch. On `master`,
it also redeploys the site. Hover Publish for this distinction; saving source edits
alone does not regenerate these published JSON files. For v2+, `schemaVersion` is
full `X.Y.Z` and all versions with the same major share a directory (for example,
`versions/2/`). Legacy v1 uses its historical `X.Y` schema version and paths.
Maintainer versioning and the command-line build options are covered in the
[development guide](DEVELOPMENT.md).

If the branch advances during a build and the generated-data push is rejected,
the workflow fails without rebasing stale output. Ask a maintainer to retry the
workflow so it can recompute the version and changelog against the latest
published data.

## Development and limitations

Run `npm run dev -- --port 5199 --strictPort`. Vite reads `.env.local` at the
repository root; set `VITE_BUNGIE_API_KEY` there for live manifest access (never
commit it). Manifest data is cached locally by its module; source edits and drafts
are held in memory and also recorded by local recovery as described above; this
does not commit source files. There is no merge UI, undo/redo stack, or
non-English editing. Subclass applicability is not inferred. If a concurrent
branch update changes tracked source files, use the offered **Reload** path to
keep pending edits for a rebase attempt, or cancel and resolve the change
separately. Save/Publish remain disabled for local dev data; browser verification
does not make GitHub writes or dispatch workflows.

Viewport captures from the redesign walkthrough are in [editor-screenshots](editor-screenshots/).

Movement captures: [Rules, 1440px](editor-screenshots/16-wide-movement-rules.png),
[Sources, 1440px](editor-screenshots/17-wide-movement-sources.png),
[Sources, 1000px](editor-screenshots/18-narrow-movement-sources.png), and
[Context overlay, 1000px](editor-screenshots/19-narrow-movement-context.png).

Captures use 1440x900 and 1000x900 CSS viewports. The integrated browser may
scale raster output to its display surface; the original captures are retained.

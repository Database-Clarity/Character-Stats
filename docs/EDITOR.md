# Web editor guide

Open the editor at [database-clarity.github.io/Character-Stats/editor](https://database-clarity.github.io/Character-Stats/editor/).

## Connect

On **Connect to your repository**, enter the **Fine-grained GitHub personal access token** and **Branch** (default `master`). The repository is fixed to `Database-Clarity/Character-Stats`. The token needs Contents read/write, Pull requests read/write, Actions read/write, and Metadata read permissions. Select **Remember me on this device (localStorage)** only on a trusted device; otherwise the token stays in session storage. Select **Connect to GitHub** to load the source JSON and English locale for that branch.

For development only, **Use local dev data** opens the checked-out repository's JSON without a token. It is labeled **Local (read-only dev)**: edits exist only in memory, and Save and Publish are disabled. This option is not included in production builds.

## Navigate and edit

The editor is a compact full-height workbench. The left sidebar lists **Health**,
**Melee**, **Grenade**, **Super**, **Class**, **Weapons**, and **Movement**, with stat
icons and change counts. Tabs and list rows also indicate changes. Each pane scrolls
independently; the page itself stays in place. At narrower widths, **Context** in the
item header opens the cooldown panel over the right side; its close button closes it.
Movement uses the same Context overlay for its speed preview.

Use **Jump...** or **Ctrl+K** (Command+K on macOS) to search stats, tabs, item names, or hashes.
Press **/** outside an input to focus the current collection filter (or open Jump).
Use arrow keys in tab lists, quick-jump results, and item action menus; **Esc** closes
menus and dialogs. Every input has a label and keyboard focus ring.

### Manifest names and icons

The refresh indicator in the repository/branch account area reports loading, ready,
disabled, or error status. The initial load blocks editing with a modal showing
the current step and indexing progress; it closes when the manifest is ready.
If loading fails (including **No API key** configuration), the modal explains the
error and offers **Continue without manifest**. Later refreshes do not block editing.
Names, icons, item types, stat icons, and class icons
come from Bungie's manifest. Source names remain editable: if one differs from its
manifest name, the item header offers **Use manifest name**. Hash inputs show their
resolved identity or an **Unknown hash** warning. Without a manifest, source names
and hashes remain usable; numeric manual entry is always available. Class
definitions without icon URLs use accurate CC0 Destiny class glyphs (source and
licence recorded in the editor README). Prismatic ability icons have a small
multicolour corner marker, detected from manifest ability types, not source names.
Movement uses the provided Mobility glyph. **Sign out** is beside the repository
and branch; unsaved edits or drafts require an in-app confirmation before leaving.

### Fields and curves

Forms are generated from the shared core specs. Labels sit beside inputs; hover
the information symbol for the field description. Modified fields have a cyan
edge, dot, and **Revert** (curved arrow) button whose tooltip shows the saved value.

Fields and Text have an **On this page** outline. Select a section to jump to it;
the outline tracks scrolling and can be collapsed. Below 1100px it automatically
collapses into a floating **On this page** toggle/popover. Long names are ellipsized
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
against the expanded array before it is applied. **View JSON** is read-only
debugging output, not a required editing surface. Core validation checks coverage,
expressions, and numeric constraints. Tick labels retain their natural proportions
at every plot width; the x/y value label follows the pointer, independently of the
nearest-value crosshair. Number controls step by one for integers, by 0.01 for
fields constrained to 0–1, or by the current decimal precision otherwise
(for example, 0.875 → 0.001 and 91 → 1).

Enum fields use compact selects; hover the selected value or an option for its
description. Object fields expand into inline spec-driven groups. Object arrays
use compact rows with **Add row**, **Up**, **Down**, and **Remove** controls.
Nested fields have their own validation, modified marker, and revert button.
Changes **Go to** expands the containing groups and focuses the nested field.
Adding/removing rows is a parent-array change; reordering rows is meaningful.
An **Unpublished** badge means the field is kept in sources but not exported.

### Collections and drafts

Wide screens show **item list | editor | context**. Filter lists by source name,
manifest name, or hash. Select an item to edit it. Editing its **Hash** keeps the
item selected and focused; selection follows the item through identity changes.
Right-click a row or use its three-dot menu (revealed on hover/focus); the editor
header has the same menu. **Duplicate** opens an isolated draft; **Delete** marks
saved items as deleted with a strikethrough and a **Restore item** action.
**Revert changes** restores one item (or removes an added item). No global
Duplicate/Delete toolbar is used.

The list-header **+** creates a draft pinned above the sorted list. It is marked
**DRAFT** and is **not a pending change**. Duplicates also start with empty identity
fields while retaining the copied numeric values and other properties. Drafts survive navigation within the
workspace. **Add to list** is disabled until core entity validation succeeds and
the identity hash is unique. Adding sorts and selects the item; **Discard** drops
the draft. There is one draft per collection; finish/discard it before adding from
the manifest. Closing the page warns for drafts as well as unsaved edits.

The **Add from manifest** (diamond-plus icon) button opens a searchable
icon/name/type picker. One search shows **Suggested** results that match the
collection's semantic role first (for example, grenade abilities in Grenade),
then **Other matches** from the rest of the manifest. Both groups are keyboard
navigable; there is no separate search-all checkbox. Overrides have no restrictive
role filter. The picker distinguishes loading, unavailable, and no matches; when
the manifest is disabled or in error, choose **Create blank draft** to enter an
item manually. Choosing a result prefills the draft's Hash and Name; other required
properties still use the spec defaults and validation.

### Requirements and numeric arrays

Override requirements are named/icon references. **0** means **All abilities
(wildcard)**; negative hashes display **Subclass: name**. **Add requirement** searches
three groups: abilities in this stat, subclass filters, and the wildcard. A manual
hash input works even when the manifest is unavailable. Row Up / Down / Remove
controls reorder/remove references.

Every field whose spec declares `lengthOf` for that reference array is a numeric
column in the same table. Its checkbox enables/disables the optional field.
Adding, removing, or reordering requirements changes every enabled parallel array
atomically. **Revert requirements table** restores Requirements and all of its
`lengthOf` parallel arrays together; columns cannot be reverted independently.
Plain numeric arrays use individual inputs, with Add/Remove controls and meaningful
zero-based labels (for example **Charges stored: 0**).
Every other integer array with an `itemRef` hint (including **BoostRequiresAll**
and **AlsoMatches**) uses removable icon/name chips and a manifest picker. These
plain hash references do not treat zero as a wildcard or negative values as
subclasses. Manual hashes remain available without a manifest.

### Cooldown context

The stat slider and adjacent numeric input remain pinned above the scrolling
context content. An ability selection shows only that ability's base cooldown
and one before to after / delta row for each applicable override. An override
selection shows only the abilities it affects. There is no "all overrides"
comparison. Calculations use the shared core; the stat value clamps at 100.
Scaled results are labeled **Cooldown at &lt;value&gt; &lt;Stat name&gt;**.
Stats without cooldown scaling, including Super, show **Base cooldown** and
their fixed cooldown without a cooldown-stat slider.
Negative subclass filters are explicitly **unresolved: subclass filter**, never
silently applied. Large tables scroll below their sticky header.

### Movement

Movement has **Rules**, **Classes**, **Sources**, and **Text** tabs. Rules edits
the shared curves, multipliers, and caps. JumpHeight remains **Unpublished** until
measured data is available. Classes and Sources use the normal list, isolated
draft, editor, and context layout. Source **RefType** chooses items or item
categories for hash resolution and the field picker; **Add from manifest**
offers an Items / Item categories selector and sets RefType to match the result.
Source Effects are spec-driven rows. **Values** and optional **BoostedValues**
are small numeric inputs labelled by stack count starting at 1; core checks their
lengths and effect-type uniqueness.

The speed preview uses the current validated Movement data and core
`movementSpeed`. Pick a class, PvE/PvP, direction, posture, Sprint, and ADS.
Sprint selects forward/standing and turns ADS off; choosing ADS turns Sprint off.
Activate sources explicitly, set stack counts, and use **Boosted** to assert all
of that source's prerequisite equipment is present. Conditions and loadout
compatibility are not inferred: select only applicable sources, not both
Lightweight Frame and MIDA Synergy for the same weapon.

For ADS effects, **Held ADS** marks active sources belonging to the one held
weapon being inspected, not all three loadout weapons. No selection uses the
global ADS multiplier. Conflicting selected ADS overrides show an error instead
of silently choosing one. The pinned controls/results show effective tier, speed
to two decimal places, and the cap that actually limited speed (or **none**).
Invalid source data blocks the preview until fixed; calculator errors are shown
instead of a stale result. Active-source controls scroll independently below it.

### English text

**Text** edits English locale strings only. The stat slider, numeric input, and
ability selector remain pinned. Each collapsible locale row has its textarea and
live preview side by side at desktop widths. The preview uses the selected ability's
base data only and does not apply overrides. Placeholder validation and rendering
use core; unknown/unavailable placeholders remain visible in the preview.

## Review and save

Select **Changes (N)** to open the review dock, grouped by stat > tab > item >
field. Each row shows a compact structured diff; arrays and curves identify changed
indices/segments with old &rarr; new values. Expand a change for the full old and new
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

## Publish

Choose **Publish** only after the source changes are committed to the selected
branch. The **Publish data** dialog shows the branch and warns if there are unsaved
edits; unsaved edits must be saved before dispatch. **New schema version (optional)**
should be left empty to rebuild the current version only after `update.json` is
already `2.0` or later, or set to `X.Y` for a breaking release. The first v2 publish
must explicitly set `2.0`. Select **Dispatch build workflow**. After dispatch, use
**Refresh runs** or **Open Actions workflow runs** to find the run; it may take a few
seconds to appear.

The dialog states the outcome explicitly: on `master`, **Build data and deploy
Pages**; on any other branch, **Build data on `<branch>` &mdash; does not deploy Pages**.
Publishing is unavailable when connected with **Local (read-only dev)** data.
**Publish** regenerates the data apps download (`versions/<v>/` and `update.json`)
from the source edits already committed to that branch. On `master`, it also
redeploys the site. Hover Publish for this distinction; saving source edits alone
does not regenerate these published JSON files.

## Development and limitations

Run `npm run dev -- --port 5199 --strictPort`. Vite reads `.env.local` at the
repository root; set `VITE_BUNGIE_API_KEY` there for live manifest access (never
commit it). Manifest data is cached locally by its module; source edits and drafts
live only in memory. There is no autosave, merge UI, offline source persistence,
undo stack, or non-English editing. Subclass applicability is not inferred.
If a concurrent branch update changes tracked source files, use the offered
**Reload** path to keep pending edits for a rebase attempt, or cancel and resolve
the change separately. Save/Publish remain disabled for local dev data; browser
verification does not make GitHub writes or dispatch workflows.

Viewport captures from the redesign walkthrough are in [editor-screenshots](editor-screenshots/).

Movement captures: [Rules, 1440px](editor-screenshots/16-wide-movement-rules.png),
[Sources, 1440px](editor-screenshots/17-wide-movement-sources.png),
[Sources, 1000px](editor-screenshots/18-narrow-movement-sources.png), and
[Context overlay, 1000px](editor-screenshots/19-narrow-movement-context.png).

Captures use 1440x900 and 1000x900 CSS viewports. The integrated browser may
scale raster output to its display surface; the original captures are retained.

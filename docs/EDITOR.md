# Web editor guide

Open the editor at [database-clarity.github.io/Character-Stats/editor](https://database-clarity.github.io/Character-Stats/editor/).

## Connect

On **Connect to your repository**, enter the **Fine-grained GitHub personal access token**, **Repository owner**, **Repository name**, and **Branch** (the defaults are `Database-Clarity`, `Character-Stats`, and `master`). The token needs Contents read/write, Pull requests read/write, Actions read/write, and Metadata read permissions. Select **Remember me on this device (localStorage)** only on a trusted device; otherwise the token stays in session storage. Select **Connect to GitHub** to load the source JSON and English locale for that branch.

For development only, **Use local dev data** opens the checked-out repository's JSON without a token. It is labeled **Local (read-only dev)**: edits exist only in memory, and Save and Publish are disabled. This option is not included in production builds.

## Navigate and edit

The workspace sidebar is headed **Stats** and lists **Health**, **Melee**, **Grenade**, **Super**, **Class**, **Weapons**, and **Movement**. The top bar shows **Pending changes (N)**, **Save**, **Publish**, and **Disconnect**. A validation summary reports error and warning counts; expand it for issue details.

Each section has a **Fields** tab, any registered collection tabs (currently **Abilities**, **SuperAbilities**, **Overrides**, and **Classes** under Movement), and a **Text** tab. Required non-curve fields show an asterisk; field descriptions and validation messages appear with the inputs. Non-curve arrays use a JSON-array text area.

### Curves

Curve fields show their integer domain and provide **Segments** and **Raw values** modes, plus **Compare with saved**. Raw mode edits the curve JSON. Segment mode plots the working copy and lets you edit the rounding digits, segment type (**Constant**, **Linear**, or **Expression**), bounds/values or linear `[x, y]` points. Use **Add segment**, **Move up**, **Move down**, and **Remove segment** to manage the list. The curve issues panel reports invalid coverage or values; segments must cover the field's domain exactly once.

### Abilities, overrides, and context

In **Abilities**, use **Search Abilities**, select a record, and use **Add Ability**, **Duplicate**, or **Delete**. In **SuperAbilities**, the corresponding labels are **Search SuperAbilities** and **Add SuperAbility**. In **Overrides**, use **Search Overrides** and **Add Override** to work with override requirements and scalar fields. Under Movement, **Classes** uses **Search Classes** and **Add MovementClass**. Delete asks for confirmation; it can be undone by discarding the source file.

Where cooldown curves and abilities are present, the **Cooldown context** panel shows a **Context stat value** slider and compares **No overrides (s)** with **All overrides (s)**, or the **Selected override (s)** while viewing an override. When an ability is selected, the panel also lists each applicable override. Stat values over 100 are clamped for cooldown calculations; subclass-filter requirements are shown as unresolved by the core.

### English text

Open **Text** to edit English locale strings; other translations are not edited here. Use **Preview stat value** and, where available, **Preview ability** to choose the live-preview context. Each text entry shows its locale ID, placeholder validation, and **Live preview**. Unknown or unavailable placeholders remain visible so they can be corrected.

## Review and save

Select **Pending changes (N)** to review per-file diffs. Use **Discard file** to revert one file or **Discard all** to revert all edits; both ask for confirmation. Dirty edits stay in memory while navigating, and leaving/reloading the page prompts if changes remain.

Select **Save** to open **Save changes**. Validation errors block saving; warnings do not. Enter a **Commit message** and choose **Save method**:

- **Direct commit to current branch** commits the changed files to the branch selected at connection.
- **New branch + pull request** asks for a **New branch name**, **Pull request title**, and optional **Pull request body**, then opens a PR against the selected branch.

The editor writes all changed files in **one commit**. After a successful save, the editor follows the saved branch. If the commit succeeds but PR creation fails, the changes remain saved on the new branch and the dialog explains that a PR must be opened manually.

## Publish

Choose **Publish** only after the source changes are committed to the selected branch. The **Publish data** dialog shows the branch and warns if there are unsaved edits; unsaved edits must be saved before dispatch. **New schema version (optional)** should be left empty for the current version or set to `X.Y` only for a breaking release. Select **Dispatch build workflow**. The very first v2 publish must set the version to `2.0`; the build refuses to write into the old `versions/1.x` folders. After dispatch, use **Refresh runs** or **Open Actions workflow runs** to find the run; it may take a few seconds to appear.

A dispatch on `master` builds and deploys Pages. A dispatch on another branch builds and commits version data on that branch but does not deploy the site. Publishing is unavailable when connected with **Local (read-only dev)** data.

# Destiny 2 Character Stats

[![Crowdin](https://badges.crowdin.net/clarity-d2-character-stats/localized.svg)](https://crowdin.com/project/clarity-d2-character-stats)

This repository contains an up-to-date (usually) collection of ability cooldowns as well as other benefits that character stats provide which can be easily parsed by 3rd party applications. This also includes support for Aspects and Exotics changing the base cooldowns of certain abilities among other things.

All the data stored here is intended for use by 3rd party apps willing to implement them in place of Bungie's own outdated and incomplete information on Character Stats. This includes cooldown times as well as every other kind of useful information that is available from community research.

Currently used and trusted by [Destiny Item Manager](https://dim.gg/) and [D2ArmorPicker](https://d2armorpicker.com/).

## Disclaimer

- Cooldown times might be ~1 second off in some instances due to how these numbers are calculated. There's really nothing that can be done about it due to the ungodly workload that would be required to maintain this database by manually checking cooldown times at each tier for each ability. (This does not apply to Base (T3) Cooldowns, inaccuracies with those are not acceptable)
- While cooldowns are displayed with rounding to 2 decimal places for improved accuracy when combining them with `Overrides`, I strongly recommend rounding to a whole number when displaying them.

## Report Issues/Inaccuracies

If you notice any inaccuracies in the dataset, feel free to [file an issue](https://github.com/Database-Clarity/Character-Stats/issues/new/choose) in the Issues tab and fill out the template.
Otherwise, feel free to contact me on Discord `@starglance` (Stardust) as well. You can also find me in the [DIM](https://discordapp.com/invite/UK2GWC7), [Clarity](https://url.d2clarity.com/discord), and [Destiny Science](https://discord.gg/TheyfeQ) Discord servers.

## Crediting and Usage Policy

Please check out our website's [Partnerships page](https://www.d2clarity.com/partnerships) for our guidelines.

## Recommended Access Paths

- JSON schema for the database with documentation: <https://github.com/Database-Clarity/Character-Stats/blob/master/schema.json>
- Main Database contents:
  - With Indentation (human-readable): `https://Database-Clarity.github.io/Character-Stats/versions/[schemaVersion]/CharacterStatInfo.json`
  - Without Indentation (smaller file size): `https://Database-Clarity.github.io/Character-Stats/versions/[schemaVersion]/CharacterStatInfo-NI.json`
- Versioning using the `update.json` file found here: `https://Database-Clarity.github.io/Character-Stats/update.json`

## Database Information

Vital information about the database structure and what each property stored in it represents can be found in the `shema.json` file [here](https://github.com/Database-Clarity/Character-Stats/blob/master/schema.json).

In addition to the main database files, the `update.json` contains the following two values:

- `lastUpdate` - integer: timestamp of the last update made to the database
- `schemaVersion` - string (matches `^\d+\.\d+$`): the current schema version used for this database

Example usage of the `update.json` file for handling breaking changes:

1. The app developer stores the `schemaVersion` property during implementation to use it for checks
2. When accessing the `update.json` file to check if there is new information available, the app detects that the current `schemaVersion` does not match the version stored in the app's code
    - Here, the app developer can choose to display an alert informing the user that the app might be displaying outdated information.
3. Until the developer updates their implementation to support the new schema, the app can still access the old version's files by using the coded-in `schemaVersion` as in the database URLs

## Credits

I want to thank Hugo for [their amazing spreadsheet](https://docs.google.com/spreadsheets/d/1LgOPdcdEmRvDxFq1ZgJkR9-U6KMsTvYTUSJgkqsLIqs/) which provided the fundamentals of this database and u/Crystic_Knight for their [breakdown of Mobility](https://www.reddit.com/r/DestinyTheGame/comments/ejw37c/breakdown_of_mobility_ultimate_edition/). Last, but most certainly not least, I want to thank RyTako for [his spreadsheet](https://docs.google.com/spreadsheets/d/1lEOY_Z0v5ZZVZJ1SVLJyleMBEG2a7KLq4aLIQA9zk0A/) and ongoing high quality testing to help out the entire science community.

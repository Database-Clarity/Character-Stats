# Destiny 2 Character Stats

This repository contains an up-to-date (usually) collection of ability cooldowns as well as other benefits that character stats provide which can be easily parsed by 3rd party applications. This also includes support for Aspects and Exotics changing the base cooldowns of certain abilities among other things.

All the data stored here is intended for use by 3rd party apps willing to implement them in place of Bungie's own outdated and incomplete information on Character Stats. This includes cooldown times as well as every other kind of useful information that is available from community research.

## Disclaimer

- Cooldown times might be ~1 second off in some instances due to how these numbers are calculated. There's really nothing that can be done about it due to the ungodly workload that would be required to maintain this database by manually checking cooldown times at each tier for each ability. (This does not apply to Base (T3) Cooldowns, inaccuracies with those are not acceptable)
- While cooldowns are displayed with rounding to 2 decimal places for improved accuracy when combining them with `Overrides`, I strongly recommend rounding to a whole number when displaying them.

## Report Issues/Inaccuracies

If you notice any inaccuracies in the dataset, feel free to [file an issue](https://github.com/Database-Clarity/Character-Stats/issues/new/choose) in the Issues tab and fill out the template.
Otherwise, feel free to contact me on Discord `@Stardust#9037` as well. You can also find me in the [DIM](https://discordapp.com/invite/UK2GWC7), [Clarity](https://d2clarity.page.link/discord), and [Massive Breakdowns](https://discord.gg/TheyfeQ) Discord servers.

## Crediting and Usage Policy

**Do NOT claim to be the creator/curator of this database or its contents. This includes purposefully showing the data in a way leads people to think you may be the maintainer of this data.**

That's really about it, I don't ask for anything else. As long as you don't break that rule, please feel free to use whatever info is stored here for your projects.

Though, I would certainly appreciate it if you linked back to this repository and to [Clarity's Ko-Fi page](https://ko-fi.com/d2clarity). But it's not required so it's entirely up to you.

## Recommended Access Paths

- Main Database contents:
  - With Indentation (human readable):
  <br> <https://Database-Clarity.github.io/Character-Stats/CharacterStatInfo.json>
  - Without Indentation (smaller file size): 
  <br> <https://Database-Clarity.github.io/Character-Stats/CharacterStatInfo-NI.json>
- JSON schema for the database with added documentation:
  <br> <https://github.com/Database-Clarity/Character-Stats/blob/master/schema.json>
- "Versioning" using the `update.json` file found here:
  <br> <https://Database-Clarity.github.io/Character-Stats/update.json>

## Database Information

Vital information about the database structure and what each property stored in it represents can be founds in the `shema.json` file [here](https://github.com/Database-Clarity/Character-Stats/blob/master/schema.json).

In addition to the main database the `update.json` contains the following:
- `lastUpdate` - integer: timestamp of the last update made to the database.
- `lastBreakingChange` - integer: timestamp of the last breaking change made to the database.
- `legacyRootDirectory` - string: root directory where the last version of the database can be found from before the last breaking change was introduced.

Example usage for handling breaking changes:
1. The `lastBreakingChange` property in the `update.json` file stores a newer timestamp compared to the locally cached `lastUpdate` value.
2. The `legacyRootDirectory` property stores the following URL:
  <br>`https://database-clarity.github.io/Character-Stats/legacy-content/v1.1`
3. You can access the files from the last version before the `lastBreakingChange` (v1.1) at:
  <br> `[legacyRootDirectory]/CharacterStatInfo.json` and
  <br> `[legacyRootDirectory]/CharacterStatInfo-NI.json`

## Credits

I want to thank Hugo for [their amazing spreadsheet](https://docs.google.com/spreadsheets/d/1LgOPdcdEmRvDxFq1ZgJkR9-U6KMsTvYTUSJgkqsLIqs/) which provided the fundamentals of this database and u/Crystic_Knight for their [breakdown of Mobility](https://www.reddit.com/r/DestinyTheGame/comments/ejw37c/breakdown_of_mobility_ultimate_edition/).

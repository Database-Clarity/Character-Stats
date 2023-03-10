# Destiny 2 Character Stats

This repository contains an up-to-date (usually) collection of ability cooldowns as well as other benefits that character stats provide which can be easily parsed by 3rd party applications. This also includes support for Aspects and Exotics changing the base cooldowns of certain abilities.

## Disclaimer

- This collection accounts for aspects overriding ability cooldown times but not for exotic armor pieces as they are a lot more volatile comparatively speaking. This repository was created to help alleviate the issues caused by Bungie's API not providing ability cooldown details despite them being in the in-game UI (for the most part).
- Cooldown times might be 1-2 seconds off in some instances due to how these numbers are calculated. There's really nothing that can be done about it due to the ungodly workload that would be required to maintain this database by manually checking cooldown times at each tier.

## Usage of the Provided Data

- You can easily access the provided data at the following URLs:
  - With Indentation: <https://Database-Clarity.github.io/Character-Stats/CharacterStatInfo.json>
  - Without Indentation: <https://Database-Clarity.github.io/Character-Stats/CharacterStatInfo-NI.json>
- You can find the JSON schema here with added documentation: <https://Database-Clarity.github.io/Character-Stats/schema.json>

## Report Issues/Inaccuracies

If you notice any inaccuracies in the dataset I'm using, feel free to [file an issue](https://github.com/Database-Clarity/Character-Stats/issues/new/choose) in the Issues tab and fill the template form out.
Otherwise, feel free to contact me on Discord `@Stardust#9037` as well. You can also find me in the [DIM](https://discordapp.com/invite/UK2GWC7), [Clarity](https://d2clarity.page.link/discord), and [Massive Breakdowns](https://discord.gg/TheyfeQ) Discord servers.

## Crediting Policy

I would appreciate it if you linked back to this repository if you decided to use this data in any apps you happen to be working on. But it's not required so basically do whatever you want with it.

## Database Information

Most of what I go over here is included in the `shema.json` file but here's a quick rundown on what's included in this database:

- All Character Stats
  - The array index always indicates the tier of the character stat. "Tier" means the largest multiple of 10 that is smaller than or equal to your displayed stat total.
  - The `Abilities` member of each `Character Stat` object contains an array of objects with the following members:
    - Hash - number: the hash represents the `inventoryItem` hash of an ability (or other overriding item like an aspect).
    - Name - string: the name of the ability. This is used for tracking purposes and doesn't necessarily match the name from the D2 manifest.
    - Cooldowns - number array: the cooldown of an ability at each tier of the character stat in seconds.
  - The `Overrides` member of each `Character Stat` object contains an array of objects with the following members:
    - Hash - number: the hash represents the `inventoryItem` hash of an ability (or other overriding item like an aspect).
    - Name - string: the name of the ability. This is used for tracking purposes and doesn't necessarily match the name from the D2 manifest.
    - Requirements - number array: the `inventoryItem` hash of each ability that is required to trigger the effects of this Scalar. Any one of these will trigger its effect as only one is required to do so. (These are usually also the same ability but for the different subclasses, hence you should not be able to have more than one equipped at once)
    - Cooldowns - number array: an override to the cooldown time of the abilities listed in the `Requirements`. Identical to the Cooldowns array of the `Ability` objects. Array will contain 11 0s if this is not in use.
    - Scalar - number array: a multiplier to the cooldown time of the abilities listed in the `Requirements` array at the same array index. Multiple scalars can stack with each other if their requirements are met (eg. Bastion Aspect and Citan's Ramparts Exotic Armor).
- Mobility
  - Walking/Strafe/Crouch Speed - number array: represents your movement speeds for each scenario in meters per second at each tier of Mobility.
- Resilience
  - TotalHP - number array: represents the total HP (70 health + shields) of your character at each tier of Resilience.
  - DamageResistance - number array: represents the % damage resistance you receive **in PVE** at each tier of Resilience.
  - FlinchResistance - number array: represents the % flinch resistance you receive at each tier of Resilience.
- Recovery
  - TimeToFullHP - number array: represents how long it would take to regenerate from 0 to full HP at each tier of Recovery in seconds.

In addition to the main database, I have also included an `update.json` file with the following:
- lastUpdate - integer: timestamp of the last update made to the database.
- lastBreakingChange - integer: timestamp of the last breaking change made to the database.
- legacyRootDirectory - string: root directory where the last version of the database can be found from before the last breaking change was introduced.
  - Example usage:
    - update.json contains the following for the `legacyRootDirectory`:
      <br>`https://database-clarity.github.io/Character-Stats/legacy-content/v1.1`
    - You can access the legacy files from version 1.1 through `[legacyRootDirectory]/CharacterStatInfo.json` and `[legacyRootDirectory]/CharacterStatInfo-NI.json`

## Credits

I want to thank Hugo for [their amazing spreadsheet](https://docs.google.com/spreadsheets/d/1LgOPdcdEmRvDxFq1ZgJkR9-U6KMsTvYTUSJgkqsLIqs/) which provided the fundamentals of this database and u/Crystic_Knight for their [breakdown of Mobility](https://www.reddit.com/r/DestinyTheGame/comments/ejw37c/breakdown_of_mobility_ultimate_edition/).

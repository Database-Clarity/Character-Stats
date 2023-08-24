# Changelogs

## v1.7.0 - Breaking Change (Ugh) - [insert timestamp]

### Schema/Database Structure Changes v1.7

- Added new `Description` property to the schema (literally just a string)
  - Contains a locale ID that can be used to get the localized description of the object it is under. These are designed to be used as a tooltip in apps.
- Added `Description` property to all Character Stat objects
- Previous number/int array-type properties of Character Stat objects (e.g. `FlinchResistance`) have now been converted into objects themselves
  - These contain the previously available array in their `Array` property and have a newly added `Description` property
- `WalkingSpeed` (now object) property of `Mobility` has been renamed to `WalkSpeed` for the sake of consistency
  - Decided I might as well finally make this change since this is a pretty large update anyway
- `DamageResistance` (now object property) of `Resilience` has been renamed to `PvEDamageResistance` for clarity
- `DRCondition` property of `SuperAbility` objects now uses the new `Description` property instead of a generic string

### New: Localization Support

- `Description` strings will now be localized through [Crowdin](https://crowdin.com/project/clarity-d2-character-stats) to every language currently supported in the D2 manifest (and will use the same language tags)
  - If your app has already established translators who are interested in helping with this effort, please direct them to our [Discord Server](https://url.d2clarity.com/discord).
  - These strings will not be updated nearly as often as our main perk info database and should remain fairly constant, so I don't expect this to be a significant workload.

### Other Changes v1.7

- *Icefall Mantle* now overrides *Rally Barricade* cooldowns to the cooldown of *Towering Barricade* (this one was SOOOO wrong)
- Updated *Hoarfrost-Z* override scalar to correctly override to the new *Towering Barricade* cooldowns
- Updated `README.md` to better reflect the current state of the database and provide a clearer example for breaking change handling

## v1.6.0 - Breaking Change (Sorry... again) - August 23, 2023

### Schema/Database Structure Changes v1.6

- Detailed explanations for the new structure and properties can be found in the `schema.json` file
- `Intellect` no longer uses the generic `Ability` objects and now has its own `SuperAbility` object
  - `SuperAbility` retains the `Hash`, `Name`, and `Cooldowns` properties
  - Added `PvPDamageResistance`, `PvEDamageResistance`, and `DRCondition` properties to `SuperAbility` objects
- `Recovery` had its `TimeToFullHP` property broken out into its sub-components but `TotalRegenTime` retains its previous functionality
  - Added `TotalRegenTime`, `HealthRegenDelay`, `HealthRegenSpeed`, `ShieldRegenDelay`, and `ShieldRegenSpeed` properties to the `Recovery` object
  - Displaying 'normal health' and 'shield health' separately might be helpful to help better explain these numbers, all the info you would need to do so is in the `schema.json` file

### Season 22 Updates + Charge-Based Scaling Follow-Up

- Removed *Renewal Grasp* Cooldown Override
- Increased *Towering Barricade* cooldown from 48 to 70 seconds
- Increased *Thundercrash* cooldown from 500 to 556 seconds
- Reduced *Skip Grenade* cooldown from 121 to 105 seconds
- Reduced *Void Wall* grenade cooldown from 152 to 121 seconds
- Added now known values for `ChargeBasedScaling` to *Arcane Needle* and *Frenzied Blade*

### Other Changes v1.6

- Added a mostly feature complete GUI for data editing
  - Self-respecting programmers should avoid looking at the code for fear of heart attacks
  - Ability to delete Abilities/Overrides/SuperAbilities still missing, will come with a future update

## v1.5.0 - Breaking Change

### Schema/Database Structure updates and improvements

- `CooldownOverride`, `Scalar`, and `FlatIncrease` properties of `Override` objects are no longer required to all be present
  - Now, only one of the 3 mentioned properties **has to** be present but more may still be present present on an `Override` object at once
- Fully migrated property explanations from `README.md` to `scema.json`
- Added data usage/display recommendations to properties in `schema.json`
- Added optional `ChargeBasedScaling` number array property to `Ability` objects
  - This represents how certain abilities charge faster/slower depending on the number of stored ability charges. (Currently present on 'Arcane Needle' and 'Frenzied Blade')
  - The length of the array also serves to store the number of charges an ability has intrinsically. (Naturally, in the case of the ability not having any ChargeBasedScaling, this will be an array of `1`s)
- Fixed up the generally just outdated/incorrect parts of the schema.

### Mischellaneous Changes

- Reworked `README.md` from being an info dump to only store relevant information to help people get started.
- Slightly changed the crediting policy to prohibit "abusing my generosity". Nothing changes for those with any form of basic decency.
- Improved example for handling breaking changes.

## v1.4.2 - May 8, 2023

- Added Renewal Grasps Cooldown Override
- Improved Cooldown Override Scalar accuracy of the Bleak Watcher Aspect

## v1.4.1 - March 29, 2023

- Added Exotic Armor sources of Cooldown Overrides
  - Currently includes: Icefall Mantle, Hoarfrost-Z, Citan's Ramparts

## v1.4.0 - March 29, 2023 - (Slightly) Breaking Change

- Cooldown times in `Override` and `Ability` members of Character Stats are now rounded to 2 decimal points for improved accuracy when additional scaling is applied on top (such as an Override)
  - Updated `schema.json` and `README.md`to reflect this change
  - I still strongly suggest rounding the final cooldown numbers when displaying them
- Added all missing sources of Cooldown Overrides that are based on subclass configuration

## v1.3.0 - March 15, 2023 - Breaking Change

- Renamed `Cooldowns` member of `Override` objects with `CooldownOverride`
- Added `FlatIncrease` member to `Override` objects
  - More info about this can be found in [schema.json](https://github.com/Database-Clarity/Character-Stats/blob/master/schema.json)

## v1.2.1 - March 12, 2023

- Updated Charge Rate scaling for Titan Class Abilities to better represent testing results
- Updated Scalars provided by the "Bastion - Void Aspect" override to better represent testing results

## v1.2.0 - March 9, 2023 - Breaking Change

- Replaced the `Scalar` `number` member of the `Override` objects with an array of `number`s that are specific to each member of the `Requirements` array's listed abilities
  - More info about this change can be found in [schema.json](https://github.com/Database-Clarity/Character-Stats/blob/master/schema.json)
  - This should allow for more freedom when dealing with separate scaling rules based on the ability equipped
- [update.json](https://github.com/Database-Clarity/Character-Stats/blob/master/update.json) now includes additional helpful information for handling breaking changes
  - Added new `lastBreakingChange` value that holds the timestamp of the last introduced breaking change
  - Added new `legacyRootDirectory` value that holds the root directory of where source files from before the last breaking change can be found
    - More info about this can be found in [README.md](https://github.com/Database-Clarity/Character-Stats/blob/master/README.md)
  - Note: I have no plans of making a habit out of breaking changes but just wanted to set up a more robust system for dealing with them if they are deemed necessary in the future

## v1.1.0 - March 9, 2023 - Hotfix

- Renamed the `Scalars` member of the Character Stat objects to `Override`
- Added a `Cooldowns` member to `Override` objects that will override the cooldowns of the items listed in the `Requirements` array before the `Scalar` is applied
  - This `Cooldowns` array is identical to the ones in `Ability` objects
  - Will contain 11 `0`s if not in use for an override

## v1.0.0 - March 9, 2023

- Updated base cooldown times and ability recharge rate scaling for [patch 7.0.0.1](https://www.bungie.net/7/en/News/article/update_7_0_0_1)
  - New charge rate scaling can be found in the source file: `/generator/Source Content.json`
    - Super regeneration scaling is untouched post-Lightfall
- Updated PvE damage resistance scaling for patch 7.0.0.1
- Sorting now ignores cooldown times and is entirely alphabetical
- Removed the `Override` property from abilities and introduced a new `Scalars` member of the Character Stat objects as a replacement
  - More info can be found in `schema.json`
  - This opens up the possibility of adding Exotic Armor pieces in the future but the multipliers require implementation

## v0.4.2 - January 29, 2023

- Updated the override cooldown of the Bastion aspect
- Updated charge rate scaling of class abilities for improved accuracy

## v0.4.1 - January 24, 2023

- Updated cooldown times for [patch 6.3.0.5](https://www.bungie.net/7/en/News/article/hotfix_6_3_0_5)
  - Towering Barricade base cooldown increased from 40s to 48s
  - Rally Barricade base cooldown increased from 32s to 38s
  - Thruster base cooldown increased from 30s to 36s
  - Marksman's Dodge base cooldown increased from 29s to 34s
  - Gambler's Dodge base cooldown increased from 38s to 46s

## v0.4.0 - January 13, 2023

- An update can now be aborted.
  - This dumps the changes you've made to `/generator/dump.json`
- Added a way to add new abilities to the database without editing the JSON source file directly
- Abilities in each category are now sorted by their base cooldowns (descending) and alphabetically (ascending)

## v0.3.0 - January 13, 2023

- Removed 'Ability Tiers' from source file (replaced with per-ability base cooldowns)
- Reworked conversion
- Renamed `/gen` folder to `/generator`

## v0.2.0 - December 11, 2022

- Added `/gen` folder with source files and generator Python code
- Improved specificity in JSON schema
- Added global update tracking in `update.json`

## v0.1.0 - December 10, 2022

- Initial Release

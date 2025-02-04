# Changelogs

## v1.9.10 - February 4, 2025

- *Tempest Strike* `Override` has been removed
- *Citan's Ramparts* `Override` has been removed

## v1.9.9 - November 20, 2024

### Revenant Act II Patch

- *Storm's Edge* `BaseCooldown` changed to 625 seconds (from 500) and `SuperTier` changed to 1 (from 3)

### Strand Melee Cooldown Updates

All new cooldowns mentioned differ from those shown in the in-game UI. We're aware and the in-game UI is wrong just as it has been many times in the past. These changes don't "accurately" represent the underlying mechanics at play here but the numbers produced are within the expected margin of error for the project. Ideally, we'd use values that more closely represent the actual underlying behavior but seeing as no partner project supports `ChargeBasedScaling` currently in any capacity, we have to distribute the mess and let it bleed into the `BaseCooldown`.

- Updated *Arcane Needle*
  - Strand version:
    - `BaseCooldown` changed to 86.5 seconds (from 100 seconds)
    - `ChargeBasedScaling` changed to `1, 1.415, 2.25` (from `1, 1.33, 2`) for `0, 1, 2` active charges of the ability
  - Prismatic version
    - `BaseCooldown` changed to 124 seconds (from 100 seconds)
    - `ChargeBasedScaling` changed to `1, 1.415, 2.25` (from `1, 1.33, 2`) for `0, 1, 2` active charges of the ability
- Updated *Frenzied Blade*
  - Strand version:
    - `BaseCooldown` changed to 99 seconds (from 114 seconds)
    - `ChargeBasedScaling` changed to `1, 1.35, 1.7` (from `1, 1.25, 1.5`) for `0, 1, 2` active charges of the ability
  - Prismatic version
    - `BaseCooldown` changed to 141 seconds (from 114 seconds)
    - `ChargeBasedScaling` changed to `1, 1.35, 1.7` (from `1, 1.25, 1.5`) for `0, 1, 2` active charges of the ability

## v1.9.8 Updated Icefall Mantle to now work with Prismatic's Thruster ability - October 25, 2024

- *Icefall Mantle* now properly rescales base cooldown to 70 seconds when used with *Thruster - Prismatic*

## v1.9.7 Added Prismatic Bleak Watcher Aspect Override - October 23, 2024

- Prismatic *Bleak Watcher* overrides base cooldowns to at least 121 seconds but interestingly does not affect Chunk Energy Scalars
  - This currently only affects *Healing Grenades* as they are the only ones with a shorter cooldown

## v1.9.6 Updated for [Game Version 8.1.0](https://www.bungie.net/7/en/News/article/destiny_update_8_1_0) - October 13, 2024

- Changed *Disorienting Blow* cooldown from 90 to 82 seconds
  - Don't check the patch notes for this info because Bungie completely messed their numbers up

## v1.9.5 Largely updated for [Game Version 8.0.5.4](https://www.bungie.net/7/en/News/Article/destiny_2_update_8_0_5_4) - September 10, 2024

- Added *Threaded Specter* aspect Overrides
  - Affects `Gambler's Dodge` and `Marksman's Dodge`
  - Applies a `1.6666666667` cooldown `Scalar` to both class abilities
  - Still missing confirmation about its behaviour with regards to `ChunkEnergyScalar`s

## v1.9.4 Initial update for [Game Version 8.0.5.4](https://www.bungie.net/7/en/News/Article/destiny_2_update_8_0_5_4) - September 10, 2024

- *Swarm Grenade* cooldown changed from 91 to 105 seconds
- *Swarm Grenade* `ChunkEnergyScalar` changed from 0.875 to 0.75

## v1.9.3 Added Unbreakable Aspects - July 9, 2024

- *Unbreakable* overrides base grenade ability cooldowns to 152 seconds
  - This matches the cooldown of Vortex Grenades

## v1.9.2 The Final Shape New Abilities - June 7, 2024

- Added Prismatic mirrors of existing abilities
  - Currently under the assumption that they have no behavioural differences compared to their regular versions
- Added new Supers and their Prismatic versions

## v1.9.1 The Final Shape Balancing Patch - June 4, 2024

- Changed *Disorienting Blow* cooldown from 100 to 90 seconds and `ChunkEnergyScalar` from 0.8 to 0.9
- Added `ChargeBasedScaling` property to *Lightweight Knife* to indicate that it has 2 charges by default

## v1.9.0 Breaking Change - March 22, 2024

### Reworks and Deprecations

- `TotalHp` property of `Resilience` has been deprecated in favor of `ShieldHP`.
  - This is due to the Crucible sandbox overhauls that came with a change to guardian Health. Normal Health in core crucible modes was increased by 30 (going from 70 to 100) and thus the `TotalHP` property is no longer universally applicable to all parts of the game.
  - You can still use the above numbers to display total health in different parts of the sandbox. The Momentum Control and Mayhem Crucible party modes as well as all of PVE still keep base guardian Health at 70 while all other crucible modes have it at 100.
  - This information is reflected in the `Description` property of the new `ShieldHP` property of Resilience.
- `DRCondition`, `PvPDamageResistance`, and `PvEDamageResistance` properties of `Intellect` have been deprecated as they are outside the scope of this project. This was a failed experiment and I'm rolling the change back.
- `FlatIncrease` property of `Override` objects has been deprecated in favor of the `ChunkEnergyOverride` property.
  - This is due to the mechanic behind this being more involved and separated between PVP and PVE. This will be covered in the core Clarity tooltips instead going forward.

### New Additions

- Added `ChunkEnergyScalar` property to `Ability` objects.
  - This property is intented to show how an ability interacts with ability energy sources such as the Bomber class item mod. Abilities with longer cooldowns gain less energy from these sources and this property quantifies that.
  - To our knowledge, `ChunkEnergyScalar`s are not a thing for Super abilities so this property will not be present on `SuperAbility` objects
- Added `ChunkEnergyScalarDescription` and `ChargeBasedScalingDescription` properties to Character Stat objects with the exception of `Intellect`
  - These are going to be the exact same for all of them and work in the same way as `Description` objects: they store the locale ID for the tooltip that explains what Chunk Energy Scalars and Charge-Based Scaling respectively are and how these mechanics work.
- Added `ChunkEnergyOverride` property to `Override` objects — replacing `FlatIncrease`.
  - This property is similar to the exising `CooldownOverride` property and is a direct replacement of the `ChunkEnergyScalar` property of the `Ability` objects under the same character stat.
- Added `SuperTier` and `ActiveRegenScalar` properties to `SuperAbility` objects.
  - Super Tiers are directly tied to the cooldowns of the supers but I feel it's worth surfacting this information to communicate that the tiers also influence the amount of Super Energy you gain from active super regeneration.
  - The `SuperTier` property is just a user-focused but mostly irrelevant stat simply used to communicate where the `ActiveRegenScalar` property comes from. The `ActiveRegenScalar` property is the actually important part as it is what communicates to users how much benefit they gain from Active Super Regen (more on that below).
- Added `SuperTierDescription` and `ActiveRegenScalarDescription` properties to the `Intellect` Character Stat object.
  - Like the `ChunkEnergyScalarDescription` mentioned above, these are also more specific `Description` objects that store a locale ID with the explanation of what each of these stats are.

### Data Changes

- Removed *Ensnaring Slam* `Override` with the deprecation of the `FlatIncrease` property
- Added *Arbor Warden* `Override` for the *Thruster* ability
- Corrected *Grapple* cooldown from 105 to 82 seconds
- Corrected *Chaos reach* cooldown from 556 to 455 seconds
- Corrected *Hammer Strike* cooldown from 101 to 91 seconds
- Corrected *Seismic Strike* cooldown from 101 to 91 seconds
- Corrected *Shield Bash* cooldown from 114 to 91 seconds
- Corrected *Shiver Strike* cooldown from 113 to 114 seconds
- Corrected *Snare Bomb* cooldown from 91 to 90 seconds
- Corrected *Threaded Spike* cooldown from 125 to 100 seconds

## v1.8.0 Breaking Change (I'm fine trust me) - August 25, 2023

### Schema/Database Structure Changes v1.8

- `Requirements` properties of `Override` objects now support wildcards
  - Inputting 0 in the `Requirements` array will select every ability from the Character Stat the Override is under (only works when the length of the `Requirements` array is 1)
  - Inputting negative numbers in the `Requirements` array selects entire subclasses by their inventoryItem hash. The negative numbers are simply `-[hash]`.

### Data Changes v1.8.0

- Added *Mothkeeper's Wraps* override (uses the 0 wildcard)
  - Overrides base grenade cooldown to 73 seconds
- Updated *Citan's Ramparts* override to be a 1.724137931x Scalar
- Updated *Bastion* override to a 1.4285714286x Scalar for Towering Barricade
  - Cooldown unchanged from before the S22 patch at 100 seconds

## v1.7.0 - Breaking Change (Ugh) - August 23, 2023

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

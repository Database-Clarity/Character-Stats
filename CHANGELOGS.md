# Changelogs

## v1.0 - March 9, 2023 

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

## v0.4 - January 13, 2023

- An update can now be aborted.
  - This dumps the changes you've made to `/generator/dump.json`
- Added a way to add new abilities to the database without editing the JSON source file directly
- Abilities in each category are now sorted by their base cooldowns (descending) and alphabetically (ascending)

## v0.3 - January 13, 2023

- Removed 'Ability Tiers' from source file (replaced with per-ability base cooldowns)
- Reworked conversion
- Renamed `/gen` folder to `/generator`

## v0.2 - December 11, 2022

- Added `/gen` folder with source files and generator Python code
- Improved specificity in JSON schema
- Added global update tracking in `update.json`

## v0.1 - December 10, 2022

- Initial Release

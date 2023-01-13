# Changelogs

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

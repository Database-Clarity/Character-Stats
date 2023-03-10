import json
import time
from CharacterStatDefs import *

# Reads user input
with open('./generator/SourceContent.json') as f:
    data = json.load(f)

while (True):
    if (int(input("Would you like to add additional entries to the database? (0 - No, 1 - Yes) ")) == 0):
        break
    print("Please select the character stat category you would like to add an ability to:\n1 - Mobility\n2 - Resilience\n3 - Recovery\n4 - Discipline\n5 - Intellect\n6 - Strength")
    characterStatArrayIndex = int(input("The selected category: ")) - 1
    selectedCharacterStat = characterStatNameArray[characterStatArrayIndex]
    newAbility = generateNewAbility()
    print("You're about to add the following ability under the",selectedCharacterStat,"character stat category. Are you sure you want to add this ability?\n",newAbility,"\n0 - No, 1 - Yes")
    if (int(input()) == 1):
        data[selectedCharacterStat]['Abilities'].append(newAbility)
    else:
        print("Ability addition aborted.\n")

if(int(input("Would you like to implement these changes? (0 - No, 1 - Yes) ")) == 0):
    print("Dumping changes to 'dump.json'.")
    with open('./generator/dump.json', 'w') as f:
        json.dump(data, f, indent=4)
    print("Dump complete, discarding changes.")
    print("Run complete.")
    quit()

# Sorts the abilities alphabetically 
print("Updating source files.")
for charStat in characterStatNameArray:
    data[charStat]['Abilities'].sort(key = lambda k: (k['Name']))

# Dumps input with updates
with open('./generator/SourceContent.json', 'w') as f:
    json.dump(data, f, indent=4)

# Generates cooldowns for each tier and removes information that's no longer useful.
print("Generating cooldown information.")
for i in characterStatNameArray:
    iterateDict(data, i)

# Output dump
with open('CharacterStatInfo.json', 'w') as f:
    json.dump(data, f, indent=4)
with open('CharacterStatInfo-NI.json', 'w') as f:
    json.dump(data, f)

# Update Checker
with open('update.json', "r") as f:
    update = json.load(f)
update["lastUpdate"] = time.time_ns()

if (int(input("Does the update include breaking changes? (0 - No, 1 - Yes) ")) == 1):
    update["lastBreakingChange"] = update["lastUpdate"]
    update["legacyRootDirectory"] = "https://database-clarity.github.io/Character-Stats/legacy-content/" + input("Please provide the root directory of where the legacy version of the database can be found:\n    https://database-clarity.github.io/Character-Stats/legacy-content/")

with open('update.json', "w") as f:
    json.dump(update, f)

print("Changes implemented. Run complete.")
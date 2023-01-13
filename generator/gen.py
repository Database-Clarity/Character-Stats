import json
import time
from CharacterStatDefs import *

# Reads user input
with open('./generator/Source Content.json') as f:
    data = json.load(f)

while (True):
    print("Would you like to add additional entries to the database?\n0 - No.\n1 - Yes.")
    if (input("Enter your choice: ") == '0'):
        break
    print("Please select the character stat category you would like to add an ability to:\n1 - Mobility\n2 - Resilience\n3 - Recovery\n4 - Discipline\n5 - Intellect\n6 - Strength")
    characterStatArrayIndex = int(input("The selected category: ")) - 1
    selectedCharacterStat = characterStatNameArray[characterStatArrayIndex]
    data[selectedCharacterStat]['Abilities'].append(generateNewAbility())

# Sorts the abilities by their base cooldown in descending order and alphabetically 
for charStat in characterStatNameArray:
    data[charStat]['Abilities'].sort(key = lambda k: (-k['BaseCooldown'], k['Name']))

# Dumps input with updates
with open('./generator/Source Content.json', 'w') as f:
    json.dump(data, f, indent=4)

# Generates cooldowns for each tier and removes information that's no longer useful.
for i in characterStatNameArray:
    iterateDict(data, i)

# Output dump
with open('CharacterStatInfo.json', 'w') as f:
    json.dump(data, f, indent=4)
with open('CharacterStatInfo-NI.json', 'w') as f:
    json.dump(data, f)

# Update Checker
with open('update.json', 'w') as f:
    version = {"lastUpdate": time.time_ns()}
    json.dump(version, f)
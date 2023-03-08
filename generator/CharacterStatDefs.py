from copy import deepcopy
import math

characterStatNameArray = ['Mobility','Resilience','Recovery','Discipline','Intellect','Strength']

# Returns a new ability entry from user input.
def generateNewAbility():
    newAbility = {}
    while (True):
        newAbility.update({"Hash": int(input("Input the inventoryItem hash: "))})
        newAbility.update({"Name": input("Input the name of the ability: ")})
        newAbility.update({"BaseCooldown": int(input("Input the base (T3) cooldown of the ability (in seconds): "))})
        print("Are these values accurate?\n", newAbility, "\n0 - No, 1 - Yes")
        if (int(input())):
            break
        newAbility.clear()
    return newAbility


# Iterates through a Character Stat dictionary and remove all entries with Charge Rate and cooldown information.
# Generates a "Cooldowns" property for each ability and override that contains an integer array of cooldown times at each tier. 
def iterateDict(paramDict, characterStatName):
    for ability in paramDict[characterStatName]['Abilities']:
        array = deepcopy(paramDict[characterStatName]['ChargeRateScalars'])
        for i in range(11):
            array[i] = round(1/array[i] * ability['BaseCooldown'])
        ability.update({"Cooldowns": array})
        del ability['BaseCooldown']
    for override in paramDict[characterStatName]['Overrides']:
        array = deepcopy(paramDict[characterStatName]['ChargeRateScalars'])
        for i in range(11):
            if (override['BaseCooldown'] == 0):
                array[i] = 0
                continue
            array[i] = round(1/array[i] * override['BaseCooldown'])
        override.update({"Cooldowns": array})
        del override['BaseCooldown']
    del paramDict[characterStatName]['ChargeRateScalars']
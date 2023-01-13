from copy import deepcopy
import math

characterStatNameArray = ['Mobility','Resilience','Recovery','Discipline','Intellect','Strength']

# Returns a new ability entry from user input.
def generateNewAbility():
    newAbility = {}
    newAbility.update({"Hash": int(input("Input the inventoryItem hash: "))})
    newAbility.update({"Name": input("Input the name of the ability: ")})
    newAbility.update({"BaseCooldown": int(input("Input the base (T3) cooldown of the ability (in seconds): "))})
    newAbility.update({"Override": bool(int(input("Does this ability override the cooldowns of other selected abilities? (0 - No, 1 - Yes)\nOverride: ")))})
    return newAbility


# Iterates through a Character Stat dictionary and remove all entries with Charge Rate and Tier information.
# Generates a "Cooldowns" property for each ability that contains an integer array of cooldown times at each tier. 
def iterateDict(paramDict, characterStatName):
    for ability in paramDict[characterStatName]['Abilities']:
        array = deepcopy(paramDict[characterStatName]['ChargeRateScalars'])
        for i in range(11):
            array[i] = math.ceil(1/array[i] * ability['BaseCooldown'])
        ability.update({"Cooldowns": array})
        del ability['BaseCooldown']
    del paramDict[characterStatName]['ChargeRateScalars']
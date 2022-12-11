import json
import math
import time
from copy import deepcopy

# Reads user input
with open('./generator/Source Content.json') as f:
    data = json.load(f)

# Dumps input with final formatting
with open('./generator/Formatted Source.json', 'w') as f:
    json.dump(data, f, indent=4)

# Iterates through a Character Stat dictionary and remove all entries with Charge Rate and Tier information.
# Generates a "Cooldowns" property for each ability that contains an integer array of cooldown times at each tier. 
def iterateDict(paramDict):
    for ability in data[paramDict]['Abilities']:
        regenTime = data[paramDict]['Tiers'][str(ability['Tier'])]
        array = deepcopy(data[paramDict]['ChargeRateScalars'])
        for i in range(11):
            array[i] = math.ceil(1/array[i] * regenTime)
        ability.update({"Cooldowns": array})
        del ability['Tier']
    del data[paramDict]['ChargeRateScalars'], data[paramDict]['Tiers']

# Input cleanup, Cooldown generation.
iterateDict('Mobility')
iterateDict('Resilience')
iterateDict('Recovery')
iterateDict('Discipline')
iterateDict('Intellect')
iterateDict('Strength')

# Output dump
with open('CharacterStatInfo.json', 'w') as f:
    json.dump(data, f, indent=4)
with open('CharacterStatInfo-NI.json', 'w') as f:
    json.dump(data, f)

# Update Checker
with open('update.json', 'w') as f:
    version = {"lastUpdate": time.time_ns()}
    json.dump(version, f)
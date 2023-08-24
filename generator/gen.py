import json
import time
import re
import customtkinter as ctk
from CTkScrollableDropdown import *
from shutil import copy
from os import makedirs
from copy import deepcopy

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("green")

# Read Source Json and save a backup
with open('./generator/SourceContent.json') as f:
    data = json.load(f)
backup = deepcopy(data)

characterStatNameArray = ["Mobility","Resilience","Recovery","Discipline","Intellect","Strength"]

def getProperties(dictionary: dict):
    '''Returns Dictionary Keys of input dictionary'''
    return list(dictionary.keys())
def getValues(dictionary: dict): # currently unused kekw
    '''Returns Dictionary Values of input dictionary'''
    return list(dictionary.values())

def changed1st(choice):
    '''Updates 2nd and 3rd dropdowns as well as text boxes if 1st one was updated'''
    dropdown1.set(choice)
    newDropdown2 = getProperties(data[choice])
    newDropdown2.pop(0)
    dropdown2contents.configure(values=newDropdown2)
    dropdown2.set(newDropdown2[0])
    changed2nd(newDropdown2[0])
def changed2nd(choice):
    '''Updates 3rd dropdown (and/or populates editor) if 2nd one was updated'''
    dropdown2.set(choice)
    if (choice == "Abilities" or choice == "Overrides" or choice == "SuperAbilities"):
        if (len(data[dropdown1.get()][choice]) > 0):
            newValues = []
            for value in data[dropdown1.get()][choice]:
                if choice == "Abilities" or choice == "SuperAbilities":
                    newValues.append(value["Name"]+' ('+str(value["BaseCooldown"])+')')
                else:
                    newValues.append(value["Name"])
            dropdown3.configure(state="normal")
            dropdown3contents.configure(values=newValues)
            dropdown3.set(re.search("^[^ ]*",newValues[0]).group(0))
            addNewItemButton.configure(state="normal")
            populateEditor()
            populateContext()
        else:
            dropdown3.configure(state="disabled")
            dropdown3contents.configure(values=[listIsEmpty], state="disabled")
            dropdown3.set(listIsEmpty)
            resetEditor()
            clearContext()
        addNewItemButton.configure(state="normal")
    else: 
        dropdown3contents.configure(values=[dropdown3invalid], state="disabled")
        dropdown3.configure(state="disabled")
        dropdown3.set(dropdown3invalid)
        addNewItemButton.configure(state="disabled")
        clearContext()
        populateEditor()
def changed3rd(choice):
    '''Updates text boxes if 3rd dropdown was updated'''
    dropdown3.set(re.search("^[^ ]*",choice).group(0))
    populateEditor()
    populateContext()

def returnIndexByName(abilityOverride: str, paramList: list) -> int:
    '''Returns list index of item with abilityOverride "Name" in paramList. Returns -1 if it does not exist.'''
    i = 0
    for item in paramList:
        if "Name" in item and item["Name"] == abilityOverride:
            return i
        i+=1
    return -1
def returnIndexByHash(abilityOverride: int, paramList: list) -> int:
    '''Returns list index of item with abilityOverride "Hash" in paramList. Returns -1 if it does not exist.'''
    i = 0
    for item in paramList:
        if "Hash" in item and item["Hash"] == abilityOverride:
            return i
        i+=1
    return -1
def is_json(myjson: any) -> bool:
    if myjson is None:
        return False
    try:
        json.loads(myjson)
    except ValueError as e:
        return False
    return True
def it_floats(element: any) -> bool:
    if element is None: 
        return False
    try:
        float(element)
        return True
    except ValueError:
        return False
def is_int(element: any) -> bool:
    if element is None: 
        return False
    try:
        int(element)
        return True
    except ValueError:
        return False

def configureDeleteButton(charStat: str ,currentState: str, hash=0):
    '''Enables/Disables Delete Button depending on if the item is an Ability/Override or not.'''
    if currentState == "Abilities" or currentState == "Overrides" or currentState == "SuperAbilities":
        deleteItemButton.configure(state="normal")
    else:
        deleteItemButton.configure(state="disabled")

def resetEditor():
    '''Resets editor to defaults'''
    property1.configure(text="Property 1")
    property2.configure(text="Property 2")
    property3.configure(text="Property 3")
    property4.configure(text="Property 4")
    property5.configure(text="Property 5")
    property6.configure(text="Property 6")
    deleteItemButton.configure(state="disabled")

    value1.configure(state='normal')
    value1.delete(1.0,"end")
    value1.configure(state='disabled')

    value2.configure(state='normal')
    value2.delete(1.0,"end")
    value2.configure(state='disabled')

    value3.configure(state='normal')
    value3.delete(1.0,"end")
    value3.configure(state='disabled')

    value4.configure(state='normal')
    value4.delete(1.0,"end")
    value4.configure(state='disabled')

    value5.configure(state='normal')
    value5.delete(1.0,"end")
    value5.configure(state='disabled')
    
    value6.configure(state='normal')
    value6.delete(1.0,"end")
    value6.configure(state='disabled')
def populateEditor():
    '''Clears and populates editor text boxes based on the selected dropdown items'''
    resetEditor()
    charStat = dropdown1.get()
    currentState = dropdown2.get()
    if currentState == "Abilities":
        abilityOverride = returnIndexByName(dropdown3.get(),data[charStat][currentState])
        property1.configure(text="Hash")
        value1.configure(state='normal')
        value1.insert(1.0, data[charStat][currentState][abilityOverride]["Hash"])
        value1.configure(state='disabled')
        property2.configure(text="Name")
        value2.configure(state='normal')
        value2.insert(1.0, data[charStat][currentState][abilityOverride]["Name"])
        property3.configure(text="BaseCooldown")
        value3.configure(state='normal')
        value3.insert(1.0, data[charStat][currentState][abilityOverride]["BaseCooldown"])
        property4.configure(text="ChargeBasedScaling")
        value4.configure(state='normal')
        if ("ChargeBasedScaling" in data[charStat][currentState][abilityOverride]):
            value4.insert(1.0, json.dumps(data[charStat][currentState][abilityOverride]["ChargeBasedScaling"]))
        configureDeleteButton(charStat,currentState,data[charStat][currentState][abilityOverride]["Hash"])
    elif currentState == "SuperAbilities":
        abilityOverride = returnIndexByName(dropdown3.get(),data[charStat][currentState])
        property1.configure(text="Hash")
        value1.configure(state='normal')
        value1.insert(1.0, data[charStat][currentState][abilityOverride]["Hash"])
        value1.configure(state='disabled')
        property2.configure(text="Name")
        value2.configure(state='normal')
        value2.insert(1.0, data[charStat][currentState][abilityOverride]["Name"])
        property3.configure(text="BaseCooldown")
        value3.configure(state='normal')
        value3.insert(1.0, data[charStat][currentState][abilityOverride]["BaseCooldown"])
        property4.configure(text="PvPDamageResistance")
        value4.configure(state='normal')
        value4.insert(1.0, json.dumps(data[charStat][currentState][abilityOverride]["PvPDamageResistance"]))
        property5.configure(text="PvEDamageResistance")
        value5.configure(state='normal')
        value5.insert(1.0, json.dumps(data[charStat][currentState][abilityOverride]["PvEDamageResistance"]))
        property6.configure(text="DR Condition")
        value6.configure(state='normal')
        value6.insert(1.0, json.dumps(data[charStat][currentState][abilityOverride]["DRCondition"]))
        configureDeleteButton(charStat,currentState,data[charStat][currentState][abilityOverride]["Hash"])
    elif currentState == "Overrides":
        abilityOverride = returnIndexByName(dropdown3.get(),data[charStat][currentState])
        property1.configure(text="Hash")
        value1.configure(state='normal')
        value1.insert(1.0, data[charStat][currentState][abilityOverride]["Hash"])
        value1.configure(state='disabled')
        property2.configure(text="Name")
        value2.configure(state='normal')
        value2.insert(1.0, data[charStat][currentState][abilityOverride]["Name"])
        property3.configure(text="Requirements")
        value3.configure(state='normal')
        value3.insert(1.0, json.dumps(data[charStat][currentState][abilityOverride]["Requirements"]))
        property4.configure(text="CooldownOverride")
        value4.configure(state='normal')
        if ("CooldownOverride" in data[charStat][currentState][abilityOverride]):
            value4.insert(1.0, json.dumps(data[charStat][currentState][abilityOverride]["CooldownOverride"]))
        property5.configure(text="Scalar")
        value5.configure(state='normal')
        if ("Scalar" in data[charStat][currentState][abilityOverride]):
            value5.insert(1.0, json.dumps(data[charStat][currentState][abilityOverride]["Scalar"]))
        property6.configure(text="FlatIncrease")
        value6.configure(state='normal')
        if ("FlatIncrease" in data[charStat][currentState][abilityOverride]):
            value6.insert(1.0, json.dumps(data[charStat][currentState][abilityOverride]["FlatIncrease"]))
        configureDeleteButton(charStat,currentState,data[charStat][currentState][abilityOverride]["Hash"])
    else:
        if "Array" in data[charStat][currentState]:
            property1.configure(text=currentState)
            value1.configure(state='normal')
            value1.insert(1.0, json.dumps(data[charStat][currentState]["Array"]))
        else: 
            property1.configure(text=currentState)
            value1.configure(state='normal')
            value1.insert(1.0, json.dumps(data[charStat][currentState]))
        configureDeleteButton(charStat,currentState)

def clearContext():
    '''Clears context box menu.'''
    contextBox1.configure(state="normal")
    contextBox1.delete(1.0,"end")
    contextBox1.configure(state="disabled")
def populateContext():
    '''Populates context box based on Ability/Override information'''
    clearContext()
    charStat = dropdown1.get()
    currentState = dropdown2.get()
    if (currentState == "Abilities"):
        abilityContext(charStat)
    elif (currentState == "Overrides"):
        overrideContext(charStat)
    elif (currentState == "SuperAbilities"):
        superAbilityContext(charStat)
def abilityContext(charStat: str):
    #region Loads editor info into p1-4 and removes \n closing characters
    p1 = value1.get(1.0,"end")[:-1]
    p2 = value2.get(1.0,"end")[:-1]
    p3 = value3.get(1.0,"end")[:-1]
    p4 = value4.get(1.0,"end")[:-1]
    #endregion
    abilityDict = retrieveAbility(p1,p2,p3,p4)
    if abilityDict["Hash"] < 0:
        errorPopup("There were problems when parsing the input.",abilityDict["Name"])
        return
    selectedCooldown = abilityDict["BaseCooldown"]
    minuteSecond = str(int(selectedCooldown//60)) + ':' + str(round(selectedCooldown % 60))
    counter = 0
    nameList = []
    for ability in data[charStat]["Abilities"]:
        if ability["BaseCooldown"] == selectedCooldown:
            nameList.append(ability["Name"])
            counter+=1
    contextBox1.configure(state="normal")
    contextBox1.insert("end",f"Selected Cooldown Time: {selectedCooldown} ({minuteSecond})\n\n")
    contextBox1.insert("end",f"Number of Abilities with this cooldown: {counter}\n\n")
    if counter > 0:
        contextBox1.insert("end",f"Abilities with matching cooldowns:\n")
        for i in nameList:
            contextBox1.insert("end",text=f" • {i}\n")
    contextBox1.configure(state="disabled")
def overrideContext(charStat: str):
    #region Loads editor info into p1-6 and removes \n closing characters
    p1 = value1.get(1.0,"end")[:-1]
    p2 = value2.get(1.0,"end")[:-1]
    p3 = value3.get(1.0,"end")[:-1]
    p4 = value4.get(1.0,"end")[:-1]
    p5 = value5.get(1.0,"end")[:-1]
    p6 = value6.get(1.0,"end")[:-1]
    #endregion
    overrideDict = retrieveOverride(p1,p2,p3,p4,p5,p6)
    if overrideDict["Hash"] < 0:
        errorPopup("There were problems when parsing the input.",overrideDict["Name"])
        return
    requirements:list = overrideDict["Requirements"]
    reqLength = len(requirements)
    CDOverride = -1
    scalar = [1.0]*reqLength
    flatIncrease = [0.0]*reqLength
    if "CooldownOverride" in overrideDict:
        CDOverride = overrideDict["CooldownOverride"]
    if "Scalar" in overrideDict:
        scalar = overrideDict["Scalar"]
    if "FlatIncrease" in overrideDict:
        flatIncrease = overrideDict["FlatIncrease"]

    reqList = [{0: None, 1: None, 2: None, 3: None}]*reqLength
    for ability in data[charStat]["Abilities"]:
        for i in requirements:
            if ability["Hash"] == i:
                currentIndex = requirements.index(i)
                scaledValue = 0
                baseCD = ability["BaseCooldown"]
                if CDOverride != -1:
                    baseCD = CDOverride
                scaledValue = round(baseCD * scalar[currentIndex] + flatIncrease[currentIndex], 3)
                reqList[currentIndex] = {0: i, 1: ability["Name"], 2: ability["BaseCooldown"], 3: scaledValue}
    
    counter = 0    
    for item in reqList: #handle invalid input hashes
        if item[0] != requirements[counter]:
            reqList[counter] = {0: requirements[counter], 1: "Unknown Ability", 2: 0, 3: 0}
        counter += 1

    contextBox1.configure(state="normal")
    contextBox1.insert("end","Requirement Details\n\n")
    for item in reqList:
        contextBox1.insert("end",f"{item[0]} – {item[1]}\n  • Cooldown: {item[2]} (Scaled: {item[3]})\n\n")
    contextBox1.configure(state="disabled")
def superAbilityContext(charStat: str):
    #region Loads editor info into p1-5 and removes \n closing characters
    p1 = value1.get(1.0,"end")[:-1]
    p2 = value2.get(1.0,"end")[:-1]
    p3 = value3.get(1.0,"end")[:-1]
    p4 = value4.get(1.0,"end")[:-1]
    p5 = value5.get(1.0,"end")[:-1]
    p6 = value6.get(1.0,"end")[:-1]
    #endregion
    superAbilityDict = retrieveSuperAbility(p1,p2,p3,p4,p5,p6)
    if superAbilityDict["Hash"] < 0:
        errorPopup("There were problems when parsing the input.",superAbilityDict["Name"])
        return
    selectedCooldown = superAbilityDict["BaseCooldown"]
    minuteSecond = str(int(selectedCooldown//60)) + ':' + str(round(selectedCooldown % 60))
    counter = 0
    nameList = []
    for superAbility in data[charStat]["SuperAbilities"]:
        if superAbility["BaseCooldown"] == selectedCooldown:
            nameList.append(superAbility["Name"])
            counter+=1
    contextBox1.configure(state="normal")
    contextBox1.insert("end",f"Selected Cooldown Time: {selectedCooldown} ({minuteSecond})\n\n")
    contextBox1.insert("end",f"Number of Abilities with this cooldown: {counter}\n\n")
    if counter > 0:
        contextBox1.insert("end",f"Abilities with matching cooldowns:\n")
        for i in nameList:
            contextBox1.insert("end",text=f" • {i}\n")
    contextBox1.configure(state="disabled")

def retrieveAbility(pHash:str,pName:str,pBaseCD:str,pChargeBS:str):
    '''Converts current editor state into an Ability object. If checks fail, it returns -1 for the Hash and an error message in the Name property.'''
    ability = {}
    if pHash and pHash.isdigit(): # hash input
        ability["Hash"] = int(pHash)
    else:
        return {"Hash": -1, "Name": "Hash input was invalid. Please provide a positive integer."}
    if pName: # name input
        ability["Name"] = pName
    else:
        return {"Hash": -1, "Name": "Name input was unspecified."}
    if pBaseCD and it_floats(pBaseCD) and float(pBaseCD) > 0:
        ability["BaseCooldown"] = round(float(pBaseCD),3)
    else:
        return {"Hash": -1, "Name": "Base cooldown input was invalid. Please provide a positive number."}
    if pChargeBS:
        if is_json(pChargeBS):
            loaded = json.loads(pChargeBS)
            if type(loaded) == list and len(loaded) > 1 and all(it_floats(x) and x > 0 for x in loaded):
                    ability["ChargeBasedScaling"] = loaded
            else: return {"Hash": -1, "Name": "ChargeBasedScaling input was invalid. Please provide an array of positive floats of at least 2 length or leave the input empty."}
        else: return {"Hash": -1, "Name": "ChargeBasedScaling could not be parsed. Please provide an array of positive floats of at least 2 length or leave the input empty."}
    return ability
def retrieveOverride(pHash:str,pName:str,pReqs:str,pCDOverride:str,pScalar:str,pFlatIncrease:str):
    '''Converts current editor state into an Ability object. If checks fail, it returns -1 for the Hash and an error message in the Name property.'''
    # print(p1,p2,p3,p4,p5,p6)
    override = {}
    if pHash.isdigit(): # hash input
        override["Hash"] = int(pHash)
    else:
        return {"Hash": -1, "Name": "Hash input was invalid. Please provide a positive integer."}
    if pName: # name input
        override["Name"] = pName
    else:
        return {"Hash": -1, "Name": "Name input was unspecified."}
    if is_json(pReqs) and type(json.loads(pReqs)) == list: # requirements array input
        reqList = json.loads(pReqs)
        if all(is_int(x) and x > 0 for x in reqList):
            override["Requirements"] = json.loads(pReqs)
        else:
            return {"Hash": -1, "Name": "Requirements input was invalid. Please provide an array of positive integers."}
    else:
        return {"Hash": -1, "Name": "Requirements input could not be parsed."}
    listLength = len(override["Requirements"])

    if pCDOverride: # cooldown override input
        if pCDOverride.isdigit():
            override["CooldownOverride"] = int(pCDOverride)
        else:
            return {"Hash": -1, "Name": "CooldownOverride input was invalid. Please provide a positive integer."}
    if pScalar: # scalar input
        if is_json(pScalar):
            loaded = json.loads(pScalar)
            if type(loaded) == list:
                if len(loaded) == listLength:
                    if all(it_floats(x) and x > 0 for x in loaded):
                        override["Scalar"] = loaded
                    else:
                        return {"Hash": -1, "Name": "Scalar input was invalid. Please provide an array of positive floats."}
                else:
                    return {"Hash": -1, "Name": "Scalar array length did not match Requirements array length."}
            else:
                return {"Hash": -1, "Name": "Scalar input could not be parsed. Please provide an array of positive floats."}
        else:
            return {"Hash": -1, "Name": "Scalar input could not be parsed. Please provide an array of positive floats."}
    if pFlatIncrease: # flat increase input
        if is_json(pFlatIncrease):
            loaded = json.loads(pFlatIncrease)
            if type(loaded) == list:
                if len(loaded) == listLength:
                    if all(it_floats(x) for x in loaded):
                        override["FlatIncrease"] = loaded
                    else:
                        return {"Hash": -1, "Name": "FlatIncrease input was invalid. Please provide an array of integers."}
                else:
                    return {"Hash": -1, "Name": "FlatIncrease array length did not match Requirements array length."}
            else:
                return {"Hash": -1, "Name": "FlatIncrease input could not be parsed. Please provide an array of integers."}
        else:
            return {"Hash": -1, "Name": "FlatIncrease input could not be parsed. Please provide an array of integers."}
    if ("CooldownOverride" in override or "Scalar" in override or "FlatIncrease" in override):
        return override
    else: return {"Hash": -1, "Name": "Please specify at least one of CooldownOverride, Scalar, or FlatIncrease."}
def retrieveSuperAbility(pHash:str,pName:str,pBaseCD:str,pPvPDR:str,pPvEDR:str, pDRCondition:str):
    '''Converts current editor state into an SuperAbility object. If checks fail, it returns -1 for the Hash and an error message in the Name property.'''
    superAbility = {}
    if pHash and pHash.isdigit(): # hash input
        superAbility["Hash"] = int(pHash)
    else:
        return {"Hash": -1, "Name": "Hash input was invalid. Please provide a positive integer."}
    if pName: # name input
        superAbility["Name"] = pName
    else:
        return {"Hash": -1, "Name": "Name input was unspecified."}
    if pBaseCD and it_floats(pBaseCD) and float(pBaseCD) > 0:
        superAbility["BaseCooldown"] = round(float(pBaseCD),3)
    else:
        return {"Hash": -1, "Name": "Base cooldown input was invalid. Please provide a positive number."}
    if pPvPDR:
        if is_json(pPvPDR):
            loaded = json.loads(pPvPDR)
            if type(loaded) == list:
                    superAbility["PvPDamageResistance"] = loaded
            else: return {"Hash": -1, "Name": "PvPDamageResistance input was invalid. Please provide an array of floats (array can be left empty)."}
        else: return {"Hash": -1, "Name": "PvPDamageResistance could not be parsed. Please provide an array of floats (array can be left empty)."}
    if pPvEDR:
        if is_json(pPvEDR):
            loaded = json.loads(pPvEDR)
            if type(loaded) == list:
                    superAbility["PvEDamageResistance"] = loaded
            else: return {"Hash": -1, "Name": "PvEDamageResistance input was invalid. Please provide an array of floats (array can be left empty)."}
        else: return {"Hash": -1, "Name": "PvEDamageResistance could not be parsed. Please provide an array of floats (array can be left empty)."}
    if pDRCondition:
        if is_json(pDRCondition):
            loaded = json.loads(pDRCondition)
            if type(loaded) == list:
                    superAbility["DRCondition"] = loaded
            else: return {"Hash": -1, "Name": "DRCondition input was invalid. Please provide an array of strings (array can be left empty). Each condition must be in \"quotation marks\""}
        else: return {"Hash": -1, "Name": "DRCondition could not be parsed. Please provide an array of strings (array can be left empty). Each condition must be in \"quotation marks\""}
    if len(superAbility["PvPDamageResistance"]) == len(superAbility["PvEDamageResistance"]) == len(superAbility["DRCondition"]):
        None
    else: return {"Hash": -1, "Name": "Ensure that the PvPDamageResistance, PvEDamageResistance, and DRCondition arrays are of the same length."}
    return superAbility
def retrieveMisc(p1):
    '''Converts current editor state into an Misc Info list.'''
    item = []
    if is_json(p1):
        if type(json.loads(p1)) == list and len(json.loads(p1)) == 11:
            item = json.loads(p1)
        else: item = ["Input was invalid."]
    else: item = ["Input could not be parsed."]
    return item
def updateAbilityOrOverride(charStat: str, currentState: str, abilityOverride: dict):
    '''Updates ability or override dict with matching Hash key in the main dictionary to abilityOverride.'''
    for item in data[charStat][currentState]:
        if item["Hash"] == abilityOverride["Hash"]:
            if item == abilityOverride:
                return
            for key in abilityOverride:
                item[key] = abilityOverride[key]
    # Updates Changed Items list
    change = {"CharStat": charStat, "CharStatProperty": currentState, "Hash": abilityOverride["Hash"], "Name": abilityOverride["Name"]}
    for item in changedItemList:
        if "Hash" in item:
            if item["Hash"] == change["Hash"]:
                item = change
                changedItems.update_item(change)
                changed2nd(currentState)
                changed3rd(abilityOverride["Name"])
                return
    changedItemList.append(change)
    changedItems.add_item(change)
    changed2nd(currentState)
    changed3rd(abilityOverride["Name"])
def updateMisc(charStat: str, currentState: str, miscInfo: list):
    '''Updates Miscellaneous Info (WalkingSpeed/FlinchResistance/etc.) to miscInfo.'''
    if data[charStat][currentState]["Array"] == miscInfo:
        return
    data[charStat][currentState]["Array"] = miscInfo
    # Updates Changed Items list
    change = {"CharStat": charStat, "CharStatProperty": currentState, "Hash": None, "Name": currentState}
    for item in changedItemList:
        if item["Name"] == change["Name"]:
            return
    changedItemList.append(change)
    changedItems.add_item(change)

def errorPopup(errType: str, error: str):
    '''Locks app window until user closes error popup window. Enter and Esc keys as well as the button close the popup.'''
    popup = ctk.CTkToplevel()
    error_popup_w = 400
    error_popup_h = 215
    error_popup_offset_w = app_w/2 - error_popup_w/2
    error_popup_offset_h = app_h/2 - error_popup_h/2
    popup.geometry("%dx%d+%d+%d" % (error_popup_w, error_popup_h, app.winfo_x() + error_popup_offset_w, app.winfo_y() + error_popup_offset_h))
    popup.title("Error Dialog")
    popup.grab_set()

    def destroyPopup(*_):
        popup.destroy()
    popup.bind("<Return>",destroyPopup)
    popup.bind("<Escape>",destroyPopup)

    label = ctk.CTkLabel(popup, text=errType, font=ctk.CTkFont(size=14,weight="bold"))
    label.pack(padx=20, pady=10)
    context = ctk.CTkTextbox(popup, height=120, corner_radius=10, wrap='word')
    context.pack(padx=20, pady=0, fill="x")
    context.insert(1.0, error)
    context.configure(state='disabled')
    acknowledge = ctk.CTkButton(popup, text="Acknowledge", command=destroyPopup, font=ctk.CTkFont(size=14,weight="bold"))
    acknowledge.pack(padx=20, pady=10, ipadx=10)
def updateItem():
    '''Updates currently selected property/object with the current contents of the editor'''
    #region Loads editor info into p1-6 and removes \n closing characters
    p1 = value1.get(1.0,"end")[:-1]
    p2 = value2.get(1.0,"end")[:-1]
    p3 = value3.get(1.0,"end")[:-1]
    p4 = value4.get(1.0,"end")[:-1]
    p5 = value5.get(1.0,"end")[:-1]
    p6 = value6.get(1.0,"end")[:-1]
    #endregion
    # Load selection info, 3rd dropdown is ignored since we already have a hash in p1
    charStat = dropdown1.get()
    currentState = dropdown2.get()
    
    if (currentState == "Abilities"):
        item = retrieveAbility(p1,p2,p3,p4)
        # If retrieveAbility's checks fail, it returns -1 for the Hash and the error message in the "Name" property
        if item["Hash"] < 0:
            errorPopup("There were problems when parsing the input.",item["Name"])
            return
        updateAbilityOrOverride(charStat,currentState,item)
    elif (currentState == "Overrides"):
        item = retrieveOverride(p1,p2,p3,p4,p5,p6)
        if item["Hash"] < 0:
            errorPopup("There were problems when parsing the input.",item["Name"])
            return
        updateAbilityOrOverride(charStat,currentState,item)
    elif (currentState == "SuperAbilities"):
        item = retrieveSuperAbility(p1,p2,p3,p4,p5,p6)
        if item["Hash"] < 0:
            errorPopup("There were problems when parsing the input.",item["Name"])
            return
        updateAbilityOrOverride(charStat,currentState,item)
    else:
        item = retrieveMisc(p1)
        if len(item) < 11:
            errorPopup("There were problems when parsing the input.",item[0])
            return
        updateMisc(charStat,currentState,item)
    populateContext()

def restoreOriginalData(charStat: str, charStatProperty: str, hash: int = None) -> bool:
    '''Restores Original Data from backup database if it was present at the time of launching the program. Returns True on success and False if there is no backup to restore from.'''
    if charStatProperty == "Abilities" or charStatProperty == "Overrides" or charStatProperty == "SuperAbilities":
        if hash == None:
            errorPopup("Input Error","Ability or Override item was selected but no hash was provided. Please provide a valid hash.")
            return
        indexBackup = returnIndexByHash(hash,backup[charStat][charStatProperty])
        indexWorking = returnIndexByHash(hash,data[charStat][charStatProperty])
        if indexBackup != -1: 
            data[charStat][charStatProperty][indexWorking].clear()
            data[charStat][charStatProperty][indexWorking] = deepcopy(backup[charStat][charStatProperty][indexBackup])
        else:
            errorPopup("New Item Reset Error","This item has been newly added to the database in this session and thus doesn't have a backup to restore. Due to this, the restore button has been changed to a Delete button. Clicking the Delete button will permanently remove this item from the database.")
            return False
        # Remove entry from Changed Items List
        if returnIndexByHash(hash,changedItemList) != -1:
            changedItemList.pop(returnIndexByHash(hash,changedItemList))
            changed2nd(charStatProperty)
            changed3rd(backup[charStat][charStatProperty][indexBackup]["Name"])
    else:
        data[charStat][charStatProperty] = deepcopy(backup[charStat][charStatProperty])
        # Remove entry from Changed Items List
        if returnIndexByName(charStatProperty,changedItemList) != -1:
            changedItemList.pop(returnIndexByName(charStatProperty,changedItemList))
            changed2nd(charStatProperty)
    populateEditor()
    populateContext()
    return True

def openDirect(charStat: str, charStatProperty: str, abilityOrOverrideName: int = None):
    '''Directly sets the editor to the item specified in the input parameters.'''
    dropdown1.set(charStat)
    changed1st(charStat)
    dropdown2.set(charStatProperty)
    changed2nd(charStatProperty)
    if charStatProperty == "Abilities" or charStatProperty == "Overrides" or charStatProperty == "SuperAbilities":
        changed3rd(abilityOrOverrideName)

class ScrollableChangeListFrame(ctk.CTkScrollableFrame):
    def __init__(self, master, command=None, **kwargs):
        super().__init__(master, **kwargs)
        self.grid_columnconfigure(0, weight=1)

        self.command = command
        self.radiobutton_variable = ctk.StringVar()
        self.label_list = []
        self.button_list = []
        self.hash_list = []

    def add_item(self, item: dict):
        '''Appends an item to the Change List Frame'''
        label = ctk.CTkLabel(self, text=item["Name"], compound="left", padx=5, anchor="w", cursor="hand2")
        label.grid(row=len(self.label_list), column=0, pady=(0, 10), sticky="w")
        label.bind("<Button-1>", lambda e: openDirect(item["CharStat"], item["CharStatProperty"], item["Name"]))
        button = ctk.CTkButton(self, text="Reset", width=50, command=lambda: self.__reset_item(item))
        button.grid(row=len(self.button_list), column=1, pady=(0, 10), padx=5)
        button.configure()
        
        self.label_list.append(label)
        self.button_list.append(button)
        if item["Hash"]:
            self.hash_list.append(item["Hash"])
        else:
            self.hash_list.append(int(-1*len(self.label_list))) 
    
    def update_item(self, change: dict):
        '''Updates the name of an existing item in the list. Only works with Ability and Override items.'''
        for label, hash in zip(self.label_list, self.hash_list):
            if change["Hash"] == hash:
                label.configure(text=change["Name"])
                label.unbind("<Button-1>")
                label.bind("<Button-1>", lambda e: openDirect(change["CharStat"], change["CharStatProperty"], change["Name"]))


    def __reset_item(self, item: dict): 
        '''If the item already existed before the changes made in the session, it resets it to the stored backup. If it's a newly added item, it switches the reset button to a Delete button that deletes the item entirely.'''
        for label, button, hash in zip(self.label_list, self.button_list, self.hash_list):
            if item["Hash"] == hash:
                if restoreOriginalData(item["CharStat"],item["CharStatProperty"],item["Hash"]):
                    label.destroy()
                    button.destroy()
                    self.label_list.remove(label)
                    self.button_list.remove(button)
                    self.hash_list.remove(hash)
                else:
                    # restoreOriginalData can only return False if the CharStatProperty is either Abilities or Overrides
                    # in case it returns False, the item to be removed is newly added and so doesn't have a backup
                    # since this is the case, we can change the Restore button to a Delete button with the corresponding code
                    button.configure(text="Delete", command=lambda: self.__delete_item(item))
                return
            elif item["Name"] == label.cget("text"):
                restoreOriginalData(item["CharStat"],item["CharStatProperty"],item["Hash"])
                label.destroy()
                button.destroy()
                self.label_list.remove(label)
                self.button_list.remove(button)
                self.hash_list.remove(hash)
            openDirect(item["CharStat"], item["CharStatProperty"], item["Hash"])

    def __delete_item(self, item: dict):
        '''Used exclusively inside __reset_item. Deletes newly added Ability or Override items that don't have a backup from before this session.'''
        dict_index = returnIndexByHash(item["Hash"],data[item["CharStat"]][item["CharStatProperty"]])
        for label, button, hash in zip(self.label_list, self.button_list, self.hash_list):
            if item["Hash"] == hash:
                label.destroy()
                button.destroy()
                self.label_list.remove(label)
                self.button_list.remove(button)
                self.hash_list.remove(hash)
        data[item["CharStat"]][item["CharStatProperty"]].pop(dict_index)
        changed2nd(item["CharStatProperty"])

def addNewItem():
    '''Brings up a dialog to input required properties and then opens it up in the editor.'''
    charStat = dropdown1.get()
    currentState = dropdown2.get()
    popup = ctk.CTkToplevel()
    input_popup_w = 650
    input_popup_h = 335
    input_popup_offset_w = app_w/2 - input_popup_w/2
    input_popup_offset_h = app_h/2 - input_popup_h/2
    popup.geometry("%dx%d+%d+%d" % (input_popup_w, input_popup_h, app.winfo_x() + input_popup_offset_w, app.winfo_y() + input_popup_offset_h))

    popup.title(f"Adding New Item to 'data\{charStat}\{currentState}'")
    popup.grab_set()

    def appendReturnItem() -> bool:
        if currentState == "Abilities":
            returnItem = retrieveAbility(popupValue1.get(),popupValue2.get(),popupValue3.get(),popupValue4.get())
            if returnItem["Hash"] < 0:
                errorPopup("There were problems when parsing the input.",returnItem["Name"])
                return False
            else:
                data[charStat][currentState].append(returnItem)
                change = {"CharStat": charStat, "CharStatProperty": currentState, "Hash": returnItem["Hash"], "Name": returnItem["Name"]}
                for item in changedItemList:
                    if item["Name"] == change["Name"]:
                        return True
                changedItemList.append(change)
                changedItems.add_item(change)
                return True
        elif currentState == "Overrides":
            returnItem = retrieveOverride(popupValue1.get(),popupValue2.get(),popupValue3.get(),popupValue4.get(),popupValue5.get(),popupValue6.get())
            if returnItem["Hash"] < 0:
                errorPopup("There were problems when parsing the input.",returnItem["Name"])
                return False
            else:
                data[charStat][currentState].append(returnItem)
                change = {"CharStat": charStat, "CharStatProperty": currentState, "Hash": returnItem["Hash"], "Name": returnItem["Name"]}
                for item in changedItemList:
                    if item["Name"] == change["Name"]:
                        return True
                changedItemList.append(change)
                changedItems.add_item(change)
                return True
        elif currentState == "SuperAbilities":
            returnItem = retrieveSuperAbility(popupValue1.get(),popupValue2.get(),popupValue3.get(),popupValue4.get(),popupValue5.get(),popupValue6.get())
            if returnItem["Hash"] < 0:
                errorPopup("There were problems when parsing the input.",returnItem["Name"])
                return False
            else:
                data[charStat][currentState].append(returnItem)
                change = {"CharStat": charStat, "CharStatProperty": currentState, "Hash": returnItem["Hash"], "Name": returnItem["Name"]}
                for item in changedItemList:
                    if item["Name"] == change["Name"]:
                        return True
                changedItemList.append(change)
                changedItems.add_item(change)
                return True
        else:
            return False
    
    def destroyPopup(*_):
        if appendReturnItem():
            changed2nd(currentState)
            changed3rd(data[charStat][currentState][-1]["Name"])
            popup.destroy()
    
    if currentState == "Abilities":
        #row1
        popupProperty1 = ctk.CTkLabel(popup, text="Manifest inventoryItem Hash", anchor="center")
        popupProperty1.pack(padx=25, pady=(10,0), anchor="center")
        popupValue1 = ctk.CTkEntry(popup, corner_radius=10, state='normal',
                                   placeholder_text="Unique inventoryItem hash of the Ability")
        popupValue1.pack(padx=25, anchor="center", fill="x")
        #row2
        popupProperty2 = ctk.CTkLabel(popup, text="Ability Name", anchor="center")
        popupProperty2.pack(padx=25, pady=(10,0), anchor="center")
        popupValue2 = ctk.CTkEntry(popup, corner_radius=10, state='normal',
                                   placeholder_text="Unique name of the Ability")
        popupValue2.pack(padx=25, anchor="center", fill="x")
        #row3
        popupProperty3 = ctk.CTkLabel(popup, text="Base Cooldown", anchor="center")
        popupProperty3.pack(padx=25, pady=(10,0), anchor="center")
        popupValue3 = ctk.CTkEntry(popup, corner_radius=10, state='normal',
                                   placeholder_text="Base (T3) Cooldown of the Ability")
        popupValue3.pack(padx=25, anchor="center", fill="x")
        #row4
        popupProperty4 = ctk.CTkLabel(popup, text="Charge-Based Scaling (fill out if ability has multiple charges)", anchor="center")
        popupProperty4.pack(padx=25, pady=(10,0), anchor="center")
        popupValue4 = ctk.CTkEntry(popup, corner_radius=10, state='normal',
                                   placeholder_text="Array with length equal the number of intrinsic ability charges. Array items are charge rate scalars.")
        popupValue4.pack(padx=25, anchor="center", fill="x")
    elif currentState == "Overrides":
        input_popup_h = 460
        input_popup_offset_h = app_h/2 - input_popup_h/2
        popup.geometry("%dx%d+%d+%d" % (input_popup_w, input_popup_h, app.winfo_x() + input_popup_offset_w, app.winfo_y() + input_popup_offset_h))
        #row1
        popupProperty1 = ctk.CTkLabel(popup, text="Manifest inventoryItem Hash", anchor="center")
        popupProperty1.pack(padx=25, pady=(10,0), anchor="center")
        popupValue1 = ctk.CTkEntry(popup, corner_radius=10, state='normal',
                                   placeholder_text=f"Unique inventoryItem hash of the Override Item")
        popupValue1.pack(padx=25, anchor="center", fill="x")
        #row2
        popupProperty2 = ctk.CTkLabel(popup, text="Override Name", anchor="center")
        popupProperty2.pack(padx=25, pady=(10,0), anchor="center")
        popupValue2 = ctk.CTkEntry(popup, corner_radius=10, state='normal',
                                   placeholder_text=f"Unique name of the Override Item")
        popupValue2.pack(padx=25, anchor="center", fill="x")
        #row3
        popupProperty3 = ctk.CTkLabel(popup, text="Required Ability Hashes", anchor="center")
        popupProperty3.pack(padx=25, pady=(10,0), anchor="center")
        popupValue3 = ctk.CTkEntry(popup, corner_radius=10, state='normal',
                                   placeholder_text="Requires an array of inventoryItem hashes: [hash1, hash2, etc.]")
        popupValue3.pack(padx=25, anchor="center", fill="x")
        #row4
        popupProperty4 = ctk.CTkLabel(popup, text="Cooldown Override", anchor="center")
        popupProperty4.pack(padx=25, pady=(10,0), anchor="center")
        popupValue4 = ctk.CTkEntry(popup, corner_radius=10, state='normal',
                                   placeholder_text="Requires a number input (e.g. 38)")
        popupValue4.pack(padx=25, anchor="center", fill="x")
        #row5
        popupProperty5 = ctk.CTkLabel(popup, text="Cooldown Scalars", anchor="center")
        popupProperty5.pack(padx=25, pady=(10,0), anchor="center")
        popupValue5 = ctk.CTkEntry(popup, corner_radius=10, state='normal',
                                   placeholder_text="Requires an array of scalars of equal length to the Requirements array: [scalar1, scalar2, etc.]")
        popupValue5.pack(padx=25, anchor="center", fill="x")
        #row6
        popupProperty6 = ctk.CTkLabel(popup, text="Flat Cooldown Increase", anchor="center")
        popupProperty6.pack(padx=25, pady=(10,0), anchor="center")
        popupValue6 = ctk.CTkEntry(popup, corner_radius=10, state='normal',
                                   placeholder_text="Requires an array of nubmers of equal length to the Requirements array: [num1, num2, etc.]")
        popupValue6.pack(padx=25, anchor="center", fill="x")
    elif currentState == "SuperAbilities":
        #row1
        popupProperty1 = ctk.CTkLabel(popup, text="Manifest inventoryItem Hash", anchor="center")
        popupProperty1.pack(padx=25, pady=(10,0), anchor="center")
        popupValue1 = ctk.CTkEntry(popup, corner_radius=10, state='normal',
                                   placeholder_text="Unique inventoryItem hash of the Ability")
        popupValue1.pack(padx=25, anchor="center", fill="x")
        #row2
        popupProperty2 = ctk.CTkLabel(popup, text="Super Ability Name", anchor="center")
        popupProperty2.pack(padx=25, pady=(10,0), anchor="center")
        popupValue2 = ctk.CTkEntry(popup, corner_radius=10, state='normal',
                                   placeholder_text="Unique name of the Super Ability")
        popupValue2.pack(padx=25, anchor="center", fill="x")
        #row3
        popupProperty3 = ctk.CTkLabel(popup, text="Base Cooldown", anchor="center")
        popupProperty3.pack(padx=25, pady=(10,0), anchor="center")
        popupValue3 = ctk.CTkEntry(popup, corner_radius=10, state='normal',
                                   placeholder_text="Base (T3) Cooldown of the Super Ability")
        popupValue3.pack(padx=25, anchor="center", fill="x")
        #row4
        popupProperty4 = ctk.CTkLabel(popup, text="PvP Damage Resistance", anchor="center")
        popupProperty4.pack(padx=25, pady=(10,0), anchor="center")
        popupValue4 = ctk.CTkEntry(popup, corner_radius=10, state='normal',
                                   placeholder_text="Requires an array of Damage Resistance %\float values: [DR1, DR2, etc.]")
        popupValue4.pack(padx=25, anchor="center", fill="x")
        #row5
        popupProperty5 = ctk.CTkLabel(popup, text="PvE Damage Resistance", anchor="center")
        popupProperty5.pack(padx=25, pady=(10,0), anchor="center")
        popupValue5 = ctk.CTkEntry(popup, corner_radius=10, state='normal',
                                   placeholder_text="Requires an array of Damage Resistance %\float values: [DR1, DR2, etc.]. Array must be of equal length to the PvP DR array.")
        popupValue5.pack(padx=25, anchor="center", fill="x")
        #row6
        popupProperty6 = ctk.CTkLabel(popup, text="DR Conditions", anchor="center")
        popupProperty6.pack(padx=25, pady=(10,0), anchor="center")
        popupValue6 = ctk.CTkEntry(popup, corner_radius=10, state='normal',
                                   placeholder_text="Requires an array of Condition string values: [C1, C2, etc.]. Array must be of equal length to the PvP DR array.")
        popupValue6.pack(padx=25, anchor="center", fill="x")
    submitEntry = ctk.CTkButton(popup, text="Submit", command=destroyPopup, font=ctk.CTkFont(size=14,weight="bold"))
    submitEntry.pack(padx=20, pady=20, ipadx=10, fill="y")

def iterateDict(paramDict, characterStatName):
    '''
    Iterates through a Character Stat dictionary and remove all entries with Charge Rate and cooldown information.
    Generates a "Cooldowns" property for each ability and override that contains an integer array of cooldown times at each tier. 
    '''
    if characterStatName != "Intellect":
        for ability in paramDict[characterStatName]["Abilities"]:
            array = deepcopy(paramDict[characterStatName]["ChargeRateScalars"])
            for i in range(11):
                array[i] = round(1/array[i] * ability["BaseCooldown"],2)
            ability.update({"Cooldowns": array})
            del ability["BaseCooldown"]
    else:
        for ability in paramDict["Intellect"]["SuperAbilities"]:
            array = deepcopy(paramDict["Intellect"]["ChargeRateScalars"])
            for i in range(11):
                array[i] = round(1/array[i] * ability["BaseCooldown"],2)
            ability.update({"Cooldowns": array})
            del ability["BaseCooldown"]

    for override in paramDict[characterStatName]["Overrides"]:
        if "CooldownOverride" in override: # checks if "CooldownOverride" property is present
            array = deepcopy(paramDict[characterStatName]["ChargeRateScalars"])
            for i in range(11):
                array[i] = round(1/array[i] * override["CooldownOverride"],2)
            override.update({"CooldownOverride": array})
    del paramDict[characterStatName]["ChargeRateScalars"]
def submitChanges():
    '''Brings up a TopLevel window for committing updates with a read-only log window.'''
    submit_popup = ctk.CTkToplevel()
    submit_popup_w = 650
    submit_popup_h = 290
    submit_popup_offset_w = app_w/2 - submit_popup_w/2
    submit_popup_offset_h = app_h/2 - submit_popup_h/2
    submit_popup.geometry("%dx%d+%d+%d" % (submit_popup_w, submit_popup_h, app.winfo_x() + submit_popup_offset_w, app.winfo_y() + submit_popup_offset_h))

    submit_popup.title("Committing Changes")
    submit_popup.grab_set()

    def insertLog(logText: str):
        '''Inserts logText into the log text box and appends a newline.'''
        logs.configure(state='normal')
        logs.insert("end",logText+'\n')
        logs.configure(state='disabled')

    def implementChanges():
        # Sorts the abilities alphabetically 
        insertLog("Sorting Abilities and Overrides alphabetically.")
        for charStat in characterStatNameArray:
            if charStat != "Intellect":
                data[charStat]['Abilities'].sort(key = lambda k: (k['Name']))
            else:
                data[charStat]['SuperAbilities'].sort(key = lambda k: (k['Name']))
            data[charStat]['Overrides'].sort(key = lambda k: (k['Name']))
        
        # Dumps input with updates
        insertLog("Updating source file with the changes.")
        with open('./generator/SourceContent.json', 'w') as f:
            json.dump(data, f, indent=4)
        
        # Update Tracker Start
        with open('update.json', "r") as f:
            update = json.load(f)
        currentSchemaVersion = update["schemaVersion"]

        # Breaking Change handling
        if breakingChangeCheckBox.get():
            insertLog("Handling Breaking Changes.")
            version_dialog = ctk.CTkInputDialog(text="Enter the new schema version for this update:", title="Breaking Change Handler")
            answer = version_dialog.get_input()
            if not re.match(r"^\d+\.\d+$",answer):
                errorPopup("Input Error", "Please provide a valid version number when prompted. Version numbers consist of one major and one minor version number separated by a '.' character. Example: 1.7")
                logs.configure(state="normal")
                logs.delete(1.0, "end")
                logs.configure(state="disabled")
                return
            insertLog("Creating directory for the new schema version.")
            makedirs(f"versions\{answer}")
            update["schemaVersion"] = answer
            currentSchemaVersion = answer
        insertLog("Generating update.json.")
        update["lastUpdate"] = time.time_ns()
        with open('update.json', "w") as f:
            json.dump(update, f)

        # Generates cooldowns for each tier and removes information that's no longer useful.
        insertLog("Generating cooldown information.")
        exportData = deepcopy(data)
        for stat in characterStatNameArray:
            iterateDict(exportData, stat)
        
        # Output dump
        insertLog("Exporting updated database files.")
        with open(f'./versions/{currentSchemaVersion}/CharacterStatInfo.json', 'w') as f:
            json.dump(exportData, f, indent=4)
        with open(f'./versions/{currentSchemaVersion}/CharacterStatInfo-NI.json', 'w') as f:
            json.dump(exportData, f)
        insertLog("Changes implemented. Run complete.")
        submitChangesButton.configure(command=lambda: submit_popup.destroy(), text="Exit")

    logs = ctk.CTkTextbox(submit_popup, corner_radius=10, wrap='word')
    logs.pack(padx=20, pady=(20,10), fill="x", expand=True)
    logs.configure(state='disabled')

    submitChangesButton = ctk.CTkButton(submit_popup, text="Continue", font=ctk.CTkFont(size=14,weight="bold"), state="disabled", command=implementChanges)
    submitChangesButton.pack(padx=20, pady=(10,20), ipadx=10, fill="y")
    
    insertLog("Dumping source file changes to 'dump.json'.")
    with open('./generator/dump.json', 'w') as f:
        json.dump(data, f, indent=4)
    insertLog("Dump complete. Click the Continue button to proceed with the changes.")
    submitChangesButton.configure(state="normal")

#region App/Variable Initialization and Window Config
app = ctk.CTk()
app.title("Destiny 2 Character Stats by Stardust")
app_w = 1250
app_h = 580
screen_w = app.winfo_screenwidth()
screen_h = app.winfo_screenheight()
app_offset_w = screen_w/2 - app_w/2
app_offset_h = screen_h/2 - app_h/2
app.geometry("%dx%d+%d+%d" % (app_w, app_h, app_offset_w, app_offset_h))

app.grid_columnconfigure(2, weight=1)
app.grid_columnconfigure(1, weight=2)
app.grid_rowconfigure((0, 1, 2, 3), weight=1)
# Variable Initialization
dropdown3invalid = "Select 'Abilities' or 'Overrides'"
listIsEmpty = "The selected list is empty"
emptyLabel = ""
changedItemList = []
#endregion
#region Create Sidebar
sidebar = ctk.CTkFrame(app, corner_radius=0)
sidebar.grid(row=0, column=0, rowspan=4, sticky="nsew")
sidebar.grid_rowconfigure(4, weight=1)
sidebar.columnconfigure(0, weight=1)

dropdown1 = ctk.CTkOptionMenu(sidebar, anchor='center', width=250, values=getProperties(data), corner_radius=10, font=ctk.CTkFont(weight="bold",size=14))
dropdown1.grid(row=0, column=0, columnspan=2, padx=20, pady=(20, 0), sticky="ew", ipadx=10)
dropdown2contents = CTkScrollableDropdownFrame(dropdown1, values=getProperties(data), resize=False, command=changed1st,
                                               font=ctk.CTkFont(weight="bold",size=14), frame_border_color="#2fa572")

initialDropdown2Values = getProperties(data[getProperties(data)[0]])
initialDropdown2Values.pop(0)
dropdown2 = ctk.CTkOptionMenu(sidebar, anchor='center', width=250, values=initialDropdown2Values, corner_radius=10, font=ctk.CTkFont(weight="bold",size=14))
dropdown2.grid(row=1, column=0, columnspan=2, padx=20, pady=(10,0), sticky="ew", ipadx=10)
dropdown2contents = CTkScrollableDropdownFrame(dropdown2, values=initialDropdown2Values, resize=False, command=changed2nd,
                                               font=ctk.CTkFont(weight="bold",size=14), frame_border_color="#2fa572")

dropdown3 = ctk.CTkOptionMenu(sidebar, anchor='center', state="disabled", width=250, dynamic_resizing=False, corner_radius=10, values=[dropdown3invalid],
                            font=ctk.CTkFont(weight="bold",size=14))
dropdown3.grid(row=2, column=0, columnspan=2, padx=20, pady=(10,0), sticky="ew", ipadx=10)
dropdown3contents = CTkScrollableDropdownFrame(dropdown3, values=[dropdown3invalid], state="disabled", frame_corner_radius=10, resize=False, height=400, command=changed3rd,
                                          font=ctk.CTkFont(weight="bold",size=14), frame_border_color="#2fa572")

contextBox1 = ctk.CTkTextbox(sidebar, corner_radius=10, wrap='word', state='disabled')
contextBox1.grid(row=4, column=0, columnspan=2, padx=20, pady=10, sticky="nsew")

refreshContext = ctk.CTkButton(sidebar, anchor='center', text="Refresh Context", font=ctk.CTkFont(weight="bold",size=14), cursor="hand2", command=populateContext)
refreshContext.grid(row=5, column=0, padx=(20,5), pady=(0,20), sticky="EW")

addNewItemButton = ctk.CTkButton(sidebar, anchor='center', text="Add New Item", font=ctk.CTkFont(weight="bold",size=14), cursor="hand2", state="disabled", command=addNewItem)
addNewItemButton.grid(row=5, column=1, padx=(5,20), pady=(0,20), sticky="EW")
#endregion
#region Create main editing frame
editor = ctk.CTkFrame(app, corner_radius=0, fg_color="transparent")
editor.grid(row=0, column=1, rowspan=4, sticky="nsew")
editor.columnconfigure(0, weight=1)
editor.columnconfigure((1,2), weight=0)
#row1
property1 = ctk.CTkLabel(editor, text="Property 1", width=150, anchor="w")
property1.grid(row=0, column=0, padx=(40, 25), pady=(10,0), sticky="w")

deleteItemButton = ctk.CTkButton(editor, text="Delete Item", state='disabled', font=ctk.CTkFont(weight="bold"), cursor="hand2")
deleteItemButton.grid(row=0, column=1, padx=(25,0), pady=(10,5), sticky="e")

applyChanges = ctk.CTkButton(editor, anchor='center', text="Apply Changes", font=ctk.CTkFont(weight="bold"), cursor="hand2", command=updateItem)
applyChanges.grid(row=0, column=2, padx=(5,25), pady=(10,5), sticky="e")

value1 = ctk.CTkTextbox(editor, corner_radius=10, height=55, wrap='word', state='disabled', undo=True)
value1.grid(row=1, column=0, columnspan=3, padx=25, sticky="ew")
#row2
property2 = ctk.CTkLabel(editor, text="Property 2", width=150, anchor="w")
property2.grid(row=2, column=0, padx=(40, 25), pady=(10,0), sticky="w")

value2 = ctk.CTkTextbox(editor, corner_radius=10, height=55, wrap='word', state='disabled', undo=True)
value2.grid(row=3, column=0, columnspan=3, padx=25, sticky="ew")
#row3
property3 = ctk.CTkLabel(editor, text="Property 3", width=150, anchor="w")
property3.grid(row=4, column=0, padx=(40, 25), pady=(10,0), sticky="w")

value3 = ctk.CTkTextbox(editor, corner_radius=10, height=55, wrap='word', state='disabled', undo=True)
value3.grid(row=5, column=0, columnspan=3, padx=25, sticky="ew")
#row4
property4 = ctk.CTkLabel(editor, text="Property 4", width=150, anchor="w")
property4.grid(row=6, column=0, padx=(40, 25), pady=(10,0), sticky="w")

value4 = ctk.CTkTextbox(editor, corner_radius=10, height=55, wrap='word', state='disabled', undo=True)
value4.grid(row=7, column=0, columnspan=3, padx=25, sticky="ew")
#row5
property5 = ctk.CTkLabel(editor, text="Property 5", width=150, anchor="w")
property5.grid(row=8, column=0, padx=(40, 25), pady=(10,0), sticky="w")

value5 = ctk.CTkTextbox(editor, corner_radius=10, height=55, wrap='word', state='disabled', undo=True)
value5.grid(row=9, column=0, columnspan=3, padx=25, sticky="ew")
#row6
property6 = ctk.CTkLabel(editor, text="Property 6", width=150, anchor="w")
property6.grid(row=10, column=0, padx=(40, 25), pady=(10,0), sticky="w")

value6 = ctk.CTkTextbox(editor, corner_radius=10, height=55, wrap='word', state='disabled', undo=True)
value6.grid(row=11, column=0, columnspan=3, padx=25, pady=(0,20), sticky="ew")
#initialize editor with current state
populateEditor()
#endregion
#region Create right sidebar
sidebar2 = ctk.CTkFrame(app, corner_radius=0)
sidebar2.grid(row=0, column=2, rowspan=4, sticky="nsew")
sidebar2.grid_rowconfigure(1, weight=1)
sidebar2.columnconfigure(0, weight=1)

contextLabel2 = ctk.CTkLabel(sidebar2, text="Changed Items", font=ctk.CTkFont(size=14))
contextLabel2.grid(row=0, column=0, padx=20, pady=(10,0), sticky="nsew")

# changedItems = ctk.CTkTextbox(sidebar2, corner_radius=10, wrap='word', state='disabled')
# changedItems.grid(row=1, column=0, padx=20, pady=(5,10), sticky="nsew")
changedItems = ScrollableChangeListFrame(sidebar2, corner_radius=10)
changedItems.grid(row=1, column=0, padx=10, pady=(5,10), sticky="nsew")

breakingChangeCheckBox = ctk.CTkCheckBox(sidebar2, text="Breaking Change", hover=True, onvalue=True, offvalue=False, font=ctk.CTkFont(size=14, weight="bold"))
breakingChangeCheckBox.grid(row=2, column=0, padx=25, pady=10, sticky="EW")

submitButton = ctk.CTkButton(sidebar2, anchor='center', text="Commit Changes", font=ctk.CTkFont(weight="bold",size=20), cursor="hand2", command=submitChanges)
submitButton.grid(row=3, column=0, padx=25, pady=(0,20), sticky="EW")
#endregion

app.mainloop()
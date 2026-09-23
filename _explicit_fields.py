"""Extract only fields explicitly written in the supplied product descriptions."""
import re

_NUM = r"\d+(?:[.,]\d+)*(?:[-–]\d+(?:[.,]\d+)*)?"
_UNIT = r"(?:microgrammes?|micrograms?|milligrammes?|milligrams?|mg|mcg|µg|μg|ug|kg|g|mmol|meq|ppm|GBq|MBq|kBq|Bq|[KM][UI]|[UI]\.[IE]\.|IU|UI|IE|(?:SPEYWOOD\s+)?units?|U|%)"
_AMOUNT = rf"(?:\({_NUM}(?:\s*\+\s*{_NUM})+\)|{_NUM}(?:\s*\+\s*{_NUM})*)\s*{_UNIT}(?![A-Za-z])"
_DENOM = rf"(?:{_NUM}\s*)?(?:ml|g|kg|24\s*h|h|dose|tab|cap|vial|supp|syringe|PF\.SYR)(?![A-Za-z])"
_STRENGTH = re.compile(rf"{_AMOUNT}(?:\s*/\s*{_DENOM})?(?:\s*[+/]\s*{_AMOUNT}(?:\s*/\s*{_DENOM})?)*", re.I)


def explicit_strength(text):
    """First labelled dose, preserving combinations and denominators, not pack volume."""
    match = _STRENGTH.search(text or "")
    return match.group(0).strip() if match else ""


_EN_FORM = re.compile(
    r"\b(?:powder|concentrate|solution|suspension|emulsion|tablets?|capsules?|"
    r"film[- ]coated|gastro[- ]resistant|modified[- ]release|prolonged[- ]release|"
    r"hard capsules?|soft capsules?|oral drops|eye drops|ear drops|nasal|"
    r"cream|ointment|gel|syrup|suppositor(?:y|ies)|granules|lozenges?|"
    r"transdermal|cutaneous|effervescent|chewable|inhalation|orodispersible|"
    r"shampoo|injection|enema|gargle|mouthwash|surgical scrub|throat spray|"
    r"oromucosal spray|pessary|pessaries|elixir|liquid|spray|dental|medicated|"
    r"medicinal gas|rectal foam|oral lyophilisate|intrauterine delivery system|"
    r"liposomal dispersion|kit for radiopharmaceutical preparation|scalp lotion|"
    r"intravitreal implant|implant|radionuclide generator)\b", re.I)
_GR_FORM = re.compile(
    r"(?<!\S)(?:[A-Z]+(?:[./][A-Z]+)+|CAPS|TABLET|CREAM|SUPP)(?=\s+\(?\d)")


def explicit_form(name, country, package=""):
    if country == "CH":
        # This source explicitly places the dosage form after the comma.
        parts = re.split(r",\s*(?!\d)", name, maxsplit=1)
        if len(parts) == 2:
            return parts[1].strip()
        match = re.search(r"\b(?:Pulver|Injektionslösung|Infusionslösung|soluzione|Gouttes|Dragées|Kapseln|Gel|Tabletten|Filmtabletten|Salbe|Creme|Lösung)\b", name, re.I)
        if match:
            tail = name[match.start():]
            dose = _STRENGTH.search(tail)
            return (tail[:dose.start()] if dose else tail).strip()
        return ""
    if country == "GR":
        match = _GR_FORM.search(name)
        return match.group(0) if match else ""
    match = _EN_FORM.search(name)
    if match:
        tail = name[match.start():]
        dose = _STRENGTH.search(tail)
        if dose:
            tail = tail[:dose.start()]
        return tail.strip(" ,;-()")
    # A box/bottle/blister alone does not specify a pharmaceutical form.
    match = re.search(r"\b(?:TABLETS?|TABS|CAPSULES?|CAPS|SUPPOSITORIES|CREAM|OINTMENT|GEL)\b", package, re.I)
    return match.group(0) if match else ""

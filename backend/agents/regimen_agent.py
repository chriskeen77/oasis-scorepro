from typing import Dict

# Catalyst definitions — tier → (max_points, keyword_groups)
# Each group is a list of strings; matching ANY string in a group counts once.
CATALYST_TIERS = [
    {
        "tier": 1,
        "name": "Major Catalyst",
        "points": 35,
        "groups": [
            ["earnings beat", "beats earnings", "beats estimates", "beat estimates",
             "blowout earnings", "tops earnings", "crushing earnings"],
            ["fda approved", "fda approval", "fda clears", "fda clearance",
             "regulatory approval", "received approval", "anda approval"],
            ["merger", "acquisition", "acquired", "buyout", "takeover bid",
             "going private", "leveraged buyout", "lbo"],
            ["short squeeze", "gamma squeeze", "most shorted"],
        ],
    },
    {
        "tier": 2,
        "name": "Strong Catalyst",
        "points": 25,
        "groups": [
            ["contract win", "won contract", "contract awarded", "awarded contract",
             "selected for", "chosen for", "wins deal"],
            ["strategic partnership", "joint venture", "collaboration agreement",
             "licensing deal", "licensing agreement", "royalty agreement"],
            ["share buyback", "share repurchase", "buyback program", "stock buyback"],
            ["dividend increase", "raised dividend", "special dividend", "dividend boost"],
            ["analyst upgrade", "upgraded to buy", "price target raised",
             "initiated with buy", "initiated buy", "outperform rating",
             "overweight rating", "strong buy"],
            ["record revenue", "record sales", "record earnings", "record profit",
             "all-time high revenue", "highest revenue"],
        ],
    },
    {
        "tier": 3,
        "name": "Moderate Catalyst",
        "points": 15,
        "groups": [
            ["new product", "product launch", "launches new", "unveils",
             "introduces new", "new model"],
            ["expands into", "market expansion", "enters market", "new market",
             "opens new", "expansion plans"],
            ["raised guidance", "guidance raised", "increased outlook",
             "raised forecast", "boosts outlook", "upgraded guidance"],
            ["phase 3", "clinical trial", "positive results", "trial success",
             "promising data", "efficacy data"],
        ],
    },
]

# Volume-related keywords suggesting unusual trading activity
VOLUME_TIERS = [
    {
        "points": 20,
        "keywords": [
            "unusual volume", "unusually high volume", "volume spike", "most active",
            "highest volume", "record volume", "volume surge", "heavy volume",
        ],
    },
    {
        "points": 15,
        "keywords": [
            "heavy trading", "increased trading", "elevated volume",
            "strong trading", "actively traded", "high trading volume",
        ],
    },
    {
        "points": 10,
        "keywords": [
            "surges", "surge", "spikes", "rockets", "soars", "soar",
            "skyrockets", "explodes higher", "gaps up", "gap up",
        ],
    },
    {
        "points": 5,
        "keywords": [
            "rises", "rise", "climbs", "climbs higher", "gains", "jumps", "rallies",
        ],
    },
]


class RegimenAgent:
    def validate(self, item: Dict) -> Dict:
        text = item.get('full_text', '').lower()

        # --- Catalyst scoring ---
        catalyst_points = 0
        catalyst_name = "No Catalyst"
        catalyst_tier = 0
        matched_groups = []

        for tier_def in CATALYST_TIERS:
            tier_matched = []
            for group in tier_def["groups"]:
                for kw in group:
                    if kw in text:
                        tier_matched.append(group[0])  # record canonical name
                        break
            if tier_matched and tier_def["points"] > catalyst_points:
                catalyst_points = tier_def["points"]
                catalyst_name = tier_def["name"]
                catalyst_tier = tier_def["tier"]
                matched_groups = tier_matched

        # --- Volume signal scoring ---
        volume_points = 0
        volume_label = "No Volume Signal"
        for vtier in VOLUME_TIERS:
            for kw in vtier["keywords"]:
                if kw in text:
                    if vtier["points"] > volume_points:
                        volume_points = vtier["points"]
                        volume_label = kw
                    break

        passed = catalyst_tier > 0

        return {
            "passed": passed,
            "catalyst_points": catalyst_points,
            "catalyst_name": catalyst_name,
            "catalyst_tier": catalyst_tier,
            "matched_catalysts": matched_groups,
            "volume_points": volume_points,
            "volume_label": volume_label,
            "details": {
                "catalyst": catalyst_name,
                "tier": catalyst_tier,
                "catalysts_matched": matched_groups,
                "volume_signal": volume_label,
            },
        }

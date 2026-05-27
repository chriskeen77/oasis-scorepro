"""
Realistic demo news items used when live RSS feeds are unavailable
(e.g., cloud/datacenter IPs that are blocked by financial news sites).
When running locally, real RSS feeds take over automatically.
"""
import hashlib
import random
from datetime import datetime, timezone, timedelta
from typing import List, Dict

_HEADLINES = [
    # Tier-1 catalysts (earnings, FDA, M&A)
    {
        "title": "NVIDIA (NVDA) crushes Q1 earnings estimates; data center revenue hits record $22B",
        "source": "MarketWatch",
        "ticker": "NVDA",
        "keywords": "earnings beat record revenue unusual volume",
    },
    {
        "title": "Pfizer $PFE receives FDA approval for breakthrough oncology drug; shares surge",
        "source": "Reuters",
        "ticker": "PFE",
        "keywords": "fda approved surge unusual volume",
    },
    {
        "title": "Microsoft (MSFT) to acquire cybersecurity firm in $6.9B deal; most active pre-market",
        "source": "CNBC",
        "ticker": "MSFT",
        "keywords": "acquisition merger unusually high volume",
    },
    {
        "title": "AMD beats earnings estimates, raises full-year guidance on AI chip demand",
        "source": "Yahoo Finance",
        "ticker": "AMD",
        "keywords": "beats earnings raised guidance strong earnings",
    },
    {
        "title": "Short squeeze alert: GME most active on surging volume as options market heats up",
        "source": "Benzinga",
        "ticker": "GME",
        "keywords": "short squeeze most active surge volume spike",
    },
    {
        "title": "Eli Lilly (LLY) FDA clears new obesity drug; stock soars on blowout trial results",
        "source": "BioPharma Dive",
        "ticker": "LLY",
        "keywords": "fda clears soars blowout record",
    },
    # Tier-2 catalysts (contracts, upgrades, dividends, buybacks)
    {
        "title": "Palantir (PLTR) wins $500M U.S. Army AI contract; upgraded to Buy at Goldman",
        "source": "Bloomberg",
        "ticker": "PLTR",
        "keywords": "contract win analyst upgrade buy rating",
    },
    {
        "title": "Apple (AAPL) announces $90B share buyback program, dividend increase of 4%",
        "source": "CNBC",
        "ticker": "AAPL",
        "keywords": "share buyback dividend increase",
    },
    {
        "title": "Meta (META) initiated with Buy at JPMorgan; price target raised to $620",
        "source": "Seeking Alpha",
        "ticker": "META",
        "keywords": "initiated buy price target raised outperform",
    },
    {
        "title": "Tesla (TSLA) awarded $2B federal EV charging contract; jumps 8% on heavy volume",
        "source": "Reuters",
        "ticker": "TSLA",
        "keywords": "contract awarded jumps heavy volume",
    },
    # Tier-3 catalysts (new products, expansion, guidance)
    {
        "title": "Amazon AWS launches new AI inference chip, enters market with aggressive pricing",
        "source": "TechCrunch",
        "ticker": "AMZN",
        "keywords": "new product launches enters market",
    },
    {
        "title": "CrowdStrike (CRWD) raises full-year guidance above consensus on record ARR growth",
        "source": "MarketWatch",
        "ticker": "CRWD",
        "keywords": "raises guidance record",
    },
    {
        "title": "Costco (COST) reports record same-store sales growth of 9.2%; stock climbs",
        "source": "Wall Street Journal",
        "ticker": "COST",
        "keywords": "record revenue climbs",
    },
    # Mixed / lower-signal items
    {
        "title": "Federal Reserve holds rates steady; markets mixed as inflation data awaited",
        "source": "Reuters",
        "ticker": "",
        "keywords": "holds steady mixed",
    },
    {
        "title": "Oil prices drop 2% on demand concerns; energy stocks under pressure",
        "source": "CNBC",
        "ticker": "XOM",
        "keywords": "drops pressure weak",
    },
    {
        "title": "Bank of America (BAC) misses Q2 revenue estimates; loan growth disappoints",
        "source": "Bloomberg",
        "ticker": "BAC",
        "keywords": "misses disappointing below expectations",
    },
    {
        "title": "Moderna (MRNA) reports positive Phase 3 data for combination vaccine trial",
        "source": "BioPharma Dive",
        "ticker": "MRNA",
        "keywords": "phase 3 positive results promising data",
    },
    {
        "title": "Intel (INTC) restructuring plan cuts 15,000 jobs; guidance lowered",
        "source": "WSJ",
        "ticker": "INTC",
        "keywords": "layoffs guidance cut restructuring",
    },
    {
        "title": "Coinbase (COIN) volumes surge on crypto rally; most active session in months",
        "source": "CoinDesk",
        "ticker": "COIN",
        "keywords": "surge most active volumes",
    },
    {
        "title": "Snowflake (SNOW) beats Q3 estimates on product revenue; expands into APAC markets",
        "source": "Seeking Alpha",
        "ticker": "SNOW",
        "keywords": "beats earnings expansion enters market",
    },
]


def _make_item(template: Dict, age_minutes: int) -> Dict:
    pub = datetime.now(timezone.utc) - timedelta(minutes=age_minutes)
    text = f"{template['title']} {template['keywords']}"
    item_id = hashlib.md5(f"{template['title']}demo".encode()).hexdigest()[:12]
    return {
        "id": item_id,
        "title": template["title"],
        "summary": template["keywords"],
        "full_text": text,
        "source": template["source"],
        "url": "#",
        "published": pub.isoformat(),
        "ticker": template["ticker"],
    }


def generate_demo_items() -> List[Dict]:
    """Return demo items with staggered publish times so recency scoring varies."""
    ages = [3, 8, 15, 25, 40, 60, 90, 120, 180, 240, 300, 360, 420, 480, 540, 600, 660, 720, 840, 960]
    random.shuffle(ages)
    items = []
    for i, template in enumerate(_HEADLINES):
        age = ages[i % len(ages)]
        items.append(_make_item(template, age))
    return items

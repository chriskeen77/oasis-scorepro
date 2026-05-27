from datetime import datetime, timezone
from typing import Dict
from dateutil import parser as dateparser


# Score weights (must sum to 100)
# Sentiment:    30
# Catalyst:     35
# Volume:       20
# Ticker ID:    10
# Recency:       5


def _recency_score(published_iso: str) -> float:
    try:
        pub = dateparser.parse(published_iso)
        if pub.tzinfo is None:
            pub = pub.replace(tzinfo=timezone.utc)
        age_hours = (datetime.now(timezone.utc) - pub).total_seconds() / 3600
        if age_hours <= 0.5:
            return 5.0
        elif age_hours <= 1.0:
            return 4.0
        elif age_hours <= 2.0:
            return 3.0
        elif age_hours <= 4.0:
            return 2.0
        elif age_hours <= 12.0:
            return 1.0
        return 0.0
    except Exception:
        return 1.0


def _ticker_id_score(ticker: str) -> float:
    if not ticker:
        return 0.0
    if 1 <= len(ticker) <= 5:
        return 10.0
    return 5.0


class ConfidenceEngine:
    def calculate(self, item: Dict, sentiment_score: float, regimen_result: Dict) -> Dict:
        sentiment = round(sentiment_score, 1)                         # 0–30
        catalyst = round(float(regimen_result["catalyst_points"]), 1) # 0–35
        volume = round(float(regimen_result["volume_points"]), 1)     # 0–20
        ticker_id = round(_ticker_id_score(item.get("ticker", "")), 1) # 0–10
        recency = round(_recency_score(item.get("published", "")), 1)  # 0–5

        total = round(sentiment + catalyst + volume + ticker_id + recency, 1)
        total = min(100.0, max(0.0, total))

        return {
            "total": total,
            "breakdown": {
                "sentiment": sentiment,
                "catalyst": catalyst,
                "volume_signal": volume,
                "ticker_id": ticker_id,
                "recency": recency,
                "total": total,
            },
        }

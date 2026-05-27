from typing import Dict

# Weighted keyword sets for sentiment scoring
STRONG_POSITIVE = {
    'beats', 'beat', 'exceeds', 'exceeded', 'surges', 'surged', 'soars', 'soared',
    'skyrockets', 'rockets', 'blowout', 'crushes', 'crush', 'record high',
    'all-time high', 'record revenue', 'record earnings', 'record sales',
    'approved', 'approval', 'clears', 'cleared', 'acquired', 'merger approved',
    'upgraded to buy', 'raised price target', 'blew past', 'tops estimates',
    'smashes', 'smashed', 'explosive', 'breakout', 'blockbuster',
}
STRONG_POSITIVE_WEIGHT = 3

POSITIVE = {
    'gains', 'gain', 'rises', 'rise', 'climbs', 'climb', 'jumps', 'jump',
    'increases', 'increase', 'grows', 'growth', 'higher', 'up', 'strong',
    'strong earnings', 'above expectations', 'raised guidance', 'partnership',
    'contract', 'won', 'selected', 'dividend', 'buyback', 'repurchase',
    'upgrade', 'upgrades', 'outperform', 'overweight', 'bullish', 'positive',
    'profit', 'profitability', 'expansion', 'launch', 'launches', 'opens',
    'deal', 'agreement', 'licenses', 'royalty', 'award', 'awarded',
}
POSITIVE_WEIGHT = 2

WEAK_POSITIVE = {
    'good', 'favorable', 'confident', 'optimistic', 'potential', 'opportunity',
    'promising', 'solid', 'robust', 'healthy', 'steady', 'stable',
}
WEAK_POSITIVE_WEIGHT = 1

NEGATIVE = {
    'misses', 'missed', 'miss', 'falls', 'fall', 'drops', 'drop', 'plunges',
    'plunge', 'tumbles', 'tumble', 'crashes', 'crash', 'slides', 'slide',
    'below expectations', 'disappointing', 'weak', 'shortfall', 'loss',
    'losses', 'downgraded', 'downgrade', 'cut to sell', 'lowered target',
    'cut price', 'restructuring', 'layoffs', 'layoff', 'cuts jobs', 'job cuts',
}
NEGATIVE_WEIGHT = -2

STRONG_NEGATIVE = {
    'bankruptcy', 'bankrupt', 'investigation', 'sec probe', 'fraud', 'lawsuit',
    'recall', 'guidance cut', 'disaster', 'catastrophic', 'criminal', 'charges',
    'delisted', 'delist', 'shutdown', 'halted', 'suspended', 'collapse',
}
STRONG_NEGATIVE_WEIGHT = -3


class SentimentAgent:
    def score(self, item: Dict) -> float:
        text = item.get('full_text', '').lower()
        raw = 0.0

        for kw in STRONG_POSITIVE:
            if kw in text:
                raw += STRONG_POSITIVE_WEIGHT
        for kw in POSITIVE:
            if kw in text:
                raw += POSITIVE_WEIGHT
        for kw in WEAK_POSITIVE:
            if kw in text:
                raw += WEAK_POSITIVE_WEIGHT
        for kw in NEGATIVE:
            if kw in text:
                raw += NEGATIVE_WEIGHT
        for kw in STRONG_NEGATIVE:
            if kw in text:
                raw += STRONG_NEGATIVE_WEIGHT

        # Clamp to range and normalize to 0-30
        clamped = max(-10.0, min(10.0, raw))
        normalized = ((clamped + 10) / 20) * 30
        return round(normalized, 1)

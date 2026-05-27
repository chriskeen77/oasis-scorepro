from pydantic import BaseModel
from typing import Optional, Dict, List


class ScoreBreakdown(BaseModel):
    sentiment: float
    catalyst: float
    volume_signal: float
    ticker_id: float
    recency: float
    total: float


class NewsItem(BaseModel):
    id: str
    title: str
    source: str
    url: str
    published: str
    ticker: str
    sentiment_score: float
    regimen_passed: bool
    regimen_details: Dict
    confidence_score: float
    score_breakdown: ScoreBreakdown
    is_alert: bool


class AlertItem(BaseModel):
    news_item: NewsItem
    triggered_at: str
    threshold_at_trigger: int


class Settings(BaseModel):
    alert_threshold: int = 80
    refresh_interval: int = 300
    max_items: int = 60

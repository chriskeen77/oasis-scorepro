import asyncio
import logging
from datetime import datetime, timezone
from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from agents.news_fetcher import NewsFetcher, RSS_FEEDS
from agents.sentiment_agent import SentimentAgent
from agents.regimen_agent import RegimenAgent
from agents.confidence_engine import ConfidenceEngine
from agents.demo_data import generate_demo_items
from models import NewsItem, AlertItem, Settings, ScoreBreakdown

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

app = FastAPI(title="OASIS ScorePro API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Singletons ──────────────────────────────────────────────────────────────
fetcher = NewsFetcher()
sentiment_agent = SentimentAgent()
regimen_agent = RegimenAgent()
confidence_engine = ConfidenceEngine()

# ── Shared state ────────────────────────────────────────────────────────────
news_cache: List[NewsItem] = []
alerts_cache: List[AlertItem] = []
last_refresh: str = ""
settings = Settings()

# ── Agent stats for the UI ───────────────────────────────────────────────────
agent_stats = {
    "news_fetcher": {"status": "idle", "processed": 0, "feeds": len(RSS_FEEDS)},
    "sentiment": {"status": "idle", "positive": 0, "negative": 0, "neutral": 0},
    "regimen": {"status": "idle", "passed": 0, "failed": 0},
}


async def run_pipeline() -> None:
    global news_cache, alerts_cache, last_refresh, agent_stats

    log.info("Pipeline: fetching RSS feeds …")
    agent_stats["news_fetcher"]["status"] = "fetching"
    raw_items = await fetcher.fetch_all()
    agent_stats["news_fetcher"]["status"] = "idle"
    agent_stats["news_fetcher"]["processed"] = len(raw_items)

    if not raw_items:
        log.warning("Pipeline: no live feeds returned items — using demo data")
        raw_items = generate_demo_items()

    processed: List[NewsItem] = []
    new_alerts: List[AlertItem] = []
    existing_alert_ids = {a.news_item.id for a in alerts_cache}

    s_pos = s_neg = s_neu = r_pass = r_fail = 0

    agent_stats["sentiment"]["status"] = "scoring"
    agent_stats["regimen"]["status"] = "validating"

    for item in raw_items:
        sent_score = sentiment_agent.score(item)
        reg_result = regimen_agent.validate(item)
        conf = confidence_engine.calculate(item, sent_score, reg_result)

        if sent_score > 17:
            s_pos += 1
        elif sent_score < 10:
            s_neg += 1
        else:
            s_neu += 1

        if reg_result["passed"]:
            r_pass += 1
        else:
            r_fail += 1

        news_item = NewsItem(
            id=item["id"],
            title=item["title"],
            source=item["source"],
            url=item["url"],
            published=item["published"],
            ticker=item.get("ticker", ""),
            sentiment_score=sent_score,
            regimen_passed=reg_result["passed"],
            regimen_details=reg_result["details"],
            confidence_score=conf["total"],
            score_breakdown=ScoreBreakdown(**conf["breakdown"]),
            is_alert=conf["total"] >= settings.alert_threshold,
        )
        processed.append(news_item)

        if news_item.is_alert and news_item.id not in existing_alert_ids:
            new_alerts.append(AlertItem(
                news_item=news_item,
                triggered_at=datetime.now(timezone.utc).isoformat(),
                threshold_at_trigger=settings.alert_threshold,
            ))

    agent_stats["sentiment"].update({"status": "idle", "positive": s_pos, "negative": s_neg, "neutral": s_neu})
    agent_stats["regimen"].update({"status": "idle", "passed": r_pass, "failed": r_fail})

    processed.sort(key=lambda x: x.confidence_score, reverse=True)
    news_cache = processed[: settings.max_items]

    alerts_cache = new_alerts + alerts_cache
    alerts_cache = alerts_cache[:30]

    last_refresh = datetime.now(timezone.utc).isoformat()
    log.info(f"Pipeline done: {len(processed)} items, {len(new_alerts)} new alerts")


async def periodic_refresh() -> None:
    while True:
        await asyncio.sleep(settings.refresh_interval)
        try:
            await run_pipeline()
        except Exception as exc:
            log.error(f"Pipeline error: {exc}")


@app.on_event("startup")
async def on_startup() -> None:
    try:
        await run_pipeline()
    except Exception as exc:
        log.error(f"Startup pipeline error: {exc}")
    asyncio.create_task(periodic_refresh())


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "news_count": len(news_cache),
        "alert_count": len(alerts_cache),
        "last_refresh": last_refresh,
    }


@app.get("/api/news")
async def get_news():
    return {
        "items": [i.model_dump() for i in news_cache],
        "last_updated": last_refresh,
        "count": len(news_cache),
    }


@app.get("/api/alerts")
async def get_alerts():
    return {
        "alerts": [a.model_dump() for a in alerts_cache],
        "count": len(alerts_cache),
    }


@app.get("/api/agents")
async def get_agent_stats():
    return agent_stats


@app.get("/api/settings")
async def get_settings():
    return settings.model_dump()


@app.post("/api/settings")
async def update_settings(new_settings: Settings):
    global settings
    settings = new_settings
    return settings.model_dump()


@app.post("/api/refresh")
async def manual_refresh():
    await run_pipeline()
    return {"status": "ok", "count": len(news_cache), "last_updated": last_refresh}

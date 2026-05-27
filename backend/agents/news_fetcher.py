import asyncio
import hashlib
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Dict, List, Optional
from email.utils import parsedate_to_datetime

import httpx
from dateutil import parser as dateparser

RSS_FEEDS = [
    {"url": "https://finance.yahoo.com/news/rssindex", "source": "Yahoo Finance"},
    {"url": "https://www.cnbc.com/id/100003114/device/rss/rss.html", "source": "CNBC"},
    {"url": "https://www.cnbc.com/id/20910258/device/rss/rss.html", "source": "CNBC Markets"},
    {"url": "https://www.cnbc.com/id/15839135/device/rss/rss.html", "source": "CNBC Investing"},
    {"url": "https://feeds.marketwatch.com/marketwatch/topstories/", "source": "MarketWatch"},
    {"url": "https://feeds.marketwatch.com/marketwatch/marketpulse/", "source": "MarketWatch Pulse"},
    {"url": "https://seekingalpha.com/market_currents.xml", "source": "Seeking Alpha"},
]

TICKER_PATTERNS = [
    re.compile(r'\$([A-Z]{1,5})\b'),
    re.compile(r'\(([A-Z]{2,5})\)'),
    re.compile(r'(?:NYSE|NASDAQ|Nasdaq|AMEX):\s*([A-Z]{1,5})'),
]

COMPANY_TO_TICKER: Dict[str, str] = {
    'apple': 'AAPL', 'microsoft': 'MSFT', 'nvidia': 'NVDA', 'amazon': 'AMZN',
    'alphabet': 'GOOGL', 'google': 'GOOGL', 'meta platforms': 'META',
    'meta': 'META', 'facebook': 'META', 'tesla': 'TSLA', 'jpmorgan': 'JPM',
    'jp morgan': 'JPM', 'exxon': 'XOM', 'broadcom': 'AVGO',
    'unitedhealth': 'UNH', 'eli lilly': 'LLY', 'visa': 'V',
    'mastercard': 'MA', 'johnson & johnson': 'JNJ', 'walmart': 'WMT',
    'pfizer': 'PFE', 'procter & gamble': 'PG', 'abbvie': 'ABBV',
    'chevron': 'CVX', 'merck': 'MRK', 'costco': 'COST', 'netflix': 'NFLX',
    'adobe': 'ADBE', 'salesforce': 'CRM', 'amd': 'AMD',
    'advanced micro devices': 'AMD', 'intel': 'INTC', 'qualcomm': 'QCOM',
    'comcast': 'CMCSA', 'boeing': 'BA', 'ibm': 'IBM', 'caterpillar': 'CAT',
    "mcdonald's": 'MCD', 'mcdonalds': 'MCD', 'honeywell': 'HON',
    'bank of america': 'BAC', 'wells fargo': 'WFC', 'citigroup': 'C',
    'morgan stanley': 'MS', 'goldman sachs': 'GS', 'amgen': 'AMGN',
    'gilead': 'GILD', 'biogen': 'BIIB', 'moderna': 'MRNA',
    'biontech': 'BNTX', 'palantir': 'PLTR', 'snowflake': 'SNOW',
    'shopify': 'SHOP', 'block': 'SQ', 'paypal': 'PYPL', 'uber': 'UBER',
    'lyft': 'LYFT', 'airbnb': 'ABNB', 'doordash': 'DASH', 'coinbase': 'COIN',
    'robinhood': 'HOOD', 'rivian': 'RIVN', 'lucid': 'LCID', 'nio': 'NIO',
    'alibaba': 'BABA', 'baidu': 'BIDU', 'disney': 'DIS', 'at&t': 'T',
    'verizon': 'VZ', 't-mobile': 'TMUS', 'astrazeneca': 'AZN',
    'novo nordisk': 'NVO', 'novartis': 'NVS', 'arm holdings': 'ARM',
    'arm': 'ARM', 'marvell': 'MRVL', 'micron': 'MU', 'western digital': 'WDC',
    'seagate': 'STX', 'lam research': 'LRCX', 'applied materials': 'AMAT',
    'asml': 'ASML', 'taiwan semiconductor': 'TSM', 'tsmc': 'TSM',
    'crowdstrike': 'CRWD', 'palo alto': 'PANW', 'fortinet': 'FTNT',
    'datadog': 'DDOG', 'mongodb': 'MDB', 'cloudflare': 'NET',
    'zscaler': 'ZS', 'okta': 'OKTA', 'twilio': 'TWLO',
    'instacart': 'CART', 'reddit': 'RDDT', 'berkshire hathaway': 'BRK.B',
    'berkshire': 'BRK.B', 'general electric': 'GE', 'ge': 'GE',
    'general motors': 'GM', 'gm': 'GM', 'ford': 'F',
    'lockheed martin': 'LMT', 'raytheon': 'RTX', 'northrop grumman': 'NOC',
    'united parcel service': 'UPS', 'ups': 'UPS', 'fedex': 'FDX',
    'deere': 'DE', 'john deere': 'DE', 'abbott': 'ABT', 'medtronic': 'MDT',
    'thermo fisher': 'TMO', 'danaher': 'DHR', 'illumina': 'ILMN',
    'vertex pharmaceuticals': 'VRTX', 'vertex': 'VRTX',
    'regeneron': 'REGN', 'bristol-myers': 'BMY', 'bristol myers': 'BMY',
    'starbucks': 'SBUX', 'nike': 'NKE', 'colgate': 'CL', '3m': 'MMM',
}

TICKER_BLACKLIST = {
    'A', 'I', 'AM', 'AS', 'AT', 'BE', 'BY', 'DO', 'GO', 'HE', 'IF', 'IN',
    'IS', 'IT', 'ME', 'MY', 'NO', 'OF', 'ON', 'OR', 'SO', 'TO', 'UP', 'US',
    'WE', 'AN', 'ARE', 'CAN', 'FOR', 'HAS', 'HAD', 'HIS', 'HOW', 'ITS',
    'MAY', 'NEW', 'NOT', 'NOW', 'OLD', 'ONE', 'OUR', 'OUT', 'SAY', 'SHE',
    'THE', 'TOO', 'TWO', 'USE', 'WAS', 'WHO', 'WHY', 'YOU', 'AND', 'BUT',
    'CEO', 'CFO', 'COO', 'CTO', 'IPO', 'ETF', 'IRS', 'SEC', 'FDA', 'DOJ',
    'FTC', 'FED', 'GDP', 'CPI', 'PPI', 'EPS', 'YOY', 'QOQ', 'TTM', 'ATH',
    'ATL', 'EOD', 'EOW', 'YTD', 'MTD', 'QTD', 'USD', 'EUR', 'GBP', 'JPY',
    'ETH', 'BTC', 'NFT', 'ESG', 'AI', 'ML', 'AR', 'VR', 'EV', 'RE',
    'DOWN', 'HIGH', 'LOW', 'BUY', 'SELL', 'HOLD', 'LONG', 'SHORT', 'CASH',
    'DEBT', 'LOAN', 'BOND', 'NOTE', 'BILL', 'FUND', 'RATE', 'COST', 'LOSS',
    'GAIN', 'RISE', 'FALL', 'JUMP', 'DROP', 'WARN', 'BEAT', 'MISS', 'NEWS',
    'WALL', 'STREET', 'MARKET', 'STOCK', 'TRADE', 'SAYS', 'SETS', 'SEES',
    'TOPS', 'HITS', 'CUTS', 'ADDS', 'GETS', 'EYES', 'AXES',
}


def extract_ticker(text: str) -> str:
    for pattern in TICKER_PATTERNS:
        match = pattern.search(text)
        if match:
            candidate = match.group(1).upper()
            if candidate not in TICKER_BLACKLIST:
                return candidate

    text_lower = text.lower()
    for company, ticker in sorted(COMPANY_TO_TICKER.items(), key=lambda x: -len(x[0])):
        if company in text_lower:
            return ticker

    words = re.findall(r'\b[A-Z]{2,5}\b', text)
    for word in words:
        if word not in TICKER_BLACKLIST:
            return word

    return ''


def _strip_tags(text: str) -> str:
    return re.sub(r'<[^>]+>', '', text or '').strip()


def _parse_date(raw: Optional[str]) -> str:
    if not raw:
        return datetime.now(timezone.utc).isoformat()
    try:
        return parsedate_to_datetime(raw).isoformat()
    except Exception:
        pass
    try:
        return dateparser.parse(raw).isoformat()
    except Exception:
        pass
    return datetime.now(timezone.utc).isoformat()


def _xml_text(el: ET.Element, tag: str, ns: str = '') -> str:
    child = el.find(f'{ns}{tag}')
    return child.text or '' if child is not None and child.text else ''


def _parse_rss(xml_text: str, source: str) -> List[Dict]:
    items = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return items

    # Handle both RSS 2.0 (<rss><channel><item>) and Atom (<feed><entry>)
    ns_atom = '{http://www.w3.org/2005/Atom}'
    entries = root.findall('.//item') or root.findall(f'.//{ns_atom}entry')

    for entry in entries[:20]:
        title = _strip_tags(
            _xml_text(entry, 'title') or
            _xml_text(entry, f'{ns_atom}title')
        )
        link = (
            _xml_text(entry, 'link') or
            (entry.find(f'{ns_atom}link') or entry).get('href', '')
        )
        summary = _strip_tags(
            _xml_text(entry, 'description') or
            _xml_text(entry, f'{ns_atom}summary') or
            _xml_text(entry, f'{ns_atom}content')
        )
        pub_raw = (
            _xml_text(entry, 'pubDate') or
            _xml_text(entry, f'{ns_atom}published') or
            _xml_text(entry, f'{ns_atom}updated')
        )

        if not title:
            continue

        item_id = hashlib.md5(f'{title}{link}'.encode()).hexdigest()[:12]
        full_text = f'{title} {summary}'

        items.append({
            'id': item_id,
            'title': title,
            'summary': summary,
            'full_text': full_text,
            'source': source,
            'url': link,
            'published': _parse_date(pub_raw),
            'ticker': extract_ticker(full_text),
        })

    return items


HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; OasisScorePro/1.0; +https://github.com)',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
}


class NewsFetcher:
    async def _fetch_feed(self, client: httpx.AsyncClient, config: Dict) -> List[Dict]:
        try:
            resp = await client.get(config['url'], headers=HEADERS, timeout=10.0, follow_redirects=True)
            resp.raise_for_status()
            return _parse_rss(resp.text, config['source'])
        except Exception:
            return []

    async def fetch_all(self) -> List[Dict]:
        async with httpx.AsyncClient() as client:
            results = await asyncio.gather(
                *[self._fetch_feed(client, cfg) for cfg in RSS_FEEDS],
                return_exceptions=True,
            )

        seen: set = set()
        items: List[Dict] = []
        for batch in results:
            if isinstance(batch, list):
                for item in batch:
                    if item['id'] not in seen:
                        seen.add(item['id'])
                        items.append(item)

        return items

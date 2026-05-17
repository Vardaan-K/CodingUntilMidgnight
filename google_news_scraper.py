"""
Google News Scraper - fetches recent news articles mentioning a business
Uses Google News RSS feed (completely free, no API key required)
"""

import requests
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Dict, Optional
from urllib.parse import quote_plus


HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
RSS_URL = "https://news.google.com/rss/search"


def _parse_pubdate(date_str: Optional[str]) -> Optional[str]:
    if not date_str:
        return None
    try:
        dt = datetime.strptime(date_str, "%a, %d %b %Y %H:%M:%S %Z")
        return dt.isoformat()
    except ValueError:
        return date_str


def search_google_news(business_name: str, location: str = "", max_results: int = 20) -> Dict:
    """
    Search Google News RSS for recent articles mentioning the business.

    Args:
        business_name: Name of the business
        location: Optional city/state to narrow search
        max_results: Maximum number of articles to return

    Returns:
        Dictionary with articles list and metadata
    """
    query = f'"{business_name}"'
    if location:
        query += f" {location}"

    encoded = quote_plus(query)
    url = f"{RSS_URL}?q={encoded}&hl=en-US&gl=US&ceid=US:en"

    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        response.raise_for_status()

        root = ET.fromstring(response.content)
        channel = root.find("channel")

        if channel is None:
            return {
                "source": "google_news",
                "business_name": business_name,
                "query": query,
                "total_results": 0,
                "articles": [],
            }

        articles = []
        for item in channel.findall("item")[:max_results]:
            source_elem = item.find("source")
            articles.append({
                "title": item.findtext("title"),
                "description": item.findtext("description"),
                "source": source_elem.text if source_elem is not None else None,
                "url": item.findtext("link"),
                "published_at": _parse_pubdate(item.findtext("pubDate")),
            })

        return {
            "source": "google_news",
            "business_name": business_name,
            "query": query,
            "total_results": len(articles),
            "articles": articles,
        }

    except ET.ParseError as e:
        print(f"[Google News] XML parse error: {e}")
        return {"source": "google_news", "business_name": business_name, "error": str(e), "articles": []}
    except requests.exceptions.RequestException as e:
        print(f"[Google News] Request error: {e}")
        return {"source": "google_news", "business_name": business_name, "error": str(e), "articles": []}


def main():
    import json
    result = search_google_news("Starbucks", "New York")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

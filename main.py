"""
Business Data Aggregator - Main Entry Point

Runs all 5 scrapers concurrently and aggregates the results into a single JSON file.

Usage:
    python main.py "Business Name"
    python main.py "Business Name" "City, State"
    python main.py "Business Name" "10001"

Required environment variables (set only the sources you want active):
    GOOGLE_PLACES_API_KEY   - Google Places API key (for Google Reviews)
    TRIPADVISOR_API_KEY     - TripAdvisor Content API key — https://www.tripadvisor.com/developers
    TWITTER_BEARER_TOKEN    - Twitter API v2 Bearer token (Basic plan required for search)

No key needed for:
    Reddit       - uses public JSON API
    Google News  - uses free RSS feed
"""

import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Dict

from tripadvisor_scraper import get_tripadvisor_data
from google_news_scraper import search_google_news
from google_reviews_scraper import get_google_reviews_data


def aggregate_business_data(business_name: str, location: str = "") -> Dict:
    """
    Run all scrapers concurrently and aggregate results.

    Args:
        business_name: Name of the business to research
        location: ZIP code or city/state (improves accuracy for location-based sources)

    Returns:
        Combined data from all sources as a single dictionary
    """
    scrapers = {
        "tripadvisor": lambda: get_tripadvisor_data(business_name, location),
        "google_news": lambda: search_google_news(business_name, location),
        "google_reviews": lambda: get_google_reviews_data(business_name, location),
    }

    result: Dict = {
        "business_name": business_name,
        "location": location,
        "timestamp": datetime.now().isoformat(),
        "tripadvisor": None,
        "google_news": None,
        "google_reviews": None,
    }

    print(f"\n{'=' * 60}")
    print(f"  Aggregating data for: {business_name}")
    if location:
        print(f"  Location: {location}")
    print(f"{'=' * 60}\n")

    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {executor.submit(fn): name for name, fn in scrapers.items()}
        for future in as_completed(futures):
            name = futures[future]
            try:
                data = future.result()
                result[name] = data
                if data.get("error"):
                    print(f"  [WARN] {name}: {data['error']}")
                else:
                    count = _count_items(name, data)
                    print(f"  [OK]   {name}: {count}")
            except Exception as e:
                result[name] = {"source": name, "error": str(e)}
                print(f"  [ERR]  {name}: {e}")

    return result


def _count_items(source: str, data: Dict) -> str:
    count_keys = {
        "reddit": ("posts", "post"),
        "twitter": ("tweets", "tweet"),
        "tripadvisor": ("reviews", "review"),
        "google_news": ("articles", "article"),
        "google_reviews": ("reviews", "review"),
    }
    key, label = count_keys.get(source, ("items", "item"))
    n = len(data.get(key, []))
    suffix = "s" if n != 1 else ""
    extra = ""
    if source in ("tripadvisor", "google_reviews") and data.get("rating"):
        extra = f" | rating: {data['rating']}/5 ({data.get('total_reviews', '?')} total)"
    return f"{n} {label}{suffix}{extra}"


def _print_summary(result: Dict) -> None:
    print(f"\n{'=' * 60}")
    print("  SUMMARY")
    print(f"{'=' * 60}")

    sources = ["tripadvisor", "google_news", "google_reviews"]
    for src in sources:
        data = result.get(src) or {}
        if data.get("error"):
            print(f"  {src:<16} ERROR: {data['error'][:60]}")
        else:
            print(f"  {src:<16} {_count_items(src, data)}")

    print(f"{'=' * 60}\n")


def main():
    if len(sys.argv) < 2:
        print("Usage: python main.py \"Business Name\" [\"Location\"]")
        print("Example: python main.py \"Starbucks\" \"New York, NY\"")
        sys.exit(1)

    business_name = sys.argv[1]
    location = sys.argv[2] if len(sys.argv) > 2 else ""

    data = aggregate_business_data(business_name, location)

    _print_summary(data)

    safe_name = "".join(c if c.isalnum() or c in " -_" else "_" for c in business_name).strip()
    output_file = f"{safe_name.replace(' ', '_')}_data.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"  Data saved to: {output_file}\n")


if __name__ == "__main__":
    main()

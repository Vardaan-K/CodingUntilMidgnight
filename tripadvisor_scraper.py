"""
TripAdvisor Content API client for business search and reviews.

Set TRIPADVISOR_API_KEY env var with your key from:
  https://www.tripadvisor.com/developers
"""

import os
import requests
from difflib import SequenceMatcher
from typing import Dict, List, Optional

BASE_URL = "https://api.content.tripadvisor.com/api/v1"
_REVIEW_PAGE_SIZE = 5  # Content API returns up to 5 reviews per request


def _key() -> str:
    k = os.environ.get("TRIPADVISOR_API_KEY", "")
    if not k:
        raise EnvironmentError("TRIPADVISOR_API_KEY env var not set")
    return k


def _search_locations(name: str, location: str) -> List[Dict]:
    query = f"{name} {location}".strip() if location else name
    params = {
        "key": _key(),
        "searchQuery": query,
        "language": "en",
    }
    resp = requests.get(f"{BASE_URL}/location/search", params=params, timeout=10)
    resp.raise_for_status()
    return resp.json().get("data", [])


def _best_match(candidates: List[Dict], query: str) -> Optional[Dict]:
    if not candidates:
        return None
    query_lower = query.lower()

    def score(loc: Dict) -> float:
        name = (loc.get("name") or "").lower()
        s = SequenceMatcher(None, query_lower, name).ratio()
        if query_lower in name or name in query_lower:
            s = max(s, 0.6)
        return s

    best = max(candidates, key=score)
    return best if score(best) >= 0.4 else None


def _fetch_details(location_id: str) -> Dict:
    params = {"key": _key(), "language": "en"}
    resp = requests.get(f"{BASE_URL}/location/{location_id}/details", params=params, timeout=10)
    resp.raise_for_status()
    return resp.json()


def _fetch_reviews(location_id: str, max_reviews: int = 20) -> List[Dict]:
    reviews: List[Dict] = []
    offset = 0
    while len(reviews) < max_reviews:
        params = {"key": _key(), "language": "en", "offset": offset}
        resp = requests.get(
            f"{BASE_URL}/location/{location_id}/reviews",
            params=params,
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        page = data.get("data", [])
        if not page:
            break
        reviews.extend(page)
        offset += len(page)
        if len(page) < _REVIEW_PAGE_SIZE:
            break
    return reviews[:max_reviews]


def get_tripadvisor_data(business_name: str, location: str = "") -> Dict:
    """Search TripAdvisor via Content API and return reviews + business info."""
    try:
        candidates = _search_locations(business_name, location)
    except Exception as e:
        return {"source": "tripadvisor", "error": f"TripAdvisor search failed: {e}"}

    loc = _best_match(candidates, business_name)
    if not loc:
        return {"source": "tripadvisor", "error": f"No close TripAdvisor match for '{business_name}'"}

    location_id = loc["location_id"]

    try:
        details = _fetch_details(location_id)
    except Exception as e:
        return {"source": "tripadvisor", "error": f"TripAdvisor details fetch failed: {e}"}

    review_error = None
    try:
        raw_reviews = _fetch_reviews(location_id, max_reviews=20)
    except Exception as e:
        raw_reviews = []
        review_error = str(e)

    reviews = [
        {
            "text": r.get("text"),
            "title": r.get("title"),
            "rating": r.get("rating"),
            "date": r.get("published_date"),
            "author": r.get("user", {}).get("username"),
            "trip_type": r.get("trip_type"),
            "url": r.get("url"),
        }
        for r in raw_reviews
    ]

    rating_raw = details.get("rating")
    try:
        rating = float(rating_raw) if rating_raw is not None else None
    except (ValueError, TypeError):
        rating = rating_raw

    result = {
        "source": "tripadvisor",
        "business_name": details.get("name", business_name),
        "rating": rating,
        "total_reviews": details.get("num_reviews"),
        "reviews": reviews,
        "business_info": {
            "phone": details.get("phone"),
            "address": details.get("address_obj", {}).get("address_string"),
            "url": details.get("web_url"),
            "website": details.get("website"),
            "categories": [details.get("category", {}).get("name")] if details.get("category") else [],
            "price_level": details.get("price_level"),
            "description": details.get("description"),
        },
    }
    if review_error:
        result["review_error"] = review_error
    return result

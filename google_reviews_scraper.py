"""
Google Reviews Scraper - fetches business details and reviews via Google Places API
The free tier returns up to 5 reviews per business.

Get your API key at: https://console.cloud.google.com/
Set env var: GOOGLE_PLACES_API_KEY=your_key_here
"""

import os
import requests
from datetime import datetime
from typing import Dict, List, Optional


GOOGLE_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")
BASE_URL = "https://maps.googleapis.com/maps/api/place"


def _find_place_id(business_name: str, location: str) -> Optional[str]:
    try:
        response = requests.get(
            f"{BASE_URL}/findplacefromtext/json",
            params={
                "input": f"{business_name} {location}".strip(),
                "inputtype": "textquery",
                "fields": "place_id,name",
                "key": GOOGLE_API_KEY,
            },
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()
        candidates = data.get("candidates", [])
        if candidates:
            return candidates[0].get("place_id")
        return None
    except requests.exceptions.RequestException as e:
        print(f"[Google Reviews] Place search error: {e}")
        return None


def _get_place_details(place_id: str) -> Dict:
    try:
        response = requests.get(
            f"{BASE_URL}/details/json",
            params={
                "place_id": place_id,
                "fields": (
                    "name,formatted_address,rating,user_ratings_total,"
                    "reviews,website,formatted_phone_number,price_level,business_status"
                ),
                "key": GOOGLE_API_KEY,
            },
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()
        if data.get("status") != "OK":
            return {"error": data.get("status")}
        return data.get("result", {})
    except requests.exceptions.RequestException as e:
        print(f"[Google Reviews] Details fetch error: {e}")
        return {"error": str(e)}


def get_google_reviews_data(business_name: str, location: str = "") -> Dict:
    """
    Search for a business on Google Places and return its details + reviews.

    Args:
        business_name: Name of the business
        location: ZIP code or city/state (improves accuracy)

    Returns:
        Dictionary with business details and up to 5 reviews
    """
    if not GOOGLE_API_KEY:
        return {
            "source": "google_reviews",
            "business_name": business_name,
            "error": "GOOGLE_PLACES_API_KEY environment variable not set.",
            "reviews": [],
        }

    print(f"  [Google Reviews] Searching for '{business_name}'...")
    place_id = _find_place_id(business_name, location)

    if not place_id:
        return {
            "source": "google_reviews",
            "business_name": business_name,
            "error": "Business not found on Google Places.",
            "reviews": [],
        }

    print(f"  [Google Reviews] Found place_id={place_id} — fetching details...")
    details = _get_place_details(place_id)

    if "error" in details:
        return {
            "source": "google_reviews",
            "business_name": business_name,
            "error": details["error"],
            "reviews": [],
        }

    price_map = {1: "$", 2: "$$", 3: "$$$", 4: "$$$$"}
    raw_reviews: List[Dict] = details.get("reviews", [])
    reviews = []
    for r in raw_reviews:
        reviews.append({
            "author": r.get("author_name"),
            "rating": r.get("rating"),
            "text": r.get("text"),
            "created_at": (
                datetime.utcfromtimestamp(r["time"]).isoformat() if r.get("time") else None
            ),
            "relative_time": r.get("relative_time_description"),
        })

    return {
        "source": "google_reviews",
        "business_name": business_name,
        "name": details.get("name"),
        "address": details.get("formatted_address"),
        "rating": details.get("rating"),
        "total_reviews": details.get("user_ratings_total"),
        "phone": details.get("formatted_phone_number"),
        "website": details.get("website"),
        "price": price_map.get(details.get("price_level")),
        "status": details.get("business_status"),
        "reviews_fetched": len(reviews),
        "reviews": reviews,
    }


def main():
    import json
    result = get_google_reviews_data("Starbucks", "New York, NY")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

import { searchBusiness, getReviews } from "../src/scrapers/serpapi/client.js";

// Hardcode location — no API call needed
// gps coords from searchLocations("San Luis Obispo")[0]
const location = { gps: { lat: 35.2827524, lng: -120.6596156 } };

// 1 API call — change business name or index to test different results
const businesses = await searchBusiness("Starbucks", location);
const business = businesses[0];

// 11 API calls — newest, positive, and critical reviews from Google, Yelp, and TripAdvisor
const reviews = await getReviews(business);

// Interact with the reviews object:
//   reviews.google_reviews.newest           - raw SerpAPI data
//   reviews.google_reviews.positive         - raw SerpAPI data
//   reviews.google_reviews.critical         - raw SerpAPI data
//   reviews.yelp_reviews.newest             - raw SerpAPI data
//   reviews.yelp_reviews.positive           - raw SerpAPI data
//   reviews.yelp_reviews.critical           - raw SerpAPI data
//   reviews.tripadvisor_reviews.newest      - raw SerpAPI data
//   reviews.tripadvisor_reviews.positive    - raw SerpAPI data
//   reviews.tripadvisor_reviews.critical    - raw SerpAPI data
//   reviews.llm_format                      - all reviews combined as plain text for LLM
console.log(reviews.llm_format);

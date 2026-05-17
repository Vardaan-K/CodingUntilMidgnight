# SerpAPI Client

A lightweight JavaScript client for searching businesses and fetching their reviews via SerpAPI.

---

## Setup

Add your SerpAPI key to `.env`:
```
SERPAPI_KEY=your_key_here
```
---

## Functions

### `searchBusiness(name, location)`

Searches for businesses by name and location. Intended to power a search dropdown — returns just enough info to display a list of results and let the user pick the right one.

**Parameters**
- `name` — Business name (e.g. `"Starbucks"`)
- `location` — City, state, or zip (e.g. `"San Luis Obispo, CA"`)

**Example**
```js
import { searchBusiness } from "./staticScraperMain.js";

const results = await searchBusiness("Starbucks", "San Luis Obispo, CA");
```

**Example Output**
```json
[
  {
    "place_id": "0x80ed40e5b3e1d4cb:0x4f3e1d4cb3e1d4cb",
    "name": "Starbucks",
    "address": "999 Monterey St, San Luis Obispo, CA 93401",
    "type": "Coffee shop"
  },
  {
    "place_id": "0x80ed40e5b3e1d4cb:0x9a2f3e1d4cb3e1d4",
    "name": "Starbucks",
    "address": "131 Suburban Rd, San Luis Obispo, CA 93401",
    "type": "Coffee shop"
  }
]
```

The `place_id` is used internally to fetch reviews once the user selects a business.

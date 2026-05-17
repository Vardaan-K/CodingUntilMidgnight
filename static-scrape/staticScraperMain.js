import { _fetch } from "./api.js";
import { parseBusinessResult } from "./parsers.js";

/**
 * Search for businesses by name and location.
 * Returns a list of results for a search dropdown.
 *
 * @param {string} name     - Business name e.g. "Starbucks"
 * @param {string} location - City, state, or zip e.g. "San Luis Obispo, CA"
 * @returns {Promise<Array>} - List of matching businesses
 */

export async function searchBusiness(name, location) {
  const data = await _fetch("google_local", {
    q: name,
    location,
    hl: "en",
    gl: "us",
  });

  const results = data.local_results ?? [];
  return results.map(parseBusinessResult);
}

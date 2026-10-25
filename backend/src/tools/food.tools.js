import { tool } from "langchain";
import { z } from "zod";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Identify your app per Nominatim/Overpass usage policy.
// Replace the contact info with something real if you deploy this.
const USER_AGENT = "party-planner-learning-app/1.0 (contact: geetambinani6@gmail.com)";

const FOOD_AMENITIES = ["restaurant", "cafe", "fast_food", "bar", "pub", "food_court"];

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// Escapes characters that have special meaning inside an Overpass QL
// regex literal (delimited by "..."), so untrusted input can't break
// out of the string or change the regex's meaning.
function escapeOverpassRegex(input) {
  return input.replace(/[\\"]/g, "\\$&");
}

// Step 1: resolve a free-text place name to coordinates + bounding box,
// instead of relying on an exact OSM `name` + `boundary=administrative` match.
async function geocodeLocation(location) {
  const params = new URLSearchParams({ q: location, format: "json", limit: "1" });

  const response = await fetchWithTimeout(`${NOMINATIM_URL}?${params}`, {
    headers: { "User-Agent": USER_AGENT }
  });

  if (!response.ok) {
    throw new Error(`Nominatim error: ${response.status}`);
  }

  const results = await response.json();
  if (!results.length) {
    throw new Error(`Could not resolve location: "${location}"`);
  }

  const { boundingbox, display_name } = results[0];
  const [south, north, west, east] = boundingbox.map(Number);

  return { bbox: { south, west, north, east }, resolvedName: display_name };
}

// Step 2: build an Overpass query scoped to the bounding box, covering
// several food-related amenity types and an optional cuisine filter.
function buildOverpassQuery(bbox, cuisine) {
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;

  const cuisineFilter = cuisine
    ? `["cuisine"~"${escapeOverpassRegex(cuisine)}",i]`
    : "";

  const clauses = FOOD_AMENITIES.map(
    (amenity) => `nwr["amenity"="${amenity}"]${cuisineFilter}(${bboxStr});`
  ).join("\n    ");

  return `
    [out:json][timeout:20];
    (
      ${clauses}
    );
    out center tags;
  `;
}

async function queryOverpass(query) {
  const response = await fetchWithTimeout(
    OVERPASS_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT
      },
      body: `data=${encodeURIComponent(query)}`
    },
    20000
  );

  if (!response.ok) {
    throw new Error(`Overpass error: ${response.status}`);
  }

  return response.json();
}

// OSM tags are flat key-value pairs, e.g. "diet:vegetarian" = "yes" / "only",
// not a nested `diet` object. This reads the real tag correctly.
function readsVegetarian(tags) {
  const value = tags["diet:vegetarian"];
  return value === "yes" || value === "only";
}

function normalizeElement(item) {
  const tags = item.tags || {};

  return {
    id: item.id,
    name: tags.name || "Unnamed restaurant",
    amenity: tags.amenity || null,
    cuisine: tags.cuisine || null,
    address:
      [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ") ||
      null,
    city: tags["addr:city"] || null,
    phone: tags.phone || tags["contact:phone"] || null,
    website: tags.website || tags["contact:website"] || null,
    vegetarian: readsVegetarian(tags),
    latitude: item.lat ?? item.center?.lat ?? null,
    longitude: item.lon ?? item.center?.lon ?? null
  };
}

export const searchFoodProviders = tool(
  async ({ location, cuisine, vegetarian }) => {
    const { bbox, resolvedName } = await geocodeLocation(location);

    const query = buildOverpassQuery(bbox, cuisine);
    const data = await queryOverpass(query);

    let results = (data.elements || []).map(normalizeElement);

    // Actually apply the vegetarian filter (previously accepted but unused).
    if (vegetarian) {
      results = results.filter((place) => place.vegetarian);
    }

    results.sort((a, b) => {
      const score = (p) =>
        (p.name !== "Unnamed restaurant" ? 1 : 0) +
        (p.website ? 1 : 0) +
        (p.phone ? 1 : 0);
      return score(b) - score(a);
    });

    return JSON.stringify({
      location,
      resolvedLocation: resolvedName,
      cuisine: cuisine || null,
      vegetarian: vegetarian || false,
      resultCount: results.length,
      results: results.slice(0, 20)
    });
  },
  {
    name: "search_food_providers",
    description: `
      Search real restaurants, cafes, and other food providers near a
      city or place using OpenStreetMap. Resolves the location via
      geocoding first, then searches a bounding box around it.
    `,
    schema: z.object({
      location: z.string().describe("City, town, or place name to search near"),
      cuisine: z
        .string()
        .optional()
        .describe("Preferred cuisine, e.g. italian, indian, vegan"),
      vegetarian: z
        .boolean()
        .optional()
        .describe("Only return places explicitly tagged as vegetarian-friendly")
    })
  }
);
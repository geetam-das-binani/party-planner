import { tool } from "langchain";
import { z } from "zod";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Identify your app per Nominatim/Overpass usage policy.
// Replace the contact info with something real if you deploy this.
const USER_AGENT = "party-planner-learning-app/1.0 (contact: geetambinani6@gmail.com)";

// Maps the optional `venueType` hint to OSM tag filters.
// Falls back to searching everything if no match / not provided.
const VENUE_TYPE_FILTERS = {
  outdoor: [`["leisure"="park"]`, `["amenity"="events_venue"]["outdoor"="yes"]`],
  banquet: [`["amenity"="events_venue"]`, `["building"="banquet_hall"]`],
  "community centre": [`["amenity"="community_centre"]`],
  "community_centre": [`["amenity"="community_centre"]`],
  sports: [`["leisure"="sports_centre"]`, `["leisure"="stadium"]`],
  hotel: [`["tourism"="hotel"]["events_venue"="yes"]`, `["tourism"="hotel"]["conference"="yes"]`],
  restaurant: [`["amenity"="restaurant"]["function_room"="yes"]`]
};

// Default (broad) set of tag filters used when no venueType is given
// or the given venueType doesn't match a known category.
const DEFAULT_FILTERS = [
  `["amenity"="events_venue"]`,
  `["amenity"="community_centre"]`,
  `["leisure"="sports_centre"]`,
  `["tourism"="hotel"]["events_venue"="yes"]`,
  `["building"="banquet_hall"]`
];

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// Step 1: turn a free-text place name into coordinates + a bounding box.
// This avoids relying on an exact match against OSM's `name` +
// `boundary=administrative` tags, which fails for lots of real place names.
async function geocodeLocation(location) {
  const params = new URLSearchParams({
    q: location,
    format: "json",
    limit: "1"
  });

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

  const { boundingbox, lat, lon, display_name } = results[0];
  // boundingbox is [south, north, west, east] as strings
  const [south, north, west, east] = boundingbox.map(Number);

  return {
    lat: Number(lat),
    lon: Number(lon),
    bbox: { south, west, north, east },
    resolvedName: display_name
  };
}

// Step 2: build an Overpass query scoped to the bounding box, using
// whichever tag filters match the requested venueType (or all of them).
function buildOverpassQuery(bbox, venueType) {
  const key = venueType?.toLowerCase().trim();
  const filters = VENUE_TYPE_FILTERS[key] || DEFAULT_FILTERS;

  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;

  const clauses = filters
    .map((tagFilter) => `nwr${tagFilter}(${bboxStr});`)
    .join("\n    ");

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

function normalizeElement(item) {
  const tags = item.tags || {};
  const capacity = tags.capacity ? Number(tags.capacity) : null;

  return {
    id: item.id,
    name: tags.name || "Unnamed venue",
    type: tags.amenity || tags.leisure || tags.tourism || tags.building || null,
    address:
      [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ") ||
      null,
    city: tags["addr:city"] || null,
    phone: tags.phone || tags["contact:phone"] || null,
    website: tags.website || tags["contact:website"] || null,
    capacity,
    latitude: item.lat ?? item.center?.lat ?? null,
    longitude: item.lon ?? item.center?.lon ?? null
  };
}

export const searchVenues = tool(
  async ({ location, guests, venueType }) => {
    const { bbox, resolvedName } = await geocodeLocation(location);

    const query = buildOverpassQuery(bbox, venueType);
    const data = await queryOverpass(query);

    let results = (data.elements || []).map(normalizeElement);

    // Only filter on capacity when a venue actually reports one; most
    // OSM venues don't tag capacity, so we don't want to discard them.
    if (guests) {
      results = results.filter(
        (venue) => venue.capacity === null || venue.capacity >= guests
      );
    }

    // Prefer venues with a name and more complete metadata first.
    results.sort((a, b) => {
      const score = (v) =>
        (v.name !== "Unnamed venue" ? 1 : 0) +
        (v.website ? 1 : 0) +
        (v.phone ? 1 : 0);
      return score(b) - score(a);
    });

    return JSON.stringify({
      location,
      resolvedLocation: resolvedName,
      guests,
      venueType: venueType || null,
      resultCount: results.length,
      results: results.slice(0, 20)
    });
  },
  {
    name: "search_venues",
    description: `
      Search real party/event venues near a city or place using
      OpenStreetMap data. Resolves the location via geocoding first,
      then searches a bounding box around it. Use this whenever the
      user needs venue options for an event.
    `,
    schema: z.object({
      location: z
        .string()
        .describe("City, town, or place name where the party will happen"),
      guests: z
        .number()
        .describe("Expected number of guests"),
      venueType: z
        .string()
        .optional()
        .describe(
          "Preferred venue type, e.g. outdoor, banquet, community centre, sports, hotel, restaurant"
        )
    })
  }
);
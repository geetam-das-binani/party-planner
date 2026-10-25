import { tool } from "langchain";
import { z } from "zod";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Identify your app per Nominatim/Overpass usage policy.
// Replace the contact info with something real if you deploy this.
const USER_AGENT = "party-planner-learning-app/1.0 (contact: geetambinani6@gmail.com)";

const DECORATION_SHOP_TYPES = ["party", "florist", "gift", "craft", "fabric"];

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
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
// several shop types relevant to party decoration.
function buildOverpassQuery(bbox) {
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;

  const clauses = DECORATION_SHOP_TYPES.map(
    (shopType) => `nwr["shop"="${shopType}"](${bboxStr});`
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

function normalizeElement(item) {
  const tags = item.tags || {};

  return {
    id: item.id,
    name: tags.name || "Unnamed provider",
    type: tags.shop || null,
    description: tags.description || null,
    address:
      [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ") ||
      null,
    city: tags["addr:city"] || null,
    phone: tags.phone || tags["contact:phone"] || null,
    website: tags.website || tags["contact:website"] || null,
    latitude: item.lat ?? item.center?.lat ?? null,
    longitude: item.lon ?? item.center?.lon ?? null
  };
}

// OSM has no generic "theme" tag for shops, so a theme can't be filtered
// the way cuisine or venueType were. Instead, treat it as a soft signal:
// score how well the shop's name/description/type mention the theme word(s),
// and use that to rank results rather than to hard-exclude anything (since
// most legitimate party/florist/gift shops won't mention a theme at all).
function themeMatchScore(provider, theme) {
  if (!theme) return 0;

  const needle = theme.toLowerCase().trim();
  if (!needle) return 0;

  const haystack = [provider.name, provider.description, provider.type]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(needle) ? 1 : 0;
}

export const searchDecorationProviders = tool(
  async ({ location, theme }) => {
    const { bbox, resolvedName } = await geocodeLocation(location);

    const query = buildOverpassQuery(bbox);
    const data = await queryOverpass(query);

    let results = (data.elements || []).map(normalizeElement);

    // Rank by (1) theme mention, then (2) metadata completeness.
    // Theme match is a boost, not a filter — OSM rarely tags themes,
    // so hard-filtering on it would discard most real, usable results.
    results.sort((a, b) => {
      const themeScore = (p) => themeMatchScore(p, theme);
      const completeness = (p) =>
        (p.name !== "Unnamed provider" ? 1 : 0) +
        (p.website ? 1 : 0) +
        (p.phone ? 1 : 0);

      return themeScore(b) - themeScore(a) || completeness(b) - completeness(a);
    });

    const flaggedResults = results.slice(0, 20).map((p) => ({
      ...p,
      themeMatched: themeMatchScore(p, theme) > 0
    }));

    return JSON.stringify({
      location,
      resolvedLocation: resolvedName,
      theme: theme || null,
      resultCount: flaggedResults.length,
      results: flaggedResults
    });
  },
  {
    name: "search_decoration_providers",
    description: `
      Search real party decoration, florist, gift, and craft providers
      near a city or place using OpenStreetMap. Resolves the location
      via geocoding first, then searches a bounding box around it.
      A theme, if given, is used to rank results (via name/description
      matches) rather than to exclude providers, since OSM rarely tags
      shops with a specific party theme.
    `,
    schema: z.object({
      location: z.string().describe("City, town, or place name to search near"),
      theme: z
        .string()
        .optional()
        .describe(
          "Optional party theme, e.g. superhero, wedding, princess — used to rank results, not filter them strictly"
        )
    })
  }
);
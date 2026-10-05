import dotenv from "dotenv";
import mongoose from "mongoose";
import axios from "axios";

import Organization from "../models/organization.js";

dotenv.config();

const MONGO_URL = process.env.DB_URL;

const OVERPASS_URL =
  "https://overpass.kumi.systems/api/interpreter";

// =====================================================
// Alexandria Bounding Box
// south, west, north, east
// =====================================================

const ALEXANDRIA_BBOX =
  "31.05,29.75,31.35,30.15";

// =====================================================
// Organization Types
// =====================================================

const ORGANIZATION_TYPES = {
  hospital: [
    `["amenity"="hospital"]`,
  ],

  bank: [
    `["amenity"="bank"]`,
  ],

  school: [
    `["amenity"="school"]`,
  ],

  university: [
    `["amenity"="university"]`,
  ],

  library: [
    `["amenity"="library"]`,
  ],

  company: [
    `["office"]`,
  ],
  government: [
  `["office"="government"]`,
  `["amenity"="townhall"]`,
  `["government"]`,
],
workspace: [
  `["office"="coworking"]`,
  `["amenity"="coworking_space"]`,
  `["leisure"="coworking"]`,
],

  building: [
    `["building"]`,
  ],
};

// =====================================================
// Convert OSM Type → Our Organization Type
// =====================================================

const getOrganizationType = (
  requestedType
) => {
  const allowedTypes = [
    "hospital",
    "bank",
    "school",
    "university",
    "library",
    "company",
    "building",
    "government",
    "workspace",
  ];

  if (
    allowedTypes.includes(requestedType)
  ) {
    return requestedType;
  }

  return "other";
};

// =====================================================
// Create Slug
// =====================================================

const createSlug = (
  name,
  externalId
) => {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug}-${externalId}`;
};

// =====================================================
// Get Coordinates
// =====================================================

const getCoordinates = (place) => {
  if (place.type === "node") {
    if (
      typeof place.lat === "number" &&
      typeof place.lon === "number"
    ) {
      return {
        latitude: place.lat,
        longitude: place.lon,
      };
    }

    return null;
  }

  if (place.center) {
    if (
      typeof place.center.lat === "number" &&
      typeof place.center.lon === "number"
    ) {
      return {
        latitude: place.center.lat,
        longitude: place.center.lon,
      };
    }
  }

  return null;
};

// =====================================================
// Get Data From OpenStreetMap
// =====================================================

const getOrganizationsFromOSM = async (
  requestedType
) => {
  const filters =
    ORGANIZATION_TYPES[requestedType];

  if (!filters) {
    throw new Error(
      `Unsupported organization type: ${requestedType}`
    );
  }

  let queryParts = "";

  for (const filter of filters) {
    if (requestedType === "workspace") {
      queryParts += `
        node${filter}(${ALEXANDRIA_BBOX});
      `;
    } else {
      queryParts += `
        node${filter}(${ALEXANDRIA_BBOX});
        way${filter}(${ALEXANDRIA_BBOX});
        relation${filter}(${ALEXANDRIA_BBOX});
      `;
    }
  }

  const query = `
    [out:json][timeout:20];

    (
      ${queryParts}
    );

    out body;
  `;

  console.log(
    `Fetching ${requestedType} from OpenStreetMap...`
  );

  const response = await axios.get(
    OVERPASS_URL,
    {
      params: {
        data: query,
      },

      headers: {
        Accept: "application/json",
        "User-Agent":
          "Spacio-Backend/1.0",
      },

      timeout: 60000,
    }
  );

  return response.data.elements;
};

// =====================================================
// Seed Organizations
// =====================================================

const seedOrganizations = async () => {
  try {
    // -------------------------------------------------
    // Get type from command line
    // -------------------------------------------------

    const requestedType =
      process.argv[2];

    if (!requestedType) {
      console.log(
        "Please provide organization type."
      );

      console.log(
        "Example:"
      );

      console.log(
        "npm run seed:organizations -- bank"
      );

      process.exit(1);
    }

    // -------------------------------------------------
    // Validate type
    // -------------------------------------------------

    if (
      !ORGANIZATION_TYPES[
        requestedType
      ]
    ) {
      console.log(
        `Invalid organization type: ${requestedType}`
      );

      console.log(
        "Available types:"
      );

      console.log(
        Object.keys(
          ORGANIZATION_TYPES
        ).join(", ")
      );

      process.exit(1);
    }

    // -------------------------------------------------
    // Connect MongoDB
    // -------------------------------------------------

    console.log(
      "Connecting to MongoDB..."
    );

    await mongoose.connect(
      MONGO_URL
    );

    console.log(
      "MongoDB connected ✅"
    );

    // -------------------------------------------------
    // Get OSM Data
    // -------------------------------------------------

    const places =
      await getOrganizationsFromOSM(
        requestedType
      );

    console.log(
      `Found ${places.length} places from OSM`
    );

    // -------------------------------------------------
    // Counters
    // -------------------------------------------------

    let inserted = 0;
    let skipped = 0;

    // -------------------------------------------------
    // Loop through places
    // -------------------------------------------------

    for (const place of places) {
      const tags =
        place.tags || {};

      const name =
        tags.name;

      // Skip unnamed places
      if (!name) {
        skipped++;
        continue;
      }

      // -------------------------------------------------
      // Coordinates
      // -------------------------------------------------

      const coordinates =
        getCoordinates(place);

      if (!coordinates) {
        skipped++;
        continue;
      }

      const {
        latitude,
        longitude,
      } = coordinates;

      // -------------------------------------------------
      // External ID
      // -------------------------------------------------

      const externalId =
        `${place.type}-${place.id}`;

      // -------------------------------------------------
      // Check duplicate
      // -------------------------------------------------

      const existing =
        await Organization.findOne({
          source: "openstreetmap",
          externalId,
        });

      if (existing) {
        skipped++;
        continue;
      }

      // -------------------------------------------------
      // Create Organization
      // -------------------------------------------------

      const organization =
        new Organization({
          name,

          slug: createSlug(
            name,
            externalId
          ),

          description:
            tags.description ||
            "",

          type:
            getOrganizationType(
              requestedType
            ),

          address:
            tags["addr:full"] ||
            tags["addr:street"] ||
            tags["addr:place"] ||
            "",

          governorate:
            "Alexandria",

          city:
            tags["addr:city"] ||
            "Alexandria",

          location: {
            type: "Point",

            coordinates: [
              longitude,
              latitude,
            ],
          },

          contactPhone:
            tags.phone ||
            tags["contact:phone"] ||
            "",

          contactEmail:
            tags.email ||
            tags["contact:email"] ||
            "",

          website:
            tags.website ||
            tags["contact:website"] ||
            "",

          logo: "",

          coverImage: "",

          source:
            "openstreetmap",

          externalId,

          isActive: true,

          createdBy:
            undefined,
        });

      // -------------------------------------------------
      // Save
      // -------------------------------------------------

      await organization.save();

      inserted++;

      console.log(
        `Added: ${name} (${requestedType})`
      );
    }

    // -------------------------------------------------
    // Final Result
    // -------------------------------------------------

    console.log(
      "\n--------------------------"
    );

    console.log(
      `Inserted: ${inserted}`
    );

    console.log(
      `Skipped: ${skipped}`
    );

    console.log(
      "Organization seed completed ✅"
    );

    console.log(
      "--------------------------\n"
    );

    await mongoose.disconnect();

    process.exit(0);

  } catch (error) {
    console.error(
      "Seed Error:",
      error.message
    );

    await mongoose.disconnect();

    process.exit(1);
  }
};

seedOrganizations();
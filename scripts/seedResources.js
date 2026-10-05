import dotenv from "dotenv";
dotenv.config();

import connectDB from "../config/db.js";
import Organization from "../models/organization.js";
import Resource from "../models/resource.js";
import { optionsForType, RESOURCE_TYPES } from "../config/domain.js";

// The OSM seeder only creates organizations, so every bookable space in the
// app is still missing. This fills each organization with a starter set of
// the options its category offers, placed at the organization's own point.
//
//   npm run seed:resources            -> up to 25 per category
//   npm run seed:resources -- 100      -> up to 100 per category
//   npm run seed:resources -- 0 hospital   -> only hospitals
//
// Idempotent: a resource is matched on {organization, name, type}, so
// running it twice won't duplicate anything.

const arg = (index, fallback) => {
  const value = process.argv[index + 2];
  return value === undefined ? fallback : value;
};

const perCategory = Number(arg(0, 25)) || 25;
const onlyType = arg(1, null);

// A couple of name variants per option so a category doesn't look like
// three identical cards.
const NAME_VARIANTS = {
  consultation_room: ["Consultation Room {n}", "Outpatient Clinic {n}"],
  ward: ["Ward {n}", "Inpatient Ward {n}"],
  operation_room: ["Operating Theatre {n}", "Surgery Room {n}"],
  lab: ["Laboratory {n}", "Diagnostics Lab {n}"],
  pharmacy: ["Pharmacy {n}"],
  imaging_room: ["Imaging Suite {n}", "Radiology Room {n}"],
  emergency: ["Emergency Room {n}", "ER Bay {n}"],
  meeting_room: ["Meeting Room {n}", "Conference Room {n}"],
  conference_room: ["Conference Hall {n}"],
  training_room: ["Training Room {n}"],
  workspace: ["Coworking Space {n}", "Open Workspace {n}"],
  desk: ["Hot Desk {n}"],
  phone_booth: ["Phone Booth {n}"],
  parking: ["Parking Area {n}", "Parking Bay {n}"],
  lecture_hall: ["Lecture Hall {n}", "Auditorium {n}"],
  classroom: ["Classroom {n}"],
  library_hall: ["Library Hall {n}", "Reading Hall {n}"],
  study_room: ["Study Room {n}", "Group Study Room {n}"],
  reading_room: ["Reading Room {n}"],
  media_room: ["Media Room {n}", "Multimedia Room {n}"],
  sports_hall: ["Sports Hall {n}", "Gymnasium {n}"],
  service_desk: ["Service Desk {n}"],
  hall: ["Main Hall {n}"],
  lobby: ["Lobby {n}"],
  teller: ["Teller {n}", "Counter {n}"],
  lounge: ["Lounge {n}", "Breakout Area {n}"],
  server_room: ["Server Room {n}"],
};

const AMENITIES = {
  meeting_room: ["Whiteboard", "Projector", "Video conferencing"],
  conference_room: ["Projector", "PA system", "Video conferencing"],
  workspace: ["Wi-Fi", "Power outlets", "Standing desk"],
  desk: ["Wi-Fi", "Monitor", "Power outlets"],
  phone_booth: ["Soundproofed", "Desk", "Power outlet"],
  lecture_hall: ["Projector", "PA system", "Whiteboard"],
  classroom: ["Whiteboard", "Projector"],
  lab: ["Safety equipment", "Workstations", "Ventilation"],
  library_hall: ["Wi-Fi", "Quiet zone", "Power outlets"],
  study_room: ["Wi-Fi", "Whiteboard", "Power outlets"],
  reading_room: ["Quiet zone", "Reading lamps"],
  training_room: ["Projector", "Whiteboard", "Flexible seating"],
  lounge: ["Coffee", "Wi-Fi", "Soft seating"],
  workspace_defaults: ["Wi-Fi"],
};

const CAPACITY = {
  operation_room: 12,
  lecture_hall: 200,
  conference_room: 40,
  hall: 150,
  sports_hall: 60,
  lab: 24,
  classroom: 40,
  library_hall: 80,
  workspace: 30,
  parking: 50,
  phone_booth: 1,
  desk: 1,
  server_room: 4,
};

const run = async () => {
  await connectDB();

  const query = { isActive: true };
  if (onlyType) query.type = String(onlyType).toLowerCase();

  const organizations = await Organization.find(query)
    .sort({ type: 1, name: 1 })
    .lean();

  if (!organizations.length) {
    console.log(
      "No active organizations found. Run `npm run seed:organizations <type>` first."
    );
    process.exit(0);
  }

  let created = 0;
  let skipped = 0;

  // Group so each category reports its own total.
  const byType = new Map();
  organizations.forEach((org) => {
    const list = byType.get(org.type) ?? [];
    list.push(org);
    byType.set(org.type, list);
  });

  for (const [type, orgs] of byType) {
    const options = optionsForType(type) ?? [];
    const slice = orgs.slice(0, perCategory);

    const docs = [];

    for (const org of slice) {
      const [lng, lat] = org.location?.coordinates ?? [];
      if (lng === undefined || lat === undefined) continue;

      options.forEach((option, index) => {
        const variants = NAME_VARIANTS[option] ?? [RESOURCE_TYPES[option]];
        const name = variants[index % variants.length].replace(
          "{n}",
          String(index + 1)
        );

        docs.push({
          name,
          type: option,
          description: `${RESOURCE_TYPES[option]} at ${org.name}.`,
          organization: org._id,
          address: org.address ?? "",
          governorate: org.governorate,
          city: org.city ?? "",
          location: { type: "Point", coordinates: [lng, lat] },
          capacity: CAPACITY[option] ?? 8,
          amenities: AMENITIES[option] ?? AMENITIES.workspace_defaults,
          requiresApproval: true,
          status: "available",
          isActive: true,
          phone: org.contactPhone ?? "",
          workingHours: "Sun - Thu, 9:00 AM - 9:00 PM",
          source: "manual",
        });
      });
    }

    if (!docs.length) continue;

    // Only insert what isn't already there.
    const existing = await Resource.find({
      organization: { $in: slice.map((o) => o._id) },
      name: { $in: docs.map((d) => d.name) },
    })
      .select("organization name")
      .lean();

    const taken = new Set(
      existing.map((r) => `${r.organization}|${r.name}`)
    );

    const fresh = docs.filter(
      (d) => !taken.has(`${d.organization}|${d.name}`)
    );

    if (fresh.length) {
      await Resource.insertMany(fresh);
      created += fresh.length;
    }

    skipped += docs.length - fresh.length;

    console.log(
      `  ${type.padEnd(11)} ${String(slice.length).padStart(4)} orgs  ${String(fresh.length).padStart(5)} created  ${String(docs.length - fresh.length).padStart(5)} already there`
    );
  }

  console.log(
    `\nDone. ${created} resources created, ${skipped} already existed.`
  );

  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

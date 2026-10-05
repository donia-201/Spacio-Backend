// =========================
// Single source of truth for the Spacio domain.
// The frontend renders categories and the per-category "options" straight
// from GET /meta/organization-types, so nothing is hardcoded twice.
// =========================

export const USER_ROLES = ["user", "technician", "admin"];

// Membership role = the person's job *inside* the organization.
export const MEMBERSHIP_ROLES = [
  "resident",
  "employee",
  "manager",
  "building_admin",
  "doctor",
  "teacher",
  "member",
];

// Membership roles allowed to manage an organization's resources/bookings.
export const MANAGER_MEMBERSHIP_ROLES = ["manager", "building_admin"];

export const RESOURCE_TYPES = {
  consultation_room: "Consultation Room",
  ward: "Ward",
  operation_room: "Operation Room",
  lab: "Laboratory",
  pharmacy: "Pharmacy",
  imaging_room: "Imaging Room",
  emergency: "Emergency Room",
  meeting_room: "Meeting Room",
  conference_room: "Conference Room",
  training_room: "Training Room",
  workspace: "Workspace",
  desk: "Desk",
  phone_booth: "Phone Booth",
  parking: "Parking",
  lecture_hall: "Lecture Hall",
  classroom: "Classroom",
  library_hall: "Library Hall",
  study_room: "Study Room",
  reading_room: "Reading Room",
  media_room: "Media Room",
  sports_hall: "Sports Hall",
  service_desk: "Service Desk",
  hall: "Main Hall",
  lobby: "Lobby",
  teller: "Teller",
  lounge: "Lounge",
  server_room: "Server Room",
};

export const RESOURCE_TYPE_KEYS = Object.keys(RESOURCE_TYPES);

const COMMON = ["meeting_room", "parking"];

// `options` are the bookable things a person can pick once they open a
// category — e.g. opening "Hospitals" reveals Consultation Room / Ward / ...
export const ORGANIZATION_TYPES = {
  hospital: {
    key: "hospital",
    singular: "Hospital",
    plural: "Hospitals",
    icon: "🏥",
    description:
      "Book consultation rooms, wards, labs and pharmacies near you.",
    options: [
      "consultation_room",
      "ward",
      "operation_room",
      "lab",
      "pharmacy",
      "imaging_room",
      "emergency",
      ...COMMON,
    ],
  },

  workspace: {
    key: "workspace",
    singular: "Workspace",
    plural: "Workspaces",
    icon: "💼",
    description:
      "Find coworking spaces, hot desks and meeting rooms ready to book.",
    options: [
      "workspace",
      "desk",
      "meeting_room",
      "conference_room",
      "phone_booth",
      "training_room",
      "parking",
    ],
  },

  university: {
    key: "university",
    singular: "University",
    plural: "Universities",
    icon: "🎓",
    description:
      "Reserve lecture halls, laboratories and library halls on campus.",
    options: [
      "lecture_hall",
      "lab",
      "classroom",
      "library_hall",
      "study_room",
      "sports_hall",
      "meeting_room",
    ],
  },

  school: {
    key: "school",
    singular: "School",
    plural: "Schools",
    icon: "🏫",
    description:
      "Access classrooms, laboratories and sports halls in your school.",
    options: [
      "classroom",
      "lab",
      "library_hall",
      "sports_hall",
      "meeting_room",
      "media_room",
    ],
  },

  library: {
    key: "library",
    singular: "Library",
    plural: "Libraries",
    icon: "📚",
    description:
      "Claim a reading room or study room and book a media hall for events.",
    options: [
      "reading_room",
      "study_room",
      "media_room",
      "meeting_room",
      "lab",
    ],
  },

  building: {
    key: "building",
    singular: "Building",
    plural: "Buildings",
    icon: "🏢",
    description:
      "Reserve shared halls, lobbies and meeting rooms inside a building.",
    options: ["hall", "lobby", "meeting_room", "workspace", "parking"],
  },

  government: {
    key: "government",
    singular: "Government Office",
    plural: "Government Offices",
    icon: "🏛️",
    description:
      "Book a service desk or hall for public services and appointments.",
    options: ["service_desk", "hall", "meeting_room", "workspace", "parking"],
  },

  company: {
    key: "company",
    singular: "Company",
    plural: "Companies",
    icon: "🏢",
    description:
      "Reserve meeting rooms, lounges and parking for corporate teams.",
    options: [
      "meeting_room",
      "conference_room",
      "workspace",
      "training_room",
      "lounge",
      "parking",
    ],
  },

  bank: {
    key: "bank",
    singular: "Bank",
    plural: "Banks",
    icon: "🏦",
    description:
      "Pick a teller or private meeting room for your banking appointment.",
    options: ["teller", "service_desk", "meeting_room", "lobby"],
  },

  other: {
    key: "other",
    singular: "Other",
    plural: "Others",
    icon: "📍",
    description: "Browse shared spaces that do not fit the other categories.",
    options: [
      "meeting_room",
      "hall",
      "workspace",
      "lounge",
      "classroom",
      "parking",
    ],
  },
};

export const ORGANIZATION_TYPE_KEYS = Object.keys(ORGANIZATION_TYPES);

export const isOrganizationType = (value) =>
  ORGANIZATION_TYPE_KEYS.includes(String(value || "").toLowerCase());

export const isResourceType = (value) =>
  RESOURCE_TYPE_KEYS.includes(String(value || "").toLowerCase());

// Expand a type key into what the frontend needs to render a card + a
// category screen (title, icon, and the labelled options list).
export const describeOrganizationType = (key) => {
  const type = ORGANIZATION_TYPES[String(key || "").toLowerCase()];
  if (!type) return null;
  return {
    ...type,
    optionDetails: type.options.map((option) => ({
      key: option,
      label: RESOURCE_TYPES[option] ?? option,
    })),
  };
};

export const describeAllOrganizationTypes = () =>
  ORGANIZATION_TYPE_KEYS.map((key) => describeOrganizationType(key));

// Options allowed for a given organization type, or null when the type is
// unknown (caller decides whether to hard-fail or allow anything).
export const optionsForType = (type) => {
  const found = ORGANIZATION_TYPES[String(type || "").toLowerCase()];
  return found ? found.options : null;
};

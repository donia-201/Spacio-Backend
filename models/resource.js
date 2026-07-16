import mongoose from "mongoose";

const resourceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: String,

    type: {
      type: String,
      required: true,
      enum: [
        "meeting_room",
        "workspace",
        "parking",
        "lab",
        "classroom",
      ],
    },

    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },

    capacity: {
      type: Number,
      default: 1,
    },

    amenities: [
      {
        type: String,
      },
    ],

    requiresApproval: {
      type: Boolean,
      default: false,
    },

    isAvailable: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

resourceSchema.index({
  organization: 1,
  type: 1,
});

const Resource =
  mongoose.models.Resource ||
  mongoose.model(
    "Resource",
    resourceSchema
  );

  export const getResources = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      organization,
      type,
    } = req.query;

    const filter = {};

    if (organization) {
      filter.organization = organization;
    }

    if (type) {
      filter.type = type;
    }

    const resources = await Resource.find(filter)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Resource.countDocuments(filter);

    return res.status(200).json({
      success: true,
      currentPage: Number(page),
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      data: resources,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
  const resources =
  await Resource.find()
  .populate(
    "organization",
    "name"
  );
};


export default Resource;
import Organization from "../models/organization.js";

export const createOrganization =
  async (req, res) => {
    try {
      const {
        name,
        slug,
        description,
        type,
        address,
        contactEmail,
        contactPhone,
        logo,
        coverImage,
        coordinates,
      } = req.body;

      const organization =
        await Organization.create({
          name,
          slug,
          description,
          type,
          address,
          contactEmail,
          contactPhone,
          logo,
          coverImage,
          location: {
            type: "Point",
            coordinates,
          },
          createdBy: req.user._id,
        });

      return res.status(201).json({
        success: true,
        data: organization,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

export const getOrganizations =
  async (req, res) => {
    try {
      const organizations =
        await Organization.find({
          isActive: true,
        });

      return res.status(200).json({
        success: true,
        data: organizations,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

export const getOrganizationById =
  async (req, res) => {
    try {
      const organization =
        await Organization.findById(
          req.params.id
        );

      if (!organization) {
        return res.status(404).json({
          success: false,
          message:
            "Organization not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: organization,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };
////////////////////////////
  export const updateOrganization = async (
  req,
  res
) => {
  try {
    const organization =
      await Organization.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
          runValidators: true,
        }
      );

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: organization,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};




// ========delete organization=====
export const deleteOrganization = async (
  req,
  res
) => {
  try {
    const organization =
      await Organization.findByIdAndUpdate(
        req.params.id,
        {
          isActive: false,
        },
        {
          new: true,
        }
      );

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Organization deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


///////////////
export const getOrganization = async (
  req,
  res
) => {
  try {
    const {
      page = 1,
      limit = 10,
      type,
      search,
    } = req.query;

    const filter = {
      isActive: true,
    };

    if (type) {
      filter.type = type;
    }

    if (search) {
      filter.$text = {
        $search: search,
      };
    }

    const organizations =
      await Organization.find(filter)
        .skip((page - 1) * limit)
        .limit(Number(limit));

    return res.status(200).json({
      success: true,
      data: organizations,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//========Nearby search========
export const getNearbyOrganizations =
  async (req, res) => {
    try {
      const {
        lng,
        lat,
        distance = 5000,
        type,
      } = req.query;

      const filter = {
        isActive: true,
      };

      if (type) {
        filter.type = type;
      }

      const organizations =
        await Organization.find({
          ...filter,
          location: {
            $near: {
              $geometry: {
                type: "Point",
                coordinates: [
                  Number(lng),
                  Number(lat),
                ],
              },
              $maxDistance:
                Number(distance),
            },
          },
        });

      return res.status(200).json({
        success: true,
        data: organizations,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };
import OrganizationMembership
from "../models/organizationMembership.js";

export const joinOrganization =
  async (req, res) => {
    try {
      const {
        organizationId,
        role,
      } = req.body;

      const membership =
        await OrganizationMembership.create({
          user: req.user._id,
          organization:
            organizationId,
          role,
        });

      return res.status(201).json({
        success: true,
        data: membership,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

  export const approveMembership =
  async (req, res) => {
    try {
      const membership =
        await OrganizationMembership.findByIdAndUpdate(
          req.params.id,
          {
            status:
              "approved",
            joinedAt:
              new Date(),
          },
          {
            new: true,
          }
        );

      return res.status(200).json({
        success: true,
        data: membership,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };


  export const myOrganizations =
  async (req, res) => {
    try {
      const memberships =
        await OrganizationMembership
          .find({
            user:
              req.user._id,
            status:
              "approved",
          })
          .populate(
            "organization"
          );

      return res.status(200).json({
        success: true,
        data: memberships,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };
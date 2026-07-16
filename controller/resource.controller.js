import Resource from "../models/resource.js";

export const createResource =
  async (req, res) => {
    try {
      const resource =
        await Resource.create({
          ...req.body,
          createdBy:
            req.user._id,
        });

      return res.status(201).json({
        success: true,
        data: resource,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

export const getResources =
  async (req, res) => {
    try {
      const resources =
        await Resource.find()
          .populate(
            "organization",
            "name"
          );

      return res.status(200).json({
        success: true,
        data: resources,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

export const getResourceById =
  async (req, res) => {
    try {
      const resource =
        await Resource.findById(
          req.params.id
        ).populate(
          "organization",
          "name"
        );

      if (!resource) {
        return res.status(404).json({
          success: false,
          message:
            "Resource not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: resource,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

export const updateResource =
  async (req, res) => {
    try {
      const resource =
        await Resource.findByIdAndUpdate(
          req.params.id,
          req.body,
          {
            new: true,
          }
        );

      return res.status(200).json({
        success: true,
        data: resource,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

export const deleteResource =
  async (req, res) => {
    try {
      await Resource.findByIdAndDelete(
        req.params.id
      );

      return res.status(200).json({
        success: true,
        message:
          "Resource deleted successfully",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };
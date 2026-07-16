import Booking from "../models/booking.js";

export const createBooking = async (req, res) => {
  try {
    const {
      resource,
      organization,
      startTime,
      endTime,
      notes,
    } = req.body;

    const conflict = await Booking.findOne({
      resource,
      status: {
        $in: ["pending", "approved"],
      },
      startTime: {
        $lt: endTime,
      },
      endTime: {
        $gt: startTime,
      },
    });

    if (conflict) {
      return res.status(400).json({
        success: false,
        message:
          "This resource is already booked during this time",
      });
    }

    const booking = await Booking.create({
      user: req.user._id,
      resource,
      organization,
      startTime,
      endTime,
      notes,
    });

    return res.status(201).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const myBookings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
    } = req.query;

    const bookings = await Booking.find({
      user: req.user._id,
    })
      .populate(
        "resource",
        "name type"
      )
      .populate(
        "organization",
        "name"
      )
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total =
      await Booking.countDocuments({
        user: req.user._id,
      });

    return res.status(200).json({
      success: true,
      currentPage: Number(page),
      totalPages: Math.ceil(
        total / limit
      ),
      totalItems: total,
      data: bookings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getBookingById =
  async (req, res) => {
    try {
      const booking =
        await Booking.findById(
          req.params.id
        )
          .populate(
            "user",
            "firstName lastName email"
          )
          .populate(
            "resource",
            "name type"
          )
          .populate(
            "organization",
            "name"
          );

      if (!booking) {
        return res.status(404).json({
          success: false,
          message:
            "Booking not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: booking,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

export const approveBooking =
  async (req, res) => {
    try {
      const booking =
        await Booking.findByIdAndUpdate(
          req.params.id,
          {
            status: "approved",
            approvedBy:
              req.user._id,
          },
          {
            new: true,
          }
        );

      if (!booking) {
        return res.status(404).json({
          success: false,
          message:
            "Booking not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: booking,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

export const rejectBooking =
  async (req, res) => {
    try {
      const booking =
        await Booking.findByIdAndUpdate(
          req.params.id,
          {
            status: "rejected",
          },
          {
            new: true,
          }
        );

      if (!booking) {
        return res.status(404).json({
          success: false,
          message:
            "Booking not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: booking,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

export const cancelBooking =
  async (req, res) => {
    try {
      const booking =
        await Booking.findByIdAndUpdate(
          req.params.id,
          {
            status: "cancelled",
          },
          {
            new: true,
          }
        );

      if (!booking) {
        return res.status(404).json({
          success: false,
          message:
            "Booking not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: booking,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };
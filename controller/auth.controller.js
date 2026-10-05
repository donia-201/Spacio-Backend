import User from "../models/user.js";
import generateToken from "../utils/generateToken.js";
import notify from "../utils/notify.js";
import { badRequest, conflict, unauthorized } from "../utils/apiError.js";

// The shape the client needs to decide what to render. Sending the whole
// document on signup/login keeps it to one call.
const publicUser = (user) => ({
  _id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phone: user.phone ?? "",
  role: user.role,
  profileImage: user.profileImage ?? null,
  locationPermission: user.locationPermission,
  location: user.location?.coordinates ? user.location : null,
  governorate: user.governorate ?? "",
  city: user.city ?? "",
  searchRadius: user.searchRadius,
  isVerified: user.isVerified,
  createdAt: user.createdAt,
});

export const signup = async (req, res) => {
  const { firstName, lastName, email, password, phone } = req.body;

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw conflict("Email already exists");
  }

  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
    phone,
    // role / locationPermission intentionally left at their defaults:
    // "user" and "pending". Clients may not self-assign a role.
  });

  const token = generateToken({ id: user._id });

  // Kick off the flow the product wants: right after signup the user is told
  // to turn on location. The client renders a prompt until it's read.
  await notify({
    user,
    type: "welcome",
    data: { route: "/home" },
  });

  await notify({ user, type: "location_permission" });

  return res.status(201).json({
    success: true,
    message: "Account created successfully",
    token,
    data: publicUser(user),
  });
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password");

  // Same message either way so the endpoint can't be used to enumerate
  // registered email addresses.
  if (!user) throw unauthorized("Invalid email or password");

  const isMatched = await user.comparePassword(password);

  if (!isMatched) throw unauthorized("Invalid email or password");

  if (!user.isActive) throw unauthorized("This account has been disabled");

  user.lastLogin = new Date();
  await user.save();

  const token = generateToken({ id: user._id });

  return res.status(200).json({
    success: true,
    message: "Login successful",
    token,
    data: publicUser(user),
  });
};

export const getProfile = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: publicUser(req.user),
  });
};

export const updateProfile = async (req, res) => {
  const { firstName, lastName, phone, profileImage } = req.body;

  const user = await User.findById(req.user._id);

  if (!user) throw unauthorized("User not found");

  if (firstName !== undefined) user.firstName = firstName;
  if (lastName !== undefined) user.lastName = lastName;
  if (phone !== undefined) user.phone = phone;
  if (profileImage !== undefined) user.profileImage = profileImage;

  await user.save();

  return res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: publicUser(user),
  });
};

// =========================
// Location
// =========================

// Called by the client right after the browser geolocation prompt resolves.
export const updateLocation = async (req, res) => {
  const {
    latitude,
    longitude,
    governorate,
    city,
    permission = "granted",
  } = req.body;

  const user = await User.findById(req.user._id);

  if (!user) throw unauthorized("User not found");

  if (permission === "denied") {
    // Keep whatever position we already had; just remember the answer so we
    // stop showing the prompt.
    user.locationPermission = "denied";
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Location permission declined",
      data: publicUser(user),
    });
  }

  // GeoJSON order is [longitude, latitude] — the reverse of what the
  // browser gives us.
  user.location = {
    type: "Point",
    coordinates: [Number(longitude), Number(latitude)],
  };
  user.locationPermission = "granted";
  if (governorate) user.governorate = governorate;
  if (city) user.city = city;

  await user.save();

  return res.status(200).json({
    success: true,
    message: "Location saved successfully",
    data: publicUser(user),
  });
};

export const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select("+password");

  if (!user) throw unauthorized("User not found");

  const isMatched = await user.comparePassword(oldPassword);

  if (!isMatched) throw badRequest("Wrong password");

  user.password = newPassword;
  await user.save();

  return res.status(200).json({
    success: true,
    message: "Password updated successfully",
  });
};

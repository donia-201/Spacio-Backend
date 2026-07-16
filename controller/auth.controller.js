import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";

// sign up function
export const signup = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone } = req.body;

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }

    // create new user 
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      phone,
    });
// generate tokens
    const token = generateToken({
      id: user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      token,
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
 // login function 
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }
// compare passwords
    const isMatched = await user.comparePassword(password);

    if (!isMatched) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken({
      id: user._id,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getProfile = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: req.user,
  });
};

export const changePassword = async (
  req,
  res
) => {
  try {
    const { oldPassword, newPassword } =
      req.body;

    const user = await User.findById(
      req.user._id
    ).select("+password");

    const isMatched =
      await user.comparePassword(
        oldPassword
      );

    if (!isMatched) {
      return res.status(400).json({
        success: false,
        message: "Wrong password",
      });
    }

    user.password = newPassword;

    await user.save();

    return res.status(200).json({
      success: true,
      message:
        "Password updated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


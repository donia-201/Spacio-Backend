import jwt from "jsonwebtoken";

import User from "../models/user.js";

const auth = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const token = authorization.split(" ")[1];

    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      // Tell an expired token apart from a bad one, otherwise the client
      // can't tell "session expired, re-login" from "real failure".
      const expired = error.name === "TokenExpiredError";
      return res.status(401).json({
        success: false,
        message: expired ? "Session expired" : "Invalid token",
        reason: expired ? "token_expired" : "invalid_token",
      });
    }

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
        reason: "user_not_found",
      });
    }

    // A deactivated account must not keep working off an old token.
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "This account has been disabled",
        reason: "account_disabled",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
      reason: "invalid_token",
    });
  }
};

export default auth;

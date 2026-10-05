const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!roles.length) {
      return next();
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
        // Lets the client send the user somewhere useful instead of
        // showing a dead end.
        requiredRoles: roles,
        yourRole: req.user.role,
      });
    }

    next();
  };

export default authorize;

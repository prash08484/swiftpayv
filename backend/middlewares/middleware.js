const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config");

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded?.userId || decoded?.id;

    if (!decoded || !userId) {
      return res.status(401).json({ success: false, error: "Invalid token" });
    }

    const normalizedUserId = String(userId);
    req.user = { ...decoded, id: normalizedUserId };
    req.userId = normalizedUserId;
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
};

module.exports = authMiddleware;

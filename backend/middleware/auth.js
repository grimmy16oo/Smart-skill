import jwt from "jsonwebtoken";

const getJwtSecret = () =>
  process.env.JWT_SECRET || "dev-secret-change-me";

export const protect = (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res
        .status(401)
        .json({ message: "Not authorized to access this route" });
    }

    const decoded = jwt.verify(token, getJwtSecret());

    req.userId = decoded.id;
    req.user = { _id: decoded.id };

    next();
  } catch {
    return res
      .status(401)
      .json({ message: "Not authorized to access this route" });
  }
};

export const generateToken = (id) => {
  return jwt.sign({ id }, getJwtSecret(), {
    expiresIn: "30d",
  });
};

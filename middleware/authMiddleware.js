import jwt from 'jsonwebtoken';

// 1. JWT Authentication Middleware (Token එක Validate කිරීම)
export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Access denied. No authentication token provided.'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Token එකේ තියෙන user info req.user එකට දානවා
    next();
  } catch (error) {
    return res.status(401).json({
      code: 'INVALID_TOKEN',
      message: 'Invalid or expired token.'
    });
  }
};

// 2. Jurisdiction Scope Authorization Middleware (පළාත්/දිස්ත්‍රික් බලතල Check කිරීම)
export const authorizeJurisdiction = (getScopeFromReq) => {
  return (req, res, next) => {
    const userScope = req.user.jurisdiction_scope; // e.g., 'COL', 'WP', or 'ALL'
    const targetScope = getScopeFromReq(req);       // e.g., 'COL' or 'GAM'

    // National access ('ALL') තියෙන නිලධාරීන්ට ඕනෑම තැනකට Access ඇත
    if (userScope === 'ALL') {
      return next();
    }

    // User ගේ Scope එක සහ Target Scope එක සමාන නම් Access දෙන්න
    if (userScope === targetScope) {
      return next();
    }

    // Access නැත්නම් 403 Forbidden Error එක යවන්න
    return res.status(403).json({
      code: 'FORBIDDEN',
      message: 'You do not have authorization to access data for this jurisdiction.',
      details: { userScope, requestedScope: targetScope }
    });
  };
};
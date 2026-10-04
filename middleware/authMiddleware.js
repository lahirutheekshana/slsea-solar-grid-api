import jwt from 'jsonwebtoken';

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
    req.user = decoded; 
    next();
  } catch (error) {
    return res.status(401).json({
      code: 'INVALID_TOKEN',
      message: 'Invalid or expired token.'
    });
  }
};


export const authorizeJurisdiction = (getScopeFromReq) => {
  return (req, res, next) => {
    const userScope = req.user.jurisdiction_scope; 
    const targetScope = getScopeFromReq(req);       

    
    if (userScope === 'ALL') {
      return next();
    }

    
    if (userScope === targetScope) {
      return next();
    }

   
    return res.status(403).json({
      code: 'FORBIDDEN',
      message: 'You do not have authorization to access data for this jurisdiction.',
      details: { userScope, requestedScope: targetScope }
    });
  };
};
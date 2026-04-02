const User = require('../models/User');
const { getComplianceStatus } = require('../utils/compliance');

const complianceMiddleware = async (req, res, next) => {
  const user = await User.findById(req.user.userId).select('facebookId phoneVerified dateOfBirth');

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const compliance = getComplianceStatus(user);

  if (!compliance.isCompliant) {
    return res.status(403).json({
      error: 'Compliance requirements not met',
      compliance
    });
  }

  req.compliance = compliance;
  return next();
};

module.exports = { complianceMiddleware };

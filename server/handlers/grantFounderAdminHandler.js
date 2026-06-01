const { grantFounderAdminByEmailOrId } = require('../services/grantFounderAdminService');

/**
 * POST /api/owner/grant-founder-admin
 * Bootstrap: X-Owner-Grant-Secret or superadmin JWT.
 */
async function grantFounderAdminHandler(req, res) {
  try {
    const { email = '', userId = '' } = req.body || {};
    const grantedBy = req.superAdmin?.username || 'owner-grant-secret';
    const user = await grantFounderAdminByEmailOrId({ email, userId, grantedBy });
    return res.json({
      success: true,
      message: `Founder admin granted for ${user.username}`,
      user,
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error('Error granting founder admin:', error);
    return res.status(status).json({ message: error.message || 'Failed to grant founder admin' });
  }
}

module.exports = { grantFounderAdminHandler };

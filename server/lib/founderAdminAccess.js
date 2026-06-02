/** Founder account that always receives admin access in auth + UI. */
const FOUNDER_ADMIN_EMAIL = 'ericvasquez012@gmail.com';

const FULL_ADMIN_PERMISSIONS = {
  canManageShield: true,
  canManageUsers: true,
  canManagePromotions: true,
  canManagePayments: true,
  canViewAnalytics: true,
};

function isFounderAdminEmail(email) {
  return String(email || '').trim().toLowerCase() === FOUNDER_ADMIN_EMAIL;
}

/**
 * Persist admin role for the founder email when missing (safe, idempotent).
 * @param {import('mongoose').Document|null|undefined} user
 */
async function ensureFounderAdminRole(user) {
  if (!user || typeof user.save !== 'function') return user;
  if (!isFounderAdminEmail(user.email)) return user;

  const role = String(user.role || 'user');
  if (role === 'superadmin' || role === 'admin') return user;

  user.role = 'admin';
  user.adminPermissions = { ...(user.adminPermissions || {}), ...FULL_ADMIN_PERMISSIONS };
  await user.save();
  return user;
}

/** Apply founder admin flags on serialized auth payloads (works with lean docs). */
function applyFounderAdminAuthOverride(payload) {
  if (!payload || !isFounderAdminEmail(payload.email)) return payload;
  const role = String(payload.role || 'user');
  if (role === 'superadmin') {
    return {
      ...payload,
      isSuperAdmin: true,
      isAdmin: true,
      adminPermissions: FULL_ADMIN_PERMISSIONS,
    };
  }
  return {
    ...payload,
    role: 'admin',
    isSuperAdmin: false,
    isAdmin: true,
    adminPermissions: FULL_ADMIN_PERMISSIONS,
  };
}

module.exports = {
  FOUNDER_ADMIN_EMAIL,
  FULL_ADMIN_PERMISSIONS,
  isFounderAdminEmail,
  ensureFounderAdminRole,
  applyFounderAdminAuthOverride,
};

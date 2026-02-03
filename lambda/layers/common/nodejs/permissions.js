/**
 * Permission Helper Functions
 * Role-based access control for Admin vs Analyst roles
 *
 * Date: February 3, 2026
 * Phase: Phase 2 - Backend Implementation
 */

/**
 * Check if user is an admin
 * @param {Object} user - User object with user_role field
 * @returns {boolean}
 */
function isAdmin(user) {
  return user && user.user_role === 'admin';
}

/**
 * Check if user is an analyst
 * @param {Object} user - User object with user_role field
 * @returns {boolean}
 */
function isAnalyst(user) {
  return user && user.user_role === 'analyst';
}

/**
 * Check if user can create/edit/delete resources
 * Only admins can modify overlays, criteria, sessions
 * @param {Object} user - User object
 * @returns {boolean}
 */
function canEdit(user) {
  return isAdmin(user);
}

/**
 * Check if user can view all submissions (across all users)
 * @param {Object} user - User object
 * @returns {boolean}
 */
function canViewAllSubmissions(user) {
  return isAdmin(user);
}

/**
 * Check if user can view a specific submission
 * Admins can view all, analysts can view only their own
 * @param {Object} user - User object
 * @param {Object} submission - Submission object with submitted_by field
 * @returns {boolean}
 */
function canViewSubmission(user, submission) {
  if (isAdmin(user)) {
    return true;
  }

  // Analysts can only view their own submissions
  return submission.submitted_by === user.user_id;
}

/**
 * Check if user can view all notes (across all users)
 * @param {Object} user - User object
 * @returns {boolean}
 */
function canViewAllNotes(user) {
  return isAdmin(user);
}

/**
 * Check if user can view a specific note
 * Admins can view all, analysts can view only their own
 * @param {Object} user - User object
 * @param {Object} note - Note object with user_id field (creator)
 * @returns {boolean}
 */
function canViewNote(user, note) {
  if (isAdmin(user)) {
    return true;
  }

  // Analysts can only view their own notes
  return note.user_id === user.user_id;
}

/**
 * Check if user can add a note to a submission
 * Admins can add notes to any submission
 * Analysts can only add notes to their own submissions
 * @param {Object} db - Database client
 * @param {Object} user - User object
 * @param {string} submissionId - Submission UUID
 * @returns {Promise<boolean>}
 */
async function canAddNote(db, user, submissionId) {
  if (isAdmin(user)) {
    return true;
  }

  // Check if submission belongs to analyst
  const result = await db.query(
    'SELECT 1 FROM document_submissions WHERE submission_id = $1 AND submitted_by = $2',
    [submissionId, user.user_id]
  );

  return result.rows.length > 0;
}

/**
 * Check if user can edit or delete a note
 * Admins can edit any note, analysts can edit only their own
 * @param {Object} user - User object
 * @param {Object} note - Note object with user_id field
 * @returns {boolean}
 */
function canEditNote(user, note) {
  if (isAdmin(user)) {
    return true;
  }

  // Analysts can only edit their own notes
  return note.user_id === user.user_id;
}

/**
 * Check if user has access to a specific session
 * Admins have access to all sessions
 * Analysts need explicit access grant in session_access table
 * @param {Object} db - Database client
 * @param {string} userId - User UUID
 * @param {string} sessionId - Session UUID
 * @returns {Promise<boolean>}
 */
async function hasSessionAccess(db, userId, sessionId) {
  // Get user role
  const userResult = await db.query(
    'SELECT user_role FROM users WHERE user_id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    return false; // User doesn't exist
  }

  // Admins have access to all sessions
  if (userResult.rows[0].user_role === 'admin') {
    return true;
  }

  // Analysts need explicit access grant
  const accessResult = await db.query(
    'SELECT 1 FROM session_access WHERE user_id = $1 AND session_id = $2',
    [userId, sessionId]
  );

  return accessResult.rows.length > 0;
}

/**
 * Get all sessions accessible to a user
 * Admins get all sessions, analysts get only assigned sessions
 * @param {Object} db - Database client
 * @param {string} userId - User UUID
 * @returns {Promise<Array>} Array of session objects
 */
async function getAccessibleSessions(db, userId) {
  // Get user role
  const userResult = await db.query(
    'SELECT user_role FROM users WHERE user_id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    return []; // User doesn't exist
  }

  const userRole = userResult.rows[0].user_role;

  if (userRole === 'admin') {
    // Admins see all active sessions
    const result = await db.query(`
      SELECT
        session_id,
        name,
        description,
        overlay_id,
        is_active,
        created_by,
        created_at,
        updated_at
      FROM review_sessions
      WHERE is_active = true
      ORDER BY created_at DESC
    `);

    return result.rows;
  } else {
    // Analysts see only assigned sessions
    const result = await db.query(`
      SELECT DISTINCT
        rs.session_id,
        rs.name,
        rs.description,
        rs.overlay_id,
        rs.is_active,
        rs.created_by,
        rs.created_at,
        rs.updated_at
      FROM review_sessions rs
      INNER JOIN session_access sa ON rs.session_id = sa.session_id
      WHERE sa.user_id = $1
        AND rs.is_active = true
      ORDER BY rs.created_at DESC
    `, [userId]);

    return result.rows;
  }
}

/**
 * Get submissions filtered by user access
 * Admins see all, analysts see only their own
 * @param {Object} db - Database client
 * @param {Object} user - User object
 * @param {Object} filters - Optional filters (session_id, status, etc.)
 * @returns {Promise<Array>} Array of submission objects
 */
async function getAccessibleSubmissions(db, user, filters = {}) {
  let query = `
    SELECT
      ds.*,
      rs.name as session_name,
      o.name as overlay_name
    FROM document_submissions ds
    LEFT JOIN review_sessions rs ON ds.session_id = rs.session_id
    LEFT JOIN overlays o ON ds.overlay_id = o.overlay_id
    WHERE 1=1
  `;

  const params = [];
  let paramIndex = 1;

  // Apply session filter if provided
  if (filters.session_id) {
    query += ` AND ds.session_id = $${paramIndex}`;
    params.push(filters.session_id);
    paramIndex++;
  }

  // Apply role-based filtering
  if (!isAdmin(user)) {
    // Analysts see only their own submissions
    query += ` AND ds.submitted_by = $${paramIndex}`;
    params.push(user.user_id);
    paramIndex++;
  }

  query += ' ORDER BY ds.submitted_at DESC';

  const result = await db.query(query, params);
  return result.rows;
}

/**
 * Get notes filtered by user access
 * Admins see all, analysts see only their own
 * @param {Object} db - Database client
 * @param {Object} user - User object
 * @param {string} sessionId - Session UUID (optional)
 * @returns {Promise<Array>} Array of note objects
 */
async function getAccessibleNotes(db, user, sessionId = null) {
  let query = `
    SELECT
      un.*,
      u.email as creator_email,
      u.first_name || ' ' || u.last_name as creator_name
    FROM user_notes un
    JOIN users u ON un.user_id = u.user_id
    WHERE 1=1
  `;

  const params = [];
  let paramIndex = 1;

  // Apply session filter if provided
  if (sessionId) {
    query += ` AND un.session_id = $${paramIndex}`;
    params.push(sessionId);
    paramIndex++;
  }

  // Apply role-based filtering
  if (!isAdmin(user)) {
    // Analysts see only their own notes
    query += ` AND un.user_id = $${paramIndex}`;
    params.push(user.user_id);
    paramIndex++;
  }

  query += ' ORDER BY un.created_at DESC';

  const result = await db.query(query, params);
  return result.rows;
}

/**
 * Grant session access to a user (admin only)
 * @param {Object} db - Database client
 * @param {Object} adminUser - Admin user object
 * @param {string} userId - User to grant access to
 * @param {string} sessionId - Session to grant access to
 * @returns {Promise<Object>} Created access record
 */
async function grantSessionAccess(db, adminUser, userId, sessionId) {
  if (!isAdmin(adminUser)) {
    throw new Error('Only admins can grant session access');
  }

  const result = await db.query(`
    INSERT INTO session_access (user_id, session_id, granted_by)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id, session_id) DO NOTHING
    RETURNING access_id, user_id, session_id, granted_by, granted_at
  `, [userId, sessionId, adminUser.user_id]);

  return result.rows[0];
}

/**
 * Revoke session access from a user (admin only)
 * @param {Object} db - Database client
 * @param {Object} adminUser - Admin user object
 * @param {string} userId - User to revoke access from
 * @param {string} sessionId - Session to revoke access to
 * @returns {Promise<number>} Number of rows deleted
 */
async function revokeSessionAccess(db, adminUser, userId, sessionId) {
  if (!isAdmin(adminUser)) {
    throw new Error('Only admins can revoke session access');
  }

  const result = await db.query(
    'DELETE FROM session_access WHERE user_id = $1 AND session_id = $2',
    [userId, sessionId]
  );

  return result.rowCount;
}

/**
 * Get list of users with access to a session (admin only)
 * @param {Object} db - Database client
 * @param {Object} adminUser - Admin user object
 * @param {string} sessionId - Session UUID
 * @returns {Promise<Array>} Array of user access records
 */
async function getSessionAccessList(db, adminUser, sessionId) {
  if (!isAdmin(adminUser)) {
    throw new Error('Only admins can view session access list');
  }

  const result = await db.query(`
    SELECT
      sa.access_id,
      sa.user_id,
      sa.session_id,
      sa.granted_at,
      u.email,
      u.first_name,
      u.last_name,
      u.user_role,
      admin.email as granted_by_email
    FROM session_access sa
    JOIN users u ON sa.user_id = u.user_id
    LEFT JOIN users admin ON sa.granted_by = admin.user_id
    WHERE sa.session_id = $1
    ORDER BY sa.granted_at DESC
  `, [sessionId]);

  return result.rows;
}

module.exports = {
  // Role checks
  isAdmin,
  isAnalyst,

  // Permission checks
  canEdit,
  canViewAllSubmissions,
  canViewSubmission,
  canViewAllNotes,
  canViewNote,
  canAddNote,
  canEditNote,

  // Session access
  hasSessionAccess,
  getAccessibleSessions,
  grantSessionAccess,
  revokeSessionAccess,
  getSessionAccessList,

  // Filtered queries
  getAccessibleSubmissions,
  getAccessibleNotes
};

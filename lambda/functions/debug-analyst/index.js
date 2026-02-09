/**
 * Debug Lambda - Check analyst session access
 * This Lambda runs in the VPC and can access the database
 */

const { createDbConnection } = require('/opt/nodejs/db-utils');

exports.handler = async (event) => {
  const analystEmail = event.email || 'bains@futurisms.ai';

  console.log('='.repeat(70));
  console.log(`Debugging access for: ${analystEmail}`);
  console.log('='.repeat(70));

  let dbClient = null;

  try {
    dbClient = await createDbConnection();

    const results = {
      email: analystEmail,
      user: null,
      invitation: null,
      participants: [],
      accessibleSessions: [],
      summary: {}
    };

    // Step 1: Check user
    const userResult = await dbClient.query(
      'SELECT user_id, email, username, first_name, last_name, user_role FROM users WHERE email = $1',
      [analystEmail]
    );

    if (userResult.rows.length === 0) {
      results.summary.error = 'User not found in database';
      return { statusCode: 404, body: JSON.stringify(results, null, 2) };
    }

    results.user = userResult.rows[0];
    console.log('✅ User found:', results.user.user_id);

    // Step 2: Check invitation
    const invitationResult = await dbClient.query(
      `SELECT invitation_id, email, session_id, invited_by, token,
              expires_at, accepted_at, accepted_by, created_at
       FROM user_invitations
       WHERE email = $1`,
      [analystEmail]
    );

    if (invitationResult.rows.length > 0) {
      results.invitation = invitationResult.rows[0];
      console.log('✅ Invitation found:', results.invitation.invitation_id);

      // Get session name
      const sessionResult = await dbClient.query(
        'SELECT session_id, name, is_active FROM review_sessions WHERE session_id = $1',
        [results.invitation.session_id]
      );
      if (sessionResult.rows.length > 0) {
        results.invitation.session_name = sessionResult.rows[0].name;
        results.invitation.session_is_active = sessionResult.rows[0].is_active;
      }
    } else {
      console.log('❌ No invitation found');
    }

    // Step 3: Check session_participants
    const participantsResult = await dbClient.query(
      `SELECT sp.participant_id, sp.session_id, sp.user_id, sp.role,
              sp.status, sp.invited_by, sp.joined_at,
              rs.name as session_name, rs.is_active
       FROM session_participants sp
       JOIN review_sessions rs ON sp.session_id = rs.session_id
       WHERE sp.user_id = $1`,
      [results.user.user_id]
    );

    results.participants = participantsResult.rows;
    console.log(`Found ${results.participants.length} session_participants entries`);

    // Step 4: Test getAccessibleSessions query
    const accessResult = await dbClient.query(`
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
      INNER JOIN session_participants sp ON rs.session_id = sp.session_id
      WHERE sp.user_id = $1
        AND sp.status = 'active'
        AND rs.is_active = true
      ORDER BY rs.created_at DESC
    `, [results.user.user_id]);

    results.accessibleSessions = accessResult.rows;
    console.log(`Query returns ${results.accessibleSessions.length} accessible sessions`);

    // Summary
    results.summary = {
      userExists: true,
      hasInvitation: invitationResult.rows.length > 0,
      invitationAccepted: results.invitation?.accepted_at ? true : false,
      hasParticipantEntries: results.participants.length > 0,
      queryReturnsResults: results.accessibleSessions.length > 0,
      diagnosis: ''
    };

    if (!results.summary.hasParticipantEntries && results.summary.invitationAccepted) {
      results.summary.diagnosis = 'MISSING session_participants entry - invitation accepted but entry not created';
      results.summary.fix = {
        action: 'INSERT into session_participants',
        sql: `INSERT INTO session_participants (session_id, user_id, invited_by, role, status) VALUES ('${results.invitation.session_id}', '${results.user.user_id}', '${results.invitation.invited_by}', 'reviewer', 'active');`
      };
    } else if (results.summary.hasParticipantEntries && !results.summary.queryReturnsResults) {
      results.summary.diagnosis = 'session_participants exists but query doesn\'t find it - check status/is_active';
    } else if (results.summary.queryReturnsResults) {
      results.summary.diagnosis = 'Everything looks correct - analyst should see sessions';
    } else {
      results.summary.diagnosis = 'Invitation not yet accepted or user needs to complete signup';
    }

    return {
      statusCode: 200,
      body: JSON.stringify(results, null, 2)
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }, null, 2)
    };
  } finally {
    if (dbClient) await dbClient.end();
  }
};

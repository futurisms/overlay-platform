const { Client } = require('pg');

exports.handler = async (event) => {
  const dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  };

  const client = new Client(dbConfig);

  try {
    await client.connect();
    console.log('Connected to database');

    // Drop tables if they exist
    await client.query('DROP TABLE IF EXISTS session_access CASCADE');
    await client.query('DROP TABLE IF EXISTS user_invitations CASCADE');
    console.log('Dropped existing tables');

    // Create session_access table
    await client.query(`
      CREATE TABLE session_access (
        access_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        session_id UUID NOT NULL REFERENCES review_sessions(session_id) ON DELETE CASCADE,
        granted_by UUID NOT NULL REFERENCES users(user_id),
        granted_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT session_user_unique UNIQUE(user_id, session_id)
      )
    `);
    console.log('✓ Created session_access table');

    await client.query('CREATE INDEX idx_session_access_user ON session_access(user_id)');
    await client.query('CREATE INDEX idx_session_access_session ON session_access(session_id)');
    await client.query('CREATE INDEX idx_session_access_granted_by ON session_access(granted_by)');
    console.log('✓ Created session_access indexes');

    // Create user_invitations table
    await client.query(`
      CREATE TABLE user_invitations (
        invitation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) NOT NULL,
        session_id UUID NOT NULL REFERENCES review_sessions(session_id) ON DELETE CASCADE,
        invited_by UUID NOT NULL REFERENCES users(user_id),
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        accepted_at TIMESTAMPTZ,
        accepted_by UUID REFERENCES users(user_id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT email_session_unique UNIQUE(email, session_id)
      )
    `);
    console.log('✓ Created user_invitations table');

    await client.query('CREATE INDEX idx_invitations_email ON user_invitations(email)');
    await client.query('CREATE INDEX idx_invitations_token ON user_invitations(token)');
    await client.query('CREATE INDEX idx_invitations_session ON user_invitations(session_id)');
    await client.query('CREATE INDEX idx_invitations_expires ON user_invitations(expires_at)');
    await client.query('CREATE INDEX idx_invitations_invited_by ON user_invitations(invited_by)');
    console.log('✓ Created user_invitations indexes');

    // Verify tables
    const result = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('session_access', 'user_invitations')
      ORDER BY table_name
    `);

    console.log('\n=== Tables Created Successfully ===');
    result.rows.forEach(row => console.log(row.table_name));

    await client.end();

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Tables created successfully',
        tables: result.rows.map(r => r.table_name)
      })
    };

  } catch (error) {
    console.error('Error:', error);
    if (client) await client.end();

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      })
    };
  }
};

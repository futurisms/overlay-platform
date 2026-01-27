-- Add Cognito Test User to Database
-- This syncs the admin@example.com Cognito user with the database

-- First, ensure we have at least one organization (create if none exist)
INSERT INTO organizations (name, domain, subscription_tier, is_active)
VALUES ('Test Organization', 'test.example.com', 'enterprise', true)
ON CONFLICT DO NOTHING;

-- Insert or update test user with Cognito sub as user_id
INSERT INTO users (
    user_id,
    organization_id,
    email,
    username,
    password_hash,
    first_name,
    last_name,
    is_active,
    email_verified,
    created_at
)
SELECT
    'e2c51414-40b1-701b-493d-a6179aadad96'::uuid,
    o.organization_id,
    'admin@example.com',
    'admin',
    'cognito_managed',
    'Admin',
    'User',
    true,
    true,
    CURRENT_TIMESTAMP
FROM organizations o
WHERE o.is_active = true
ORDER BY o.created_at ASC
LIMIT 1
ON CONFLICT (email, organization_id) DO UPDATE
SET
    user_id = 'e2c51414-40b1-701b-493d-a6179aadad96'::uuid,
    is_active = true,
    email_verified = true,
    updated_at = CURRENT_TIMESTAMP;

-- Add admin role to test user (only if user exists)
INSERT INTO user_roles (
    user_id,
    role_name,
    granted_at
)
SELECT
    'e2c51414-40b1-701b-493d-a6179aadad96'::uuid,
    'admin',
    CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM users WHERE user_id = 'e2c51414-40b1-701b-493d-a6179aadad96'::uuid)
ON CONFLICT (user_id, role_name) DO NOTHING;

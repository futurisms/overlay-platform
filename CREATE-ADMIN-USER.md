# Creating an Admin User

This guide shows how to create an admin user in the Cognito User Pool using the provided script.

## Quick Start

```bash
# Using npm script (recommended)
npm run create-admin

# This creates a user with default credentials:
# Email: admin@example.com
# Password: TempPass123!
```

## Custom Email

```bash
# Create admin with your email
npm run create-admin -- --email your-email@example.com
```

## Custom Password

```bash
# Create admin with custom email and password
node scripts/create-admin-user.js \
  --email your-email@example.com \
  --password "YourSecurePass123!"
```

## What Gets Created

The script creates a user with:
- ✅ Email verified (no verification email needed)
- ✅ Permanent password (no forced password change)
- ✅ Membership in `system_admin` group
- ✅ Full system access

## User Groups

The Overlay Platform has three user groups:

| Group | Precedence | Permissions |
|-------|-----------|-------------|
| system_admin | 1 | Full system access - manage all features |
| document_admin | 10 | Create overlays, review submissions |
| end_user | 100 | Submit documents for review |

## Testing the New User

After creating the admin user, test authentication:

```bash
# Test login via API
curl -X POST "https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/auth" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "login",
    "email": "admin@example.com",
    "password": "TempPass123!"
  }'
```

Expected response:
```json
{
  "accessToken": "eyJra...",
  "idToken": "eyJra...",
  "refreshToken": "eyJjd...",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

## Managing Users via AWS CLI

### List All Users

```bash
aws cognito-idp list-users \
  --user-pool-id eu-west-1_lC25xZ8s6 \
  --region eu-west-1
```

### Get User Details

```bash
aws cognito-idp admin-get-user \
  --user-pool-id eu-west-1_lC25xZ8s6 \
  --username admin@example.com \
  --region eu-west-1
```

### List Users in Group

```bash
aws cognito-idp list-users-in-group \
  --user-pool-id eu-west-1_lC25xZ8s6 \
  --group-name system_admin \
  --region eu-west-1
```

### Delete User

```bash
aws cognito-idp admin-delete-user \
  --user-pool-id eu-west-1_lC25xZ8s6 \
  --username admin@example.com \
  --region eu-west-1
```

### Reset Password

```bash
aws cognito-idp admin-set-user-password \
  --user-pool-id eu-west-1_lC25xZ8s6 \
  --username admin@example.com \
  --password "NewPassword456!" \
  --permanent \
  --region eu-west-1
```

### Disable/Enable User

```bash
# Disable
aws cognito-idp admin-disable-user \
  --user-pool-id eu-west-1_lC25xZ8s6 \
  --username admin@example.com \
  --region eu-west-1

# Enable
aws cognito-idp admin-enable-user \
  --user-pool-id eu-west-1_lC25xZ8s6 \
  --username admin@example.com \
  --region eu-west-1
```

## Troubleshooting

### User Already Exists

If you see this error:
```
❌ Error: UsernameExistsException
   User already exists.
```

Delete the existing user first:
```bash
aws cognito-idp admin-delete-user \
  --user-pool-id eu-west-1_lC25xZ8s6 \
  --username admin@example.com \
  --region eu-west-1
```

### Invalid Password

Passwords must meet these requirements:
- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

Example valid passwords:
- `TempPass123!`
- `SecureAdmin456#`
- `MyPassword789$`

### AWS Credentials Not Configured

If you see credential errors, configure AWS CLI:

```bash
# Option 1: AWS CLI configure
aws configure

# Option 2: Environment variables
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_REGION=eu-west-1
```

## Script Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| --email | User email address | admin@example.com |
| --username | Cognito username (auto-set to email) | Same as email |
| --password | User password | TempPass123! |
| --given-name | First name | Admin |
| --family-name | Last name | User |

## Security Best Practices

1. **Change default password** - Replace `TempPass123!` with a secure password
2. **Use strong passwords** - Follow the password policy requirements
3. **Enable MFA** - Add multi-factor authentication for admin accounts
4. **Rotate passwords regularly** - Change passwords every 90 days
5. **Limit admin users** - Only create admin accounts when necessary
6. **Monitor login attempts** - Review CloudWatch Logs for authentication events

## Next Steps

After creating an admin user:

1. ✅ Test authentication via API
2. ✅ Change the default password
3. ✅ Enable MFA (optional but recommended)
4. ✅ Create additional users for your team
5. ✅ Test API endpoints with admin credentials
6. ✅ Upload a test document to verify the workflow

---

**User Pool ID**: `eu-west-1_lC25xZ8s6`  
**Region**: `eu-west-1`  
**API Endpoint**: `https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/`

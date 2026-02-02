# Multi-Tenant SaaS Architecture Design

**Date:** 2026-02-02
**Version:** 1.0 (Design Phase)
**Status:** Design Document (No Implementation)
**Author:** System Architecture Team

---

## Executive Summary

This document outlines the complete architectural design for converting the Overlay Platform from a single-user system to a multi-tenant SaaS platform with three distinct user roles: Super Admin, Organization Admin, and Session User.

**Current State:** Single-user system with implicit "default" organization
**Target State:** Multi-tenant SaaS with full organization isolation and role-based access control

**Key Changes:**
- Add organization entities with complete data isolation
- Implement three-tier role system (Super Admin → Org Admin → User)
- Add session-level access control
- Design secure multi-tenant architecture
- Plan migration from single-user to multi-tenant

---

## Table of Contents

1. [User Stories](#step-1-user-stories)
2. [Database Schema Design](#step-2-database-schema-design)
3. [Permission Matrix](#step-3-permission-matrix)
4. [API Design](#step-4-api-design)
5. [UI/UX Flow Diagrams](#step-5-uiux-flow-diagrams)
6. [Security Considerations](#step-6-security-considerations)
7. [Migration Strategy](#step-7-migration-strategy)
8. [Implementation Phases](#step-8-implementation-phases)
9. [Risk Assessment](#step-9-risk-assessment)
10. [Testing Strategy](#step-10-testing-strategy)

---

## STEP 1: User Stories

### Role Hierarchy

```
Super Admin (Platform Owner)
    ↓
Organization Admin (Customer Admin)
    ↓
Session User (End User)
```

---

### SUPER ADMIN User Stories

**Organization Management:**
- As a super admin, I want to **create new organization accounts** so that customers can use the platform
- As a super admin, I want to **view all organizations** to monitor platform adoption
- As a super admin, I want to **activate/deactivate organizations** to control access
- As a super admin, I want to **update organization settings** to provide support
- As a super admin, I want to **assign organization administrators** during setup

**Platform Monitoring:**
- As a super admin, I want to **view platform-wide analytics** to understand usage patterns
- As a super admin, I want to **monitor AI token consumption** across all organizations
- As a super admin, I want to **track storage usage** per organization for billing
- As a super admin, I want to **view system health metrics** to ensure uptime
- As a super admin, I want to **see error logs across all orgs** for debugging

**User Management:**
- As a super admin, I want to **view all users across all organizations** for support
- As a super admin, I want to **impersonate organization admins** for troubleshooting
- As a super admin, I want to **reset user passwords** when requested
- As a super admin, I want to **deactivate user accounts** for security reasons

**System Configuration:**
- As a super admin, I want to **configure LLM settings** (models, token limits, etc.)
- As a super admin, I want to **set platform-wide defaults** for new organizations
- As a super admin, I want to **manage API rate limits** per organization
- As a super admin, I want to **configure backup schedules** for data protection

**Billing & Subscriptions (Future):**
- As a super admin, I want to **view subscription status** for each organization
- As a super admin, I want to **manage pricing tiers** and feature access
- As a super admin, I want to **generate billing reports** for accounting

---

### ORGANIZATION ADMIN User Stories

**Organization Setup:**
- As an org admin, I want to **customize my organization profile** with logo and branding
- As an org admin, I want to **configure organization settings** (timezone, language, etc.)
- As an org admin, I want to **set default permissions** for new users
- As an org admin, I want to **manage organization billing** (view usage, invoices)

**Overlay Management:**
- As an org admin, I want to **create evaluation overlays** specific to my organization
- As an org admin, I want to **edit evaluation criteria** for my overlays
- As an org admin, I want to **share overlays** with other users in my org
- As an org admin, I want to **archive old overlays** to keep things organized
- As an org admin, I want to **duplicate overlays** to create variations

**Session Management:**
- As an org admin, I want to **create review sessions** for document evaluation
- As an org admin, I want to **assign overlays to sessions** for evaluation
- As an org admin, I want to **set session deadlines** for submissions
- As an org admin, I want to **close sessions** when review is complete
- As an org admin, I want to **export session results** for reporting

**User Management:**
- As an org admin, I want to **invite users to my organization** via email
- As an org admin, I want to **grant session access** to specific users
- As an org admin, I want to **remove users** from my organization
- As an org admin, I want to **change user roles** (promote to admin, etc.)
- As an org admin, I want to **view user activity logs** for accountability

**Access Control:**
- As an org admin, I want to **grant session access** to specific users
- As an org admin, I want to **set permission levels** (view, submit, admin)
- As an org admin, I want to **revoke access** when users leave
- As an org admin, I want to **create user groups** for bulk permissions
- As an org admin, I want to **see who has access** to each session

**Reporting & Analytics:**
- As an org admin, I want to **view all submissions** in my organization
- As an org admin, I want to **see submission statistics** (count, status, scores)
- As an org admin, I want to **export evaluation data** for external analysis
- As an org admin, I want to **compare evaluations** across sessions
- As an org admin, I want to **track AI token usage** for my org

**Collaboration:**
- As an org admin, I want to **share sessions** with specific users
- As an org admin, I want to **add notes** to submissions for reviewers
- As an org admin, I want to **assign reviewers** to submissions
- As an org admin, I want to **create approval workflows** for submissions

---

### SESSION USER User Stories

**Session Access:**
- As a session user, I want to **see only sessions I have access to** (not all org sessions)
- As a session user, I want to **request access** to additional sessions
- As a session user, I want to **receive notifications** when granted session access
- As a session user, I want to **see session deadlines** for my submissions

**Document Submission:**
- As a session user, I want to **upload documents** to sessions I have submit permission for
- As a session user, I want to **paste text** as an alternative to file upload
- As a session user, I want to **attach appendices** to my submissions
- As a session user, I want to **edit my submission** before AI analysis starts
- As a session user, I want to **delete my submission** if I made a mistake

**Results Viewing:**
- As a session user, I want to **view my submission results** after AI analysis
- As a session user, I want to **see my evaluation scores** per criterion
- As a session user, I want to **read AI feedback** on my submission
- As a session user, I want to **compare my scores** to session averages (if enabled)
- As a session user, I want to **download my results** as PDF

**Collaboration:**
- As a session user, I want to **see comments** from reviewers on my submission
- As a session user, I want to **respond to feedback** via notes
- As a session user, I want to **resubmit** after addressing feedback (if allowed)
- As a session user, I want to **track submission status** (pending, in_progress, completed)

**Notifications:**
- As a session user, I want to **receive email** when AI analysis completes
- As a session user, I want to **get notified** when reviewers add comments
- As a session user, I want to **see deadline reminders** for pending submissions

**Privacy:**
- As a session user, I want to **see only my own submissions** (not others' in the session)
- As a session user, I want to **control who can view** my submission (if allowed)
- As a session user, I want to **opt out of comparison** data (if privacy sensitive)

---

## STEP 2: Database Schema Design

### New Tables

#### 1. Organizations Table

```sql
CREATE TABLE organizations (
  organization_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100) UNIQUE,  -- e.g., 'acme' for acme.platform.com
  display_name VARCHAR(255),       -- "ACME Corporation"
  logo_url TEXT,                   -- S3 URL to org logo

  -- Contact Information
  primary_contact_email VARCHAR(255),
  support_email VARCHAR(255),

  -- Billing
  subscription_tier VARCHAR(50) DEFAULT 'free',  -- 'free', 'basic', 'pro', 'enterprise'
  billing_email VARCHAR(255),

  -- Settings
  settings JSONB DEFAULT '{}'::jsonb,  -- Org-specific settings
  branding JSONB DEFAULT '{}'::jsonb,  -- Colors, fonts, etc.

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_trial BOOLEAN DEFAULT false,
  trial_ends_at TIMESTAMP,

  -- Limits (for billing tiers)
  max_users INTEGER DEFAULT 5,
  max_sessions INTEGER DEFAULT 10,
  max_monthly_tokens INTEGER DEFAULT 100000,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,  -- Super admin who created it
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE  -- Soft delete
);

-- Indexes
CREATE INDEX idx_organizations_subdomain ON organizations(subdomain) WHERE deleted_at IS NULL;
CREATE INDEX idx_organizations_active ON organizations(is_active) WHERE deleted_at IS NULL;
```

#### 2. User Roles Table (replaces user_organizations)

```sql
CREATE TABLE user_roles (
  role_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(organization_id) ON DELETE CASCADE,

  -- Role
  role VARCHAR(50) NOT NULL,  -- 'super_admin', 'org_admin', 'user'

  -- Permissions (can override org defaults)
  permissions JSONB DEFAULT '{}'::jsonb,

  -- Status
  is_active BOOLEAN DEFAULT true,
  invited_by UUID REFERENCES users(user_id),

  -- Audit
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  assigned_by UUID REFERENCES users(user_id),
  revoked_at TIMESTAMP WITH TIME ZONE,

  -- Constraints
  CONSTRAINT valid_role CHECK (role IN ('super_admin', 'org_admin', 'user')),
  CONSTRAINT user_org_role_unique UNIQUE (user_id, organization_id)
);

-- Indexes
CREATE INDEX idx_user_roles_user ON user_roles(user_id) WHERE is_active = true;
CREATE INDEX idx_user_roles_org ON user_roles(organization_id) WHERE is_active = true;
CREATE INDEX idx_user_roles_role ON user_roles(role);
```

#### 3. Session Access Table

```sql
CREATE TABLE session_access (
  access_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES review_sessions(session_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

  -- Permission Level
  permission_level VARCHAR(50) NOT NULL DEFAULT 'view',  -- 'view', 'submit', 'admin'

  -- Access Control
  can_view_results BOOLEAN DEFAULT true,
  can_submit BOOLEAN DEFAULT false,
  can_edit_criteria BOOLEAN DEFAULT false,
  can_invite_users BOOLEAN DEFAULT false,

  -- Audit
  granted_by UUID REFERENCES users(user_id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP WITH TIME ZONE,

  -- Constraints
  CONSTRAINT valid_permission CHECK (permission_level IN ('view', 'submit', 'admin')),
  CONSTRAINT session_user_unique UNIQUE (session_id, user_id)
);

-- Indexes
CREATE INDEX idx_session_access_session ON session_access(session_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_session_access_user ON session_access(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_session_access_permission ON session_access(permission_level);
```

#### 4. User Invitations Table

```sql
CREATE TABLE user_invitations (
  invitation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,

  -- Invitation Details
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  session_id UUID REFERENCES review_sessions(session_id),  -- Optional: invite to specific session
  permission_level VARCHAR(50),  -- For session access

  -- Token
  invitation_token VARCHAR(255) UNIQUE NOT NULL,

  -- Status
  status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'accepted', 'expired', 'revoked'
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Audit
  invited_by UUID REFERENCES users(user_id),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by UUID REFERENCES users(user_id),

  -- Constraints
  CONSTRAINT valid_invitation_status CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'))
);

-- Indexes
CREATE INDEX idx_invitations_email ON user_invitations(email);
CREATE INDEX idx_invitations_token ON user_invitations(invitation_token);
CREATE INDEX idx_invitations_org ON user_invitations(organization_id);
CREATE INDEX idx_invitations_status ON user_invitations(status) WHERE status = 'pending';
```

#### 5. Activity Log Table (for audit trail)

```sql
CREATE TABLE activity_log (
  log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(organization_id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,

  -- Activity
  action VARCHAR(100) NOT NULL,  -- 'create_session', 'invite_user', 'submit_document', etc.
  resource_type VARCHAR(50),     -- 'session', 'overlay', 'submission', etc.
  resource_id UUID,

  -- Details
  details JSONB,  -- Action-specific metadata
  ip_address INET,
  user_agent TEXT,

  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_activity_log_org ON activity_log(organization_id);
CREATE INDEX idx_activity_log_user ON activity_log(user_id);
CREATE INDEX idx_activity_log_action ON activity_log(action);
CREATE INDEX idx_activity_log_created ON activity_log(created_at DESC);
```

---

### Modified Existing Tables

#### Users Table Modifications

```sql
-- Add organization-aware fields to existing users table
ALTER TABLE users
  ADD COLUMN default_organization_id UUID REFERENCES organizations(organization_id),
  ADD COLUMN last_login_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN is_super_admin BOOLEAN DEFAULT false;

-- Index
CREATE INDEX idx_users_default_org ON users(default_organization_id);
```

#### Review Sessions Table Modifications

```sql
-- Add organization ownership to sessions
ALTER TABLE review_sessions
  ADD COLUMN organization_id UUID NOT NULL REFERENCES organizations(organization_id),
  ADD COLUMN visibility VARCHAR(50) DEFAULT 'private',  -- 'private', 'org', 'public'
  ADD COLUMN allow_anonymous_submit BOOLEAN DEFAULT false;

-- Index
CREATE INDEX idx_sessions_org ON review_sessions(organization_id);
CREATE INDEX idx_sessions_visibility ON review_sessions(visibility);
```

#### Overlays Table Modifications

```sql
-- Add organization ownership to overlays
ALTER TABLE overlays
  ADD COLUMN organization_id UUID NOT NULL REFERENCES organizations(organization_id),
  ADD COLUMN visibility VARCHAR(50) DEFAULT 'private',  -- 'private', 'org', 'public'
  ADD COLUMN is_template BOOLEAN DEFAULT false;  -- Templates can be copied by other orgs

-- Index
CREATE INDEX idx_overlays_org ON overlays(organization_id);
CREATE INDEX idx_overlays_visibility ON overlays(visibility);
CREATE INDEX idx_overlays_template ON overlays(is_template) WHERE is_template = true;
```

#### Document Submissions Table Modifications

```sql
-- Add organization context and ownership
ALTER TABLE document_submissions
  ADD COLUMN organization_id UUID NOT NULL REFERENCES organizations(organization_id),
  ADD COLUMN submitted_by UUID REFERENCES users(user_id),  -- Who submitted
  ADD COLUMN is_private BOOLEAN DEFAULT true;  -- Private to submitter only

-- Index
CREATE INDEX idx_submissions_org ON document_submissions(organization_id);
CREATE INDEX idx_submissions_submitter ON document_submissions(submitted_by);
```

#### Evaluation Criteria Table Modifications

```sql
-- Link criteria to organization (for templates)
ALTER TABLE evaluation_criteria
  ADD COLUMN organization_id UUID REFERENCES organizations(organization_id);

-- Index
CREATE INDEX idx_criteria_org ON evaluation_criteria(organization_id);
```

---

### Row-Level Security (RLS) Policies

```sql
-- Enable RLS on all multi-tenant tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE overlays ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_submissions ENABLE ROW LEVEL SECURITY;

-- Example policy: Users can only see data from their organization
CREATE POLICY users_own_org_sessions ON review_sessions
  FOR ALL
  TO authenticated_users
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_roles
      WHERE user_id = current_user_id()
        AND is_active = true
    )
  );

-- Super admins can see everything
CREATE POLICY super_admins_see_all ON review_sessions
  FOR ALL
  TO authenticated_users
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE user_id = current_user_id()
        AND is_super_admin = true
    )
  );
```

---

## STEP 3: Permission Matrix

### Core Permissions Matrix

| Action | Super Admin | Org Admin | Session User |
|--------|-------------|-----------|--------------|
| **ORGANIZATIONS** |
| Create Organization | ✅ | ❌ | ❌ |
| View All Organizations | ✅ | Own Only | ❌ |
| Edit Organization Settings | ✅ | Own Only | ❌ |
| Delete Organization | ✅ | ❌ | ❌ |
| View Org Analytics | ✅ | Own Only | ❌ |
| **USERS** |
| Invite User to Org | ✅ | ✅ | ❌ |
| Remove User from Org | ✅ | ✅ | ❌ |
| Change User Role | ✅ | ✅ (not to admin) | ❌ |
| View All Org Users | ✅ | ✅ | ❌ |
| Impersonate User | ✅ | ❌ | ❌ |
| **OVERLAYS** |
| Create Overlay | ✅ | ✅ | ❌ |
| Edit Overlay | ✅ | ✅ (own) | ❌ |
| Delete Overlay | ✅ | ✅ (own) | ❌ |
| View All Org Overlays | ✅ | ✅ | View Shared |
| Share Overlay | ✅ | ✅ (own) | ❌ |
| **CRITERIA** |
| Create Criteria | ✅ | ✅ | ❌ |
| Edit Criteria | ✅ | ✅ (own overlay) | ❌ |
| Delete Criteria | ✅ | ✅ (own overlay) | ❌ |
| **SESSIONS** |
| Create Session | ✅ | ✅ | ❌ |
| Edit Session | ✅ | ✅ (own) | ❌ |
| Delete Session | ✅ | ✅ (own) | ❌ |
| View All Org Sessions | ✅ | ✅ | Accessible Only |
| Close Session | ✅ | ✅ (own) | ❌ |
| **SESSION ACCESS** |
| Grant Session Access | ✅ | ✅ (own session) | ❌ |
| Revoke Session Access | ✅ | ✅ (own session) | ❌ |
| View Access List | ✅ | ✅ (own session) | Own Access |
| **SUBMISSIONS** |
| Submit Document | ✅ | ✅ | ✅ (with access) |
| View Own Submissions | ✅ | ✅ | ✅ |
| View All Session Submissions | ✅ | ✅ (own session) | ❌ |
| View All Org Submissions | ✅ | ✅ | ❌ |
| Edit Submission | ✅ | ✅ (own) | ✅ (own, before AI) |
| Delete Submission | ✅ | ✅ (any in session) | ✅ (own only) |
| **RESULTS** |
| View Own Results | ✅ | ✅ | ✅ |
| View All Session Results | ✅ | ✅ (own session) | ❌ |
| Export Results | ✅ | ✅ (own session) | ✅ (own only) |
| **ANALYTICS** |
| Platform Analytics | ✅ | ❌ | ❌ |
| Organization Analytics | ✅ | ✅ (own) | ❌ |
| Session Analytics | ✅ | ✅ (own session) | ❌ |
| **SYSTEM** |
| Configure LLM Settings | ✅ | ❌ | ❌ |
| View System Logs | ✅ | ❌ | ❌ |
| Manage Billing | ✅ | ✅ (own org) | ❌ |

---

### Permission Levels Detail

#### Super Admin
- **Full Access:** Everything across all organizations
- **Special Powers:**
  - Create/delete organizations
  - Impersonate users for support
  - View platform-wide analytics
  - Configure global settings
- **Restrictions:** None

#### Organization Admin
- **Org Scope:** Everything within their organization
- **Special Powers:**
  - Manage org users
  - Create overlays and sessions
  - Grant session access
  - View org analytics
- **Restrictions:**
  - Cannot see other organizations
  - Cannot create super admins
  - Cannot access platform settings

#### Session User
- **Session Scope:** Only sessions they have access to
- **Permissions:**
  - Submit documents (if granted)
  - View own results
  - Download own results
- **Restrictions:**
  - Cannot create overlays/sessions
  - Cannot invite users
  - Cannot see others' submissions
  - Cannot edit criteria

---

## STEP 4: API Design

### Super Admin Endpoints

#### Organization Management

```
POST   /admin/organizations
  Body: { name, subdomain, primary_contact_email, settings }
  Returns: { organization_id, ... }
  Auth: Super Admin only

GET    /admin/organizations
  Query: ?page=1&limit=20&status=active
  Returns: { organizations: [...], total, page }
  Auth: Super Admin only

GET    /admin/organizations/{orgId}
  Returns: { organization_id, name, stats, ... }
  Auth: Super Admin only

PUT    /admin/organizations/{orgId}
  Body: { name, settings, is_active, ... }
  Returns: { organization_id, ... }
  Auth: Super Admin only

DELETE /admin/organizations/{orgId}
  Returns: { success: true }
  Auth: Super Admin only (soft delete)
```

#### Platform Analytics

```
GET    /admin/analytics/platform
  Query: ?from=2026-01-01&to=2026-02-01
  Returns: {
    total_organizations,
    total_users,
    total_submissions,
    ai_tokens_used,
    storage_used_gb,
    ...
  }
  Auth: Super Admin only

GET    /admin/analytics/organizations/{orgId}
  Returns: { organization analytics }
  Auth: Super Admin only

GET    /admin/system/health
  Returns: { database, ai_service, storage, ... }
  Auth: Super Admin only
```

---

### Organization Admin Endpoints

#### User Management

```
POST   /orgs/{orgId}/users/invite
  Body: { email, role, session_id?, permission_level? }
  Returns: { invitation_id, invitation_url }
  Auth: Org Admin (own org)

GET    /orgs/{orgId}/users
  Query: ?role=user&status=active
  Returns: { users: [...] }
  Auth: Org Admin (own org)

PUT    /orgs/{orgId}/users/{userId}/role
  Body: { role: 'user' | 'org_admin' }
  Returns: { user_id, role }
  Auth: Org Admin (own org)

DELETE /orgs/{orgId}/users/{userId}
  Returns: { success: true }
  Auth: Org Admin (own org)
```

#### Session Access Management

```
POST   /sessions/{sessionId}/access
  Body: { user_id, permission_level: 'view' | 'submit' | 'admin' }
  Returns: { access_id, ... }
  Auth: Org Admin (own session)

GET    /sessions/{sessionId}/access
  Returns: { access_list: [{ user, permission_level, granted_at }] }
  Auth: Org Admin (own session)

PUT    /sessions/{sessionId}/access/{userId}
  Body: { permission_level: 'submit' }
  Returns: { access_id, ... }
  Auth: Org Admin (own session)

DELETE /sessions/{sessionId}/access/{userId}
  Returns: { success: true }
  Auth: Org Admin (own session)
```

#### Organization Settings

```
GET    /orgs/{orgId}/settings
  Returns: { settings, branding, limits }
  Auth: Org Admin (own org)

PUT    /orgs/{orgId}/settings
  Body: { settings: {...}, branding: {...} }
  Returns: { updated settings }
  Auth: Org Admin (own org)

GET    /orgs/{orgId}/analytics
  Query: ?from=2026-01-01&to=2026-02-01
  Returns: { submissions, sessions, users, tokens_used }
  Auth: Org Admin (own org)
```

---

### Session User Endpoints

#### Session Discovery

```
GET    /my/sessions
  Query: ?status=active&page=1
  Returns: { sessions: [{ ...only accessible sessions... }] }
  Auth: Any authenticated user

GET    /my/sessions/{sessionId}
  Returns: { session details, my_access_level }
  Auth: User with session access

POST   /sessions/{sessionId}/request-access
  Body: { message: 'Please grant me access' }
  Returns: { request_id }
  Auth: Any org user
```

#### Submissions

```
GET    /my/submissions
  Query: ?session_id=...&status=completed
  Returns: { submissions: [{ ...own submissions only... }] }
  Auth: Any authenticated user

POST   /sessions/{sessionId}/submissions
  Body: { document_name, document_content, ... }
  Returns: { submission_id }
  Auth: User with 'submit' permission

GET    /submissions/{submissionId}
  Returns: { submission details, ai_results }
  Auth: Submission owner OR org admin

DELETE /submissions/{submissionId}
  Returns: { success: true }
  Auth: Submission owner OR org admin
```

---

### Modified Existing Endpoints

All existing endpoints need to be modified to:

1. **Include organization filtering:**
   ```
   GET /overlays
   → Returns only overlays from user's organization(s)
   ```

2. **Add permission checks:**
   ```
   PUT /overlays/{id}
   → Check user is org admin or super admin
   ```

3. **Add session access validation:**
   ```
   GET /sessions/{id}
   → Check user has access to this session
   ```

---

## STEP 5: UI/UX Flow Diagrams

### FLOW 1: Super Admin Creates Organization

```
┌─────────────────────────────────────────────────────────┐
│ 1. Super Admin Login                                    │
│    - Email: superadmin@platform.com                     │
│    - System validates super_admin flag                  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Navigate to Admin Dashboard                          │
│    - URL: /admin/dashboard                              │
│    - Shows platform metrics, org list                   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Click "Create Organization"                          │
│    - Opens organization creation modal                  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Fill Organization Details                            │
│    Fields:                                               │
│    - Organization Name: "ACME Corporation"              │
│    - Subdomain: "acme" (→ acme.platform.com)           │
│    - Admin Email: admin@acme.com                        │
│    - Subscription Tier: Free/Basic/Pro/Enterprise       │
│    - Settings: Timezone, Language, etc.                 │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 5. System Creates Organization                          │
│    Backend:                                              │
│    - Creates organization record                        │
│    - Creates default org admin user (if new email)      │
│    - Sends invitation email to admin                    │
│    - Initializes org settings                           │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 6. Admin Receives Email                                 │
│    Subject: "Welcome to Overlay Platform"               │
│    Content:                                              │
│    - Invitation link with token                         │
│    - Instructions to set password                       │
│    - Getting started guide                              │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 7. Org Admin Sets Up Account                            │
│    - Clicks invitation link                             │
│    - Sets password                                       │
│    - Logs in to https://acme.platform.com              │
│    - Sees empty organization dashboard                  │
└─────────────────────────────────────────────────────────┘
```

---

### FLOW 2: Org Admin Invites User to Session

```
┌─────────────────────────────────────────────────────────┐
│ 1. Org Admin Navigates to Session                      │
│    - URL: /sessions/{sessionId}                         │
│    - Sees session details, submissions                  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Click "Manage Access" Button                         │
│    - Opens access management panel                      │
│    - Shows current users with access                    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Click "Invite User"                                  │
│    Opens modal with two options:                        │
│    A) Invite existing org user                          │
│    B) Invite new user to org + session                  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Option A: Invite Existing User                       │
│    - Select user from org user list                     │
│    - Choose permission level:                           │
│      □ View only (see session, can't submit)           │
│      ☑ Submit (can upload documents)                   │
│      □ Admin (can manage access)                       │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 5. System Grants Access                                 │
│    Backend:                                              │
│    - Creates session_access record                      │
│    - Sends notification email to user                   │
│    - Logs action in activity log                        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 6. User Receives Notification                           │
│    Subject: "You've been granted access to [Session]"   │
│    Content:                                              │
│    - Session name and description                       │
│    - Link to session                                    │
│    - Permission level granted                           │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 7. User Accesses Session                                │
│    - Logs in                                            │
│    - Sees session in "My Sessions"                      │
│    - Can submit document if permission granted          │
└─────────────────────────────────────────────────────────┘
```

**Alternative: Option B (Invite New User)**

```
┌─────────────────────────────────────────────────────────┐
│ 4. Option B: Invite New User                            │
│    Fields:                                               │
│    - Email: newuser@example.com                         │
│    - Permission level: Submit                           │
│    - Optional: Add to organization as regular user      │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 5. System Creates Invitation                            │
│    Backend:                                              │
│    - Creates user_invitation record                     │
│    - Generates invitation token                         │
│    - Sends invitation email                             │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 6. New User Receives Email                              │
│    Subject: "Join [Org Name] on Overlay Platform"       │
│    Content:                                              │
│    - Invitation to organization                         │
│    - Access to specific session                         │
│    - Sign up link with token                            │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 7. New User Signs Up                                    │
│    - Clicks invitation link                             │
│    - Creates account (email, password)                  │
│    - Automatically added to org + session               │
│    - Redirected to session page                         │
└─────────────────────────────────────────────────────────┘
```

---

### FLOW 3: Session User Submits Document

```
┌─────────────────────────────────────────────────────────┐
│ 1. User Logs In                                         │
│    - URL: https://[org].platform.com/login             │
│    - Email + password authentication                    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 2. View "My Sessions"                                   │
│    Shows only sessions user has access to:              │
│    - Active sessions                                    │
│    - Permission level indicator                         │
│    - Submission deadline                                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Select Session                                       │
│    - Click on session card                              │
│    - System checks permission level                     │
│    - Shows session details + submission UI              │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Upload Document                                      │
│    Options:                                              │
│    A) Upload File (PDF, DOCX, TXT)                     │
│    B) Paste Text directly                               │
│    C) Attach appendices (optional)                      │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 5. Review and Submit                                    │
│    Shows:                                                │
│    - Document preview                                   │
│    - Evaluation criteria (read-only)                    │
│    - Submission confirmation button                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 6. System Processes Submission                          │
│    Backend:                                              │
│    - Validates user has 'submit' permission             │
│    - Stores document in S3                              │
│    - Creates submission record                          │
│    - Triggers AI workflow via Step Functions           │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 7. AI Analysis Runs                                     │
│    Status updates:                                       │
│    - Pending → In Progress → Completed                  │
│    - User sees real-time status on submission page      │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 8. User Views Results                                   │
│    - Receives email notification                        │
│    - Views scores and feedback                          │
│    - Can download PDF report                            │
│    - Only sees their own submission                     │
└─────────────────────────────────────────────────────────┘
```

---

### FLOW 4: Org Admin Views Organization Analytics

```
┌─────────────────────────────────────────────────────────┐
│ 1. Navigate to Analytics Dashboard                      │
│    - URL: /org/analytics                                │
│    - Shows org-level metrics                            │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 2. View Key Metrics                                     │
│    Displays:                                             │
│    - Total Submissions (this month)                     │
│    - Active Sessions                                    │
│    - Total Users                                        │
│    - AI Tokens Used / Limit                             │
│    - Storage Used                                       │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Filter by Date Range                                 │
│    - Select: Last 7 days, 30 days, Custom range        │
│    - Charts update dynamically                          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Drill Down into Sessions                             │
│    Shows:                                                │
│    - Session name                                       │
│    - Number of submissions                              │
│    - Average score                                      │
│    - Completion rate                                    │
│    - Click to view session details                      │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 5. Export Data                                          │
│    Options:                                              │
│    - Export as CSV (all submissions)                    │
│    - Export as PDF report (summary)                     │
│    - Schedule automated reports (future)                │
└─────────────────────────────────────────────────────────┘
```

---

## STEP 6: Security Considerations

### Authentication & Authorization

#### JWT Token Structure

```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "is_super_admin": false,
  "organizations": [
    {
      "organization_id": "uuid",
      "role": "org_admin",
      "permissions": ["create_session", "invite_user", ...]
    }
  ],
  "exp": 1609459200
}
```

**Security Requirements:**
- Token expiration: 24 hours
- Refresh token: 30 days
- Token rotation on refresh
- Invalidate on password change

---

### Row-Level Security (RLS)

#### Implementation Strategy

**1. Enable RLS on all multi-tenant tables:**
```sql
ALTER TABLE review_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE overlays ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_submissions ENABLE ROW LEVEL SECURITY;
```

**2. Create helper function for current user's orgs:**
```sql
CREATE OR REPLACE FUNCTION current_user_organizations()
RETURNS SETOF UUID
AS $$
  SELECT organization_id
  FROM user_roles
  WHERE user_id = current_setting('app.current_user_id')::uuid
    AND is_active = true
$$ LANGUAGE SQL STABLE;
```

**3. Apply policies:**
```sql
-- Users can only see sessions from their orgs
CREATE POLICY user_own_org_sessions ON review_sessions
  FOR SELECT
  USING (organization_id IN (SELECT current_user_organizations()));

-- Super admins see everything
CREATE POLICY super_admin_see_all ON review_sessions
  FOR ALL
  USING (
    (SELECT is_super_admin FROM users
     WHERE user_id = current_setting('app.current_user_id')::uuid)
  );
```

---

### Data Isolation

#### Guarantees

**1. Organization Isolation:**
- All queries MUST filter by organization_id
- Database enforces via RLS policies
- API validates org membership before operations
- Cross-org queries explicitly forbidden

**2. Session Access Control:**
- Users see only sessions they have access to
- session_access table enforces granular permissions
- Submission ownership tracked (submitted_by field)
- Private submissions hidden from other users

**3. Submission Privacy:**
- Users see only their own submissions (unless admin)
- is_private flag controls visibility
- Download URLs signed with user validation
- AI results scoped to submission owner

---

### API Security

#### Request Validation

**Every API request must:**
1. Validate JWT token
2. Extract user_id and organizations
3. Check required permission
4. Validate org ownership of resource
5. Log action to activity_log

**Example middleware:**
```javascript
async function validateOrgAccess(req, res, next) {
  const { orgId } = req.params;
  const { user_id, organizations } = req.user; // From JWT

  // Check user belongs to org
  const hasAccess = organizations.some(
    org => org.organization_id === orgId
  );

  if (!hasAccess && !req.user.is_super_admin) {
    return res.status(403).json({ error: 'Access denied' });
  }

  next();
}
```

---

### Input Validation

#### Required Validations

**Organization Creation:**
- Subdomain: alphanumeric, lowercase, 3-50 chars, unique
- Email: valid email format, not already admin
- Name: 2-255 chars, sanitized

**User Invitation:**
- Email: valid format, not already in org
- Role: must be one of: org_admin, user
- Token: cryptographically secure (32+ bytes)

**Session Access:**
- Permission level: must be: view, submit, admin
- User ID: must exist and belong to org
- Session ID: must exist and belong to org

---

### Rate Limiting

#### Per-Organization Limits

```javascript
{
  "free_tier": {
    "api_calls_per_minute": 60,
    "ai_submissions_per_day": 10,
    "storage_gb": 1,
    "max_users": 5
  },
  "basic_tier": {
    "api_calls_per_minute": 300,
    "ai_submissions_per_day": 100,
    "storage_gb": 10,
    "max_users": 25
  },
  "pro_tier": {
    "api_calls_per_minute": 1000,
    "ai_submissions_per_day": 500,
    "storage_gb": 100,
    "max_users": 100
  }
}
```

**Enforcement:**
- API Gateway rate limiting by org_id
- Lambda checks tier limits before AI processing
- Storage quota enforced on S3 upload
- User count validated on invitation

---

### Audit Logging

#### What to Log

**High-Risk Actions:**
- Organization creation/deletion
- User role changes
- Session access grants/revokes
- Data exports
- Admin impersonation
- Failed login attempts

**Example Log Entry:**
```json
{
  "log_id": "uuid",
  "organization_id": "uuid",
  "user_id": "uuid",
  "action": "grant_session_access",
  "resource_type": "session",
  "resource_id": "uuid",
  "details": {
    "target_user_id": "uuid",
    "permission_level": "submit",
    "previous_permission": null
  },
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "created_at": "2026-02-02T12:00:00Z"
}
```

---

## STEP 7: Migration Strategy

### Phase 1: Database Migration (No Downtime)

#### 1.1 Create New Tables

```sql
-- Run migrations in transaction
BEGIN;

-- Create organizations table
CREATE TABLE organizations (...);

-- Create user_roles table
CREATE TABLE user_roles (...);

-- Create session_access table
CREATE TABLE session_access (...);

-- Create user_invitations table
CREATE TABLE user_invitations (...);

-- Create activity_log table
CREATE TABLE activity_log (...);

COMMIT;
```

#### 1.2 Add Foreign Keys to Existing Tables

```sql
-- Add organization_id to existing tables (nullable at first)
ALTER TABLE users
  ADD COLUMN default_organization_id UUID REFERENCES organizations(organization_id);

ALTER TABLE review_sessions
  ADD COLUMN organization_id UUID REFERENCES organizations(organization_id);

ALTER TABLE overlays
  ADD COLUMN organization_id UUID REFERENCES organizations(organization_id);

ALTER TABLE document_submissions
  ADD COLUMN organization_id UUID REFERENCES organizations(organization_id),
  ADD COLUMN submitted_by UUID REFERENCES users(user_id);
```

---

### Phase 2: Data Migration

#### 2.1 Create Default Organization

```sql
-- Create default org for existing data
INSERT INTO organizations (
  organization_id,
  name,
  subdomain,
  display_name,
  is_active
) VALUES (
  '00000000-0000-0000-0000-000000000001',  -- Fixed UUID for default org
  'Default Organization',
  'default',
  'Default Organization',
  true
);
```

#### 2.2 Migrate Existing Users

```sql
-- Assign all existing users to default org
INSERT INTO user_roles (user_id, organization_id, role, is_active)
SELECT
  user_id,
  '00000000-0000-0000-0000-000000000001', -- Default org
  CASE
    WHEN email = 'admin@example.com' THEN 'org_admin'
    ELSE 'user'
  END,
  true
FROM users
WHERE deleted_at IS NULL;

-- Set default_organization_id for all users
UPDATE users
SET default_organization_id = '00000000-0000-0000-0000-000000000001'
WHERE deleted_at IS NULL;
```

#### 2.3 Migrate Sessions, Overlays, Submissions

```sql
-- Assign all sessions to default org
UPDATE review_sessions
SET organization_id = '00000000-0000-0000-0000-000000000001';

-- Assign all overlays to default org
UPDATE overlays
SET organization_id = '00000000-0000-0000-0000-000000000001';

-- Assign all submissions to default org
UPDATE document_submissions
SET organization_id = '00000000-0000-0000-0000-000000000001';

-- Set submitted_by to created_by for existing submissions
UPDATE document_submissions
SET submitted_by = created_by
WHERE submitted_by IS NULL;
```

#### 2.4 Make Foreign Keys NOT NULL

```sql
-- Now that all data is migrated, make org_id required
ALTER TABLE review_sessions
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE overlays
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE document_submissions
  ALTER COLUMN organization_id SET NOT NULL;
```

---

### Phase 3: Code Migration

#### 3.1 Update Backend API Handlers

**Changes needed:**
- Add organization_id filtering to all queries
- Add permission checks before mutations
- Validate user org membership
- Return only org-scoped data

**Example: Sessions GET handler**

```javascript
// BEFORE (single-tenant)
async function getSessions() {
  const query = `
    SELECT * FROM review_sessions
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
  `;
  return await db.query(query);
}

// AFTER (multi-tenant)
async function getSessions(userId) {
  // Get user's organizations
  const userOrgs = await getUserOrganizations(userId);
  const orgIds = userOrgs.map(o => o.organization_id);

  const query = `
    SELECT rs.*
    FROM review_sessions rs
    WHERE rs.organization_id = ANY($1)
      AND rs.deleted_at IS NULL
    ORDER BY rs.created_at DESC
  `;
  return await db.query(query, [orgIds]);
}
```

#### 3.2 Update Frontend

**Changes needed:**
- Add organization selector (for users in multiple orgs)
- Update navigation to show org-scoped resources
- Add permission-based UI rendering
- Update forms to include org context

---

### Phase 4: Enable Row-Level Security

```sql
-- Enable RLS on all tables
ALTER TABLE review_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE overlays ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_submissions ENABLE ROW LEVEL SECURITY;

-- Create policies (see Security Considerations section)
```

---

### Phase 5: Testing & Validation

**Test Cases:**
1. Create new organization as super admin
2. Invite user to organization
3. Create session as org admin
4. Grant session access to user
5. Submit document as user
6. Verify org isolation (cannot see other org data)
7. Verify permission enforcement
8. Test cross-org access attempts (should fail)

---

### Rollback Plan

If migration fails:

```sql
-- Disable RLS
ALTER TABLE review_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE overlays DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_submissions DISABLE ROW LEVEL SECURITY;

-- Remove organization foreign keys (set nullable)
ALTER TABLE review_sessions
  ALTER COLUMN organization_id DROP NOT NULL;

-- Restore backend to previous version
-- (git revert deployment)
```

---

## STEP 8: Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goal:** Database schema and core data model

**Tasks:**
- [ ] Create database migration for new tables
- [ ] Create default organization
- [ ] Migrate existing data to default org
- [ ] Add organization_id foreign keys to existing tables
- [ ] Create database indexes
- [ ] Test data migration thoroughly

**Deliverables:**
- Database schema updated
- All existing data assigned to default org
- Migration scripts tested
- Rollback plan documented

**Risk:** Medium (database changes)
**Effort:** 20-30 hours

---

### Phase 2: Backend API (Week 3-4)

**Goal:** Multi-tenant API endpoints

**Tasks:**
- [ ] Update existing API handlers for org filtering
- [ ] Add permission middleware
- [ ] Create super admin endpoints
- [ ] Create org admin endpoints
- [ ] Add session access endpoints
- [ ] Implement invitation system
- [ ] Add activity logging

**Deliverables:**
- All APIs org-aware
- Permission checking in place
- Invitation flow working
- API tests passing

**Risk:** High (affects all endpoints)
**Effort:** 40-60 hours

---

### Phase 3: Authentication & Authorization (Week 5-6)

**Goal:** Role-based access control

**Tasks:**
- [ ] Update JWT structure to include orgs and roles
- [ ] Implement permission checking
- [ ] Add organization context to all requests
- [ ] Create super admin UI authentication
- [ ] Test permission matrix thoroughly
- [ ] Enable Row-Level Security

**Deliverables:**
- RBAC fully implemented
- JWT includes org context
- RLS policies active
- Security tests passing

**Risk:** High (security critical)
**Effort:** 30-40 hours

---

### Phase 4: Frontend Updates (Week 7-8)

**Goal:** Multi-tenant UI

**Tasks:**
- [ ] Add organization selector (for multi-org users)
- [ ] Update navigation for org context
- [ ] Create super admin dashboard
- [ ] Create org admin dashboard
- [ ] Add user invitation UI
- [ ] Add session access management UI
- [ ] Update all forms for org awareness

**Deliverables:**
- UI supports multi-tenancy
- Admin dashboards functional
- User flows tested
- Responsive design maintained

**Risk:** Medium
**Effort:** 50-70 hours

---

### Phase 5: Testing & QA (Week 9)

**Goal:** Comprehensive testing

**Tasks:**
- [ ] Unit tests for all new code
- [ ] Integration tests for multi-tenant flows
- [ ] Security testing (penetration testing)
- [ ] Load testing with multiple orgs
- [ ] User acceptance testing
- [ ] Bug fixes and refinements

**Deliverables:**
- Test coverage > 80%
- All critical flows tested
- Security vulnerabilities addressed
- Performance benchmarks met

**Risk:** Low
**Effort:** 30-40 hours

---

### Phase 6: Documentation & Training (Week 10)

**Goal:** User and developer documentation

**Tasks:**
- [ ] Update API documentation
- [ ] Write admin user guide
- [ ] Create video tutorials
- [ ] Update CLAUDE.md with multi-tenant architecture
- [ ] Document deployment procedures
- [ ] Create runbooks for common operations

**Deliverables:**
- Complete documentation
- Training materials
- Operational runbooks
- Migration guide for existing users

**Risk:** Low
**Effort:** 20-30 hours

---

### Phase 7: Deployment (Week 11)

**Goal:** Production rollout

**Tasks:**
- [ ] Deploy to staging environment
- [ ] Run full test suite
- [ ] Deploy to production (blue-green)
- [ ] Monitor for issues
- [ ] Create first real organization
- [ ] Migrate pilot customer

**Deliverables:**
- Production deployment successful
- Monitoring in place
- Pilot customer migrated
- Rollback tested

**Risk:** Medium
**Effort:** 10-20 hours

---

**Total Estimated Effort:** 200-290 hours (5-7 weeks for single developer)

---

## STEP 9: Risk Assessment

### Critical Risks

#### 1. Data Leakage Between Organizations

**Risk:** User sees data from another organization
**Severity:** CRITICAL
**Likelihood:** Medium (without proper testing)

**Mitigation:**
- Implement Row-Level Security at database level
- Add org_id filtering to every query
- Comprehensive integration tests
- Penetration testing before launch
- Code review for all org-aware queries

**Contingency:**
- Immediate rollback capability
- Audit logs to identify leakage
- Customer notification plan

---

#### 2. Migration Data Loss

**Risk:** Existing data lost or corrupted during migration
**Severity:** CRITICAL
**Likelihood:** Low (with proper backups)

**Mitigation:**
- Full database backup before migration
- Test migration on copy of production data
- Gradual rollout (default org first)
- Verification queries after each step
- Rollback scripts prepared

**Contingency:**
- Restore from backup
- Re-run migration with fixes
- Keep old system running during migration

---

#### 3. Permission System Bypass

**Risk:** Users gain unauthorized access
**Severity:** HIGH
**Likelihood:** Medium

**Mitigation:**
- Defense in depth (database + API + frontend)
- Comprehensive permission tests
- Security audit of permission logic
- Activity logging for all sensitive actions
- Regular permission reviews

**Contingency:**
- Revoke access immediately
- Audit logs to identify extent
- Notify affected organizations

---

### High Risks

#### 4. Performance Degradation

**Risk:** Multi-tenant queries slower than single-tenant
**Severity:** HIGH
**Likelihood:** Medium

**Mitigation:**
- Database indexes on organization_id
- Query optimization
- Caching strategies
- Load testing with realistic data volumes
- Database query monitoring

**Contingency:**
- Add read replicas
- Implement query caching
- Optimize slow queries

---

#### 5. Complexity Increases Bugs

**Risk:** More complex code = more bugs
**Severity:** MEDIUM
**Likelihood:** High

**Mitigation:**
- Thorough testing (unit + integration)
- Code reviews for all changes
- Gradual rollout
- Monitoring and alerting
- Bug bounty program (future)

**Contingency:**
- Quick rollback capability
- Hotfix deployment pipeline
- Customer support escalation

---

### Medium Risks

#### 6. User Confusion (UX)

**Risk:** Users don't understand multi-tenant features
**Severity:** MEDIUM
**Likelihood:** Medium

**Mitigation:**
- Clear UI labels and help text
- Onboarding tutorials
- Admin training materials
- User feedback collection
- Iterative UX improvements

---

#### 7. Invitation System Abuse

**Risk:** Spam invitations or unauthorized access attempts
**Severity:** MEDIUM
**Likelihood:** Low

**Mitigation:**
- Rate limiting on invitations
- Email verification required
- Invitation expiration (7 days)
- Admin approval for org changes (optional)

---

## STEP 10: Testing Strategy

### Unit Testing

**Backend:**
```javascript
describe('Organization Service', () => {
  test('createOrganization creates org and admin user', async () => {
    const result = await createOrganization({
      name: 'Test Org',
      subdomain: 'test',
      admin_email: 'admin@test.com'
    });

    expect(result.organization_id).toBeDefined();
    expect(result.subdomain).toBe('test');
  });

  test('getUserOrganizations returns only user orgs', async () => {
    const orgs = await getUserOrganizations(userId);
    expect(orgs).toHaveLength(1);
    expect(orgs[0].organization_id).toBe(expectedOrgId);
  });
});
```

**Frontend:**
```javascript
describe('SessionAccess Component', () => {
  test('renders only for org admins', () => {
    const { container } = render(<SessionAccess userRole="user" />);
    expect(container.querySelector('.manage-access-btn')).toBeNull();
  });

  test('shows access list for admins', () => {
    const { getByText } = render(<SessionAccess userRole="org_admin" />);
    expect(getByText('Manage Access')).toBeInTheDocument();
  });
});
```

---

### Integration Testing

**End-to-End Scenarios:**

```javascript
describe('Multi-Tenant E2E', () => {
  test('Complete organization onboarding flow', async () => {
    // 1. Super admin creates org
    const org = await superAdmin.createOrganization({
      name: 'ACME Corp',
      subdomain: 'acme'
    });

    // 2. Org admin receives invitation
    const invitation = await getInvitation(org.admin_email);
    expect(invitation).toBeDefined();

    // 3. Admin accepts and sets password
    await acceptInvitation(invitation.token, 'password123');

    // 4. Admin logs in
    const session = await login('admin@acme.com', 'password123');
    expect(session.user.organizations).toContainEqual(
      expect.objectContaining({ organization_id: org.organization_id })
    );

    // 5. Admin creates overlay
    const overlay = await createOverlay(session, {
      name: 'Test Overlay',
      organization_id: org.organization_id
    });

    // 6. Admin invites user to session
    const invitation2 = await inviteUserToSession(session, {
      email: 'user@example.com',
      session_id: sessionId,
      permission_level: 'submit'
    });

    // 7. User accepts and submits document
    await acceptInvitation(invitation2.token, 'password456');
    const userSession = await login('user@example.com', 'password456');
    const submission = await submitDocument(userSession, {
      session_id: sessionId,
      document_content: 'Test document'
    });

    expect(submission.submission_id).toBeDefined();
  });
});
```

---

### Security Testing

**Permission Tests:**

```javascript
describe('Permission Enforcement', () => {
  test('User cannot see other org sessions', async () => {
    const userA = await login('userA@orgA.com', 'password');
    const orgBSession = createSession({ organization_id: orgB.id });

    const sessions = await getSessions(userA.token);
    expect(sessions).not.toContainEqual(
      expect.objectContaining({ session_id: orgBSession.id })
    );
  });

  test('User cannot grant session access without admin role', async () => {
    const user = await login('user@org.com', 'password');

    await expect(
      grantSessionAccess(user.token, {
        session_id: sessionId,
        user_id: otherUserId,
        permission_level: 'submit'
      })
    ).rejects.toThrow('Access denied');
  });
});
```

---

### Load Testing

**Scenarios:**

1. **Multi-Organization Concurrent Access:**
   - 100 users across 10 organizations
   - Simultaneous session access
   - Verify no cross-org data leakage
   - Measure response times

2. **Bulk Invitation:**
   - Invite 100 users to organization
   - Measure email sending performance
   - Verify invitation token uniqueness

3. **Session Submission Spike:**
   - 50 users submit documents simultaneously
   - Verify AI queue handling
   - Measure end-to-end processing time

**Tools:**
- Artillery or k6 for load generation
- CloudWatch metrics for monitoring
- Database query profiling

---

### User Acceptance Testing

**Test Groups:**

1. **Super Admin:**
   - Create 3 test organizations
   - Monitor platform analytics
   - Impersonate org admin
   - Verify data isolation

2. **Org Admin:**
   - Customize organization
   - Create overlays and sessions
   - Invite users
   - Manage session access
   - View org analytics

3. **Session User:**
   - Accept invitation
   - View accessible sessions
   - Submit documents
   - View results
   - Verify privacy (can't see others' submissions)

---

## Appendix A: Database ERD

```
┌─────────────────────┐
│  organizations      │
├─────────────────────┤
│ organization_id PK  │
│ name                │
│ subdomain (unique)  │
│ settings JSONB      │
│ is_active           │
└─────────────────────┘
           │
           │ 1:N
           ↓
┌─────────────────────┐      ┌─────────────────────┐
│  users              │──┬──→│  user_roles         │
├─────────────────────┤  │   ├─────────────────────┤
│ user_id PK          │  │   │ role_id PK          │
│ email (unique)      │  │   │ user_id FK          │
│ password_hash       │  │   │ organization_id FK  │
│ is_super_admin      │  │   │ role (enum)         │
└─────────────────────┘  │   │ is_active           │
           │              │   └─────────────────────┘
           │ 1:N          │
           ↓              │
┌─────────────────────┐  │
│  review_sessions    │  │
├─────────────────────┤  │
│ session_id PK       │  │
│ organization_id FK  │←─┘
│ overlay_id FK       │
│ name                │
└─────────────────────┘
           │
           │ 1:N
           ↓
┌─────────────────────┐      ┌─────────────────────┐
│  session_access     │      │  document_          │
├─────────────────────┤      │  submissions        │
│ access_id PK        │      ├─────────────────────┤
│ session_id FK       │      │ submission_id PK    │
│ user_id FK          │      │ organization_id FK  │
│ permission_level    │      │ session_id FK       │
│ granted_by FK       │      │ submitted_by FK     │
└─────────────────────┘      │ document_name       │
                             │ s3_key              │
                             └─────────────────────┘
```

---

## Appendix B: Sample API Requests

### Create Organization (Super Admin)

```bash
POST /admin/organizations
Authorization: Bearer {super_admin_jwt}

{
  "name": "ACME Corporation",
  "subdomain": "acme",
  "primary_contact_email": "admin@acme.com",
  "subscription_tier": "pro",
  "settings": {
    "timezone": "America/New_York",
    "language": "en"
  }
}

Response 201:
{
  "organization_id": "uuid",
  "name": "ACME Corporation",
  "subdomain": "acme",
  "admin_user": {
    "user_id": "uuid",
    "email": "admin@acme.com",
    "invitation_sent": true
  },
  "created_at": "2026-02-02T12:00:00Z"
}
```

### Invite User to Session (Org Admin)

```bash
POST /orgs/{orgId}/users/invite
Authorization: Bearer {org_admin_jwt}

{
  "email": "user@example.com",
  "session_id": "session-uuid",
  "permission_level": "submit"
}

Response 201:
{
  "invitation_id": "uuid",
  "email": "user@example.com",
  "invitation_url": "https://platform.com/invite/{token}",
  "expires_at": "2026-02-09T12:00:00Z"
}
```

### Get My Sessions (User)

```bash
GET /my/sessions
Authorization: Bearer {user_jwt}

Response 200:
{
  "sessions": [
    {
      "session_id": "uuid",
      "name": "Q1 Grant Applications",
      "organization": {
        "organization_id": "uuid",
        "name": "ACME Corporation"
      },
      "my_access": {
        "permission_level": "submit",
        "granted_at": "2026-02-01T10:00:00Z"
      },
      "deadline": "2026-02-15T23:59:59Z",
      "my_submissions": 2
    }
  ],
  "total": 1
}
```

---

## Conclusion

This design document provides a comprehensive blueprint for converting the Overlay Platform into a multi-tenant SaaS application. Key features include:

- **Three-tier role system** (Super Admin, Org Admin, User)
- **Complete data isolation** at organization level
- **Granular session access control** for collaboration
- **Secure authentication** with RBAC
- **Comprehensive audit logging** for accountability
- **Phased implementation** plan (10-11 weeks)
- **Migration strategy** from single-tenant to multi-tenant

**Next Steps:**
1. Review this design with stakeholders
2. Prioritize features (MVP vs future)
3. Begin Phase 1 (database migration)
4. Iterative development and testing
5. Pilot with early customers
6. Production rollout

**Status:** Design Complete - Ready for Implementation Planning

---

**END OF DESIGN DOCUMENT**

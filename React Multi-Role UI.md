---
name: react-multi-role-ui
description: Permission-aware React component patterns for multi-role applications. Use when building role-based UIs, conditional rendering by user role, admin-only components, protected routes, or role-aware navigation. Covers user context patterns, permission hooks, conditional rendering best practices, and UI security. Prevents exposing admin UI to regular users, ensures consistent permission checks, and creates better UX for different roles. Essential for any React app with multiple user roles.
---

# React Multi-Role UI

Proven patterns for building permission-aware React interfaces.

## Core Principles

### 1. User Context for Role Information
**Centralize user/role state:**
- Single source of truth for current user
- Available throughout component tree
- Easy to check permissions anywhere

### 2. Conditional Rendering is UX, Not Security
**Hide UI elements for better UX:**
- Don't show admin buttons to regular users
- Reduce cognitive load
- BUT: Always enforce permissions in backend

### 3. Fail Gracefully
**Handle permission errors well:**
- Show meaningful error messages
- Redirect to appropriate page
- Don't crash the app

## UI Component Best Practices

### Use Component Library, Not Browser Defaults

**CRITICAL:** Always use your component library (shadcn/ui, Material-UI, etc.) instead of browser defaults for professional, consistent UX.

### Confirmation Dialogs
**❌ DON'T use browser defaults:**
```javascript
// Bad: Browser window.confirm()
const confirmed = window.confirm('Delete this item?');
if (confirmed) {
  deleteItem();
}
```

**Problems with window.confirm():**
- Ugly, inconsistent appearance across browsers
- Cannot customize styling or layout
- Blocks the entire page (modal)
- No loading states or feedback
- Poor UX on mobile
- Looks unprofessional

**✅ DO use component library dialogs:**
```javascript
// Good: shadcn/ui AlertDialog
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function MyComponent() {
  const [showDialog, setShowDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await deleteItem();
      toast.success('Item deleted');
      setShowDialog(false);
    } catch (error) {
      toast.error('Failed to delete item');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <button onClick={() => setShowDialog(true)}>Delete</button>
      
      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the item.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

**Benefits:**
- Professional, branded appearance
- Consistent with app design system
- Loading states built-in
- Better error handling
- Mobile-friendly
- Customizable styling
- Smooth animations

### Notifications & Alerts
**❌ DON'T use browser alerts:**
```javascript
// Bad: Browser window.alert()
window.alert('Item deleted successfully!');
```

**Problems with window.alert():**
- Blocks entire page until dismissed
- Cannot customize appearance
- Poor UX (intrusive)
- No auto-dismiss
- Looks unprofessional

**✅ DO use toast notifications:**
```javascript
// Good: Toast notifications (sonner, react-hot-toast, etc.)
import { toast } from 'sonner';

function MyComponent() {
  async function handleSave() {
    try {
      await saveData();
      toast.success('Saved successfully!');
    } catch (error) {
      toast.error('Failed to save. Please try again.');
    }
  }
  
  return <button onClick={handleSave}>Save</button>;
}
```

**Benefits:**
- Non-blocking (doesn't interrupt user)
- Auto-dismissable
- Stackable (multiple toasts)
- Consistent styling
- Professional appearance
- Can include actions (undo, retry)

### Loading States
**❌ DON'T use generic disabled state:**
```javascript
// Bad: No loading feedback
<button disabled={isLoading} onClick={handleSubmit}>
  Submit
</button>
```

**✅ DO use explicit loading UI:**
```javascript
// Good: Clear loading state with spinner
import { Loader2 } from 'lucide-react';

<button disabled={isLoading} onClick={handleSubmit}>
  {isLoading ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Processing...
    </>
  ) : (
    'Submit'
  )}
</button>
```

**Benefits:**
- Clear feedback to user
- Shows progress
- Prevents confusion
- Professional appearance

### Error Handling UI
**❌ DON'T use browser prompts:**
```javascript
// Bad: Browser prompt for errors
window.alert('Error: ' + error.message);
```

**✅ DO use inline errors or error boundaries:**
```javascript
// Good: Inline error display
function MyForm() {
  const [error, setError] = useState(null);
  
  async function handleSubmit() {
    setError(null);
    try {
      await submitData();
      toast.success('Submitted successfully');
    } catch (err) {
      setError(err.message);
    }
  }
  
  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-4">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}
      {/* form fields */}
    </form>
  );
}
```

### Admin Action Patterns
**For admin-only destructive actions:**
```javascript
// Pattern: Admin button with confirmation + loading + feedback
function AdminActionButton({ itemId, itemName }) {
  const { isAdmin } = useUser();
  const [showDialog, setShowDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  if (!isAdmin) return null; // Hide from non-admins
  
  async function handleAction() {
    setIsProcessing(true);
    try {
      await performAdminAction(itemId);
      toast.success(`${itemName} removed successfully`);
      setShowDialog(false);
      // Refresh data or update state
    } catch (error) {
      toast.error('Action failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }
  
  return (
    <>
      <button 
        onClick={() => setShowDialog(true)}
        className="text-red-600 hover:text-red-800"
      >
        Remove
      </button>
      
      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Action</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {itemName}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleAction();
              }}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700"
            >
              {isProcessing ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

### Quick Reference: Component Choices

| Scenario | ❌ Don't Use | ✅ Use Instead |
|----------|-------------|---------------|
| Confirmation | window.confirm() | AlertDialog component |
| Success message | window.alert() | toast.success() |
| Error message | window.alert() | toast.error() or inline error |
| User input | window.prompt() | Modal with form |
| Loading state | Disabled button | Button with spinner + text |
| Destructive action | Confirm + delete | Dialog + confirmation + loading |

## User Context Pattern

### Create User Context
```javascript
// contexts/UserContext.js
import { createContext, useContext, useState, useEffect } from 'react';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Load user from localStorage or API
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);
  
  const login = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };
  
  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };
  
  const isAdmin = user?.user_role === 'admin';
  const isAnalyst = user?.user_role === 'analyst';
  
  return (
    <UserContext.Provider value={{ 
      user, 
      loading,
      isAdmin, 
      isAnalyst,
      login, 
      logout 
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
}
```

### Wrap App with Provider
```javascript
// App.js
import { UserProvider } from './contexts/UserContext';

function App() {
  return (
    <UserProvider>
      <Router>
        <Routes>
          {/* Your routes */}
        </Routes>
      </Router>
    </UserProvider>
  );
}
```

## Conditional Rendering Patterns

### Pattern 1: Simple Role Check
```javascript
import { useUser } from '../contexts/UserContext';

function SessionDetail({ session }) {
  const { user, isAdmin } = useUser();
  
  return (
    <div>
      <h1>{session.name}</h1>
      
      {/* Show to everyone */}
      <button onClick={handleSubmit}>Submit Document</button>
      
      {/* Show only to admins */}
      {isAdmin && (
        <button onClick={handleInvite}>Invite Analyst</button>
      )}
      
      {isAdmin && (
        <button onClick={handleEdit}>Edit Criteria</button>
      )}
      
      {isAdmin && (
        <button onClick={handleArchive}>Archive Session</button>
      )}
    </div>
  );
}
```

### Pattern 2: Role-Based Component Selection
```javascript
function Dashboard() {
  const { isAdmin } = useUser();
  
  if (isAdmin) {
    return <AdminDashboard />;
  }
  
  return <AnalystDashboard />;
}
```

### Pattern 3: Permission-Based Sections
```javascript
function SubmissionDetail({ submission }) {
  const { user, isAdmin } = useUser();
  const isOwner = submission.created_by === user.user_id;
  
  return (
    <div>
      <h2>{submission.title}</h2>
      
      {/* Everyone sees results */}
      <ResultsSection results={submission.results} />
      
      {/* Only owner or admin can edit */}
      {(isOwner || isAdmin) && (
        <button onClick={handleEdit}>Edit</button>
      )}
      
      {/* Only owner or admin can delete */}
      {(isOwner || isAdmin) && (
        <button onClick={handleDelete}>Delete</button>
      )}
      
      {/* Only admin sees analytics */}
      {isAdmin && (
        <AnalyticsSection submission={submission} />
      )}
    </div>
  );
}
```

## Protected Routes Pattern

### Create Protected Route Component
```javascript
// components/ProtectedRoute.js
import { Navigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';

export function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, loading, isAdmin } = useUser();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" />;
  }
  
  return children;
}
```

### Use in Routes
```javascript
// App.js
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      
      {/* Protected routes (any logged-in user) */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      
      <Route path="/my-analyses" element={
        <ProtectedRoute>
          <MyAnalyses />
        </ProtectedRoute>
      } />
      
      {/* Admin-only routes */}
      <Route path="/create-session" element={
        <ProtectedRoute requireAdmin>
          <CreateSession />
        </ProtectedRoute>
      } />
      
      <Route path="/manage-users" element={
        <ProtectedRoute requireAdmin>
          <ManageUsers />
        </ProtectedRoute>
      } />
      
      <Route path="/analytics" element={
        <ProtectedRoute requireAdmin>
          <Analytics />
        </ProtectedRoute>
      } />
    </Routes>
  );
}
```

## Navigation Patterns

### Role-Based Navigation Menu
```javascript
function Navigation() {
  const { user, isAdmin, logout } = useUser();
  
  return (
    <nav>
      <div className="nav-brand">My App</div>
      
      <ul className="nav-links">
        {/* Everyone sees these */}
        <li><Link to="/dashboard">Dashboard</Link></li>
        <li><Link to="/my-analyses">My Analyses</Link></li>
        
        {/* Admin-only links */}
        {isAdmin && (
          <>
            <li><Link to="/create-session">Create Session</Link></li>
            <li><Link to="/manage-users">Manage Users</Link></li>
            <li><Link to="/analytics">Analytics</Link></li>
          </>
        )}
      </ul>
      
      <div className="nav-user">
        <span>{user.name}</span>
        <span className="role-badge">{user.user_role}</span>
        <button onClick={logout}>Logout</button>
      </div>
    </nav>
  );
}
```

### Breadcrumb with Permissions
```javascript
function Breadcrumb({ session }) {
  const { isAdmin } = useUser();
  
  return (
    <div className="breadcrumb">
      <Link to="/dashboard">Dashboard</Link>
      <span> / </span>
      
      {isAdmin ? (
        <Link to="/sessions">All Sessions</Link>
      ) : (
        <span>My Sessions</span>
      )}
      
      <span> / </span>
      <span>{session.name}</span>
    </div>
  );
}
```

## Form Patterns

### Permission-Aware Form Fields
```javascript
function UserProfileForm({ userId }) {
  const { user, isAdmin } = useUser();
  const [profile, setProfile] = useState(null);
  
  const isOwnProfile = userId === user.user_id;
  const canEdit = isOwnProfile || isAdmin;
  
  return (
    <form>
      <input
        type="text"
        value={profile?.name}
        onChange={(e) => setProfile({ ...profile, name: e.target.value })}
        disabled={!canEdit}
      />
      
      <input
        type="email"
        value={profile?.email}
        onChange={(e) => setProfile({ ...profile, email: e.target.value })}
        disabled={!canEdit}
      />
      
      {/* Only admin can change role */}
      {isAdmin && (
        <select
          value={profile?.user_role}
          onChange={(e) => setProfile({ ...profile, user_role: e.target.value })}
        >
          <option value="admin">Admin</option>
          <option value="analyst">Analyst</option>
        </select>
      )}
      
      {canEdit && (
        <button type="submit">Save Changes</button>
      )}
    </form>
  );
}
```

### Conditional Form Validation
```javascript
function SessionForm() {
  const { isAdmin } = useUser();
  
  const validate = (values) => {
    const errors = {};
    
    if (!values.name) {
      errors.name = 'Required';
    }
    
    // Admin-only fields
    if (isAdmin) {
      if (!values.max_participants) {
        errors.max_participants = 'Required';
      }
      
      if (!values.budget) {
        errors.budget = 'Required';
      }
    }
    
    return errors;
  };
  
  return (
    <Formik
      initialValues={{ name: '', max_participants: '', budget: '' }}
      validate={validate}
      onSubmit={handleSubmit}
    >
      {/* Form fields */}
      
      {/* Admin sees extra fields */}
      {isAdmin && (
        <>
          <Field name="max_participants" />
          <Field name="budget" />
        </>
      )}
    </Formik>
  );
}
```

## Data Display Patterns

### Filtered Lists by Role
```javascript
function SubmissionsList() {
  const { user, isAdmin } = useUser();
  const [submissions, setSubmissions] = useState([]);
  
  useEffect(() => {
    fetchSubmissions();
  }, []);
  
  async function fetchSubmissions() {
    // API automatically filters by role
    const response = await fetch('/api/submissions', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    const data = await response.json();
    setSubmissions(data);
  }
  
  return (
    <div>
      <h2>
        {isAdmin ? 'All Submissions' : 'My Submissions'}
      </h2>
      
      <p>
        {isAdmin 
          ? `Showing ${submissions.length} submissions from all users`
          : `Showing ${submissions.length} of your submissions`
        }
      </p>
      
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Session</th>
            <th>Score</th>
            
            {/* Admin sees extra columns */}
            {isAdmin && <th>Submitted By</th>}
            {isAdmin && <th>Tokens Used</th>}
            
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map(sub => (
            <SubmissionRow 
              key={sub.id} 
              submission={sub} 
              showExtended={isAdmin}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Role-Specific Metrics
```javascript
function DashboardStats() {
  const { isAdmin } = useUser();
  const [stats, setStats] = useState(null);
  
  if (isAdmin) {
    return (
      <div className="stats-grid">
        <StatCard title="Total Users" value={stats.totalUsers} />
        <StatCard title="Total Sessions" value={stats.totalSessions} />
        <StatCard title="Total Submissions" value={stats.totalSubmissions} />
        <StatCard title="Total Cost" value={`$${stats.totalCost}`} />
      </div>
    );
  }
  
  return (
    <div className="stats-grid">
      <StatCard title="My Sessions" value={stats.mySessions} />
      <StatCard title="My Submissions" value={stats.mySubmissions} />
      <StatCard title="Avg Score" value={stats.avgScore} />
    </div>
  );
}
```

## Modal/Dialog Patterns

### Permission-Gated Modals
```javascript
function InvitationModal({ session, isOpen, onClose }) {
  const { isAdmin } = useUser();
  
  // Don't even render if not admin
  if (!isAdmin) {
    return null;
  }
  
  if (!isOpen) {
    return null;
  }
  
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2>Invite Analyst to {session.name}</h2>
      <InvitationForm sessionId={session.id} onSuccess={onClose} />
    </Modal>
  );
}

// Usage
function SessionDetail({ session }) {
  const { isAdmin } = useUser();
  const [showInviteModal, setShowInviteModal] = useState(false);
  
  return (
    <div>
      {isAdmin && (
        <button onClick={() => setShowInviteModal(true)}>
          Invite Analyst
        </button>
      )}
      
      <InvitationModal
        session={session}
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />
    </div>
  );
}
```

## Error Handling Patterns

### Permission Error Display
```javascript
function SubmissionDetail({ id }) {
  const [submission, setSubmission] = useState(null);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    fetchSubmission();
  }, [id]);
  
  async function fetchSubmission() {
    try {
      const response = await fetch(`/api/submissions/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.status === 403) {
        setError('You do not have permission to view this submission.');
        return;
      }
      
      if (response.status === 404) {
        setError('Submission not found.');
        return;
      }
      
      const data = await response.json();
      setSubmission(data);
    } catch (err) {
      setError('Failed to load submission.');
    }
  }
  
  if (error) {
    return (
      <div className="error-message">
        <h2>Access Denied</h2>
        <p>{error}</p>
        <Link to="/dashboard">Return to Dashboard</Link>
      </div>
    );
  }
  
  if (!submission) {
    return <div>Loading...</div>;
  }
  
  return <SubmissionView submission={submission} />;
}
```

## Custom Hooks for Permissions

### usePermission Hook
```javascript
// hooks/usePermission.js
import { useUser } from '../contexts/UserContext';

export function usePermission() {
  const { user, isAdmin } = useUser();
  
  const canCreate = (resource) => {
    if (resource === 'overlay' || resource === 'session') {
      return isAdmin;
    }
    return true; // Anyone can create submissions
  };
  
  const canEdit = (resource) => {
    if (resource === 'overlay' || resource === 'session') {
      return isAdmin;
    }
    return resource.created_by === user.user_id || isAdmin;
  };
  
  const canDelete = (resource) => {
    if (resource === 'overlay' || resource === 'session') {
      return isAdmin;
    }
    return resource.created_by === user.user_id || isAdmin;
  };
  
  const canView = (resource) => {
    return resource.created_by === user.user_id || isAdmin;
  };
  
  return { canCreate, canEdit, canDelete, canView };
}

// Usage
function SubmissionActions({ submission }) {
  const { canEdit, canDelete } = usePermission();
  
  return (
    <div>
      {canEdit(submission) && (
        <button onClick={handleEdit}>Edit</button>
      )}
      
      {canDelete(submission) && (
        <button onClick={handleDelete}>Delete</button>
      )}
    </div>
  );
}
```

### useSessionAccess Hook
```javascript
// hooks/useSessionAccess.js
import { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';

export function useSessionAccess(sessionId) {
  const { user, isAdmin } = useUser();
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    checkAccess();
  }, [sessionId]);
  
  async function checkAccess() {
    if (isAdmin) {
      setHasAccess(true);
      setLoading(false);
      return;
    }
    
    try {
      const response = await fetch(`/api/sessions/${sessionId}/access`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      setHasAccess(response.ok);
    } catch (err) {
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  }
  
  return { hasAccess, loading };
}

// Usage
function SessionDetail({ sessionId }) {
  const { hasAccess, loading } = useSessionAccess(sessionId);
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (!hasAccess) {
    return (
      <div>
        <h2>Access Denied</h2>
        <p>You do not have access to this session.</p>
        <Link to="/dashboard">Return to Dashboard</Link>
      </div>
    );
  }
  
  return <SessionContent sessionId={sessionId} />;
}
```

## Styling Patterns

### Role-Based Styling
```javascript
function UserBadge({ user }) {
  const badgeClass = user.user_role === 'admin' 
    ? 'badge badge-admin' 
    : 'badge badge-analyst';
  
  return (
    <span className={badgeClass}>
      {user.user_role}
    </span>
  );
}

// CSS
.badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.badge-admin {
  background: #dc2626;
  color: white;
}

.badge-analyst {
  background: #3b82f6;
  color: white;
}
```

## Testing Patterns

### Testing with Different Roles
```javascript
// UserProfilePage.test.js
import { render, screen } from '@testing-library/react';
import { UserProvider } from '../contexts/UserContext';
import UserProfilePage from './UserProfilePage';

describe('UserProfilePage', () => {
  test('shows edit button for admin', () => {
    const admin = { user_id: '1', user_role: 'admin' };
    
    render(
      <UserProvider value={{ user: admin, isAdmin: true }}>
        <UserProfilePage userId="2" />
      </UserProvider>
    );
    
    expect(screen.getByText('Edit Profile')).toBeInTheDocument();
  });
  
  test('hides edit button for non-owner analyst', () => {
    const analyst = { user_id: '1', user_role: 'analyst' };
    
    render(
      <UserProvider value={{ user: analyst, isAdmin: false }}>
        <UserProfilePage userId="2" />
      </UserProvider>
    );
    
    expect(screen.queryByText('Edit Profile')).not.toBeInTheDocument();
  });
  
  test('shows edit button for own profile', () => {
    const analyst = { user_id: '1', user_role: 'analyst' };
    
    render(
      <UserProvider value={{ user: analyst, isAdmin: false }}>
        <UserProfilePage userId="1" />
      </UserProvider>
    );
    
    expect(screen.getByText('Edit Profile')).toBeInTheDocument();
  });
});
```

## Best Practices

### 1. Always Have Fallback UI
```javascript
// ✅ Good: Clear fallback
{isAdmin ? (
  <AdminPanel />
) : (
  <p>Admin access required</p>
)}

// ❌ Bad: No fallback
{isAdmin && <AdminPanel />}
```

### 2. Use Semantic Role Names
```javascript
// ✅ Good
const { isAdmin, isAnalyst, isManager } = useUser();

// ❌ Bad
const { isRole1, isRole2, isRole3 } = useUser();
```

### 3. Centralize Permission Logic
```javascript
// ✅ Good: Single source of truth
const { canEdit } = usePermission();

// ❌ Bad: Scattered checks
{user.role === 'admin' || user.id === resource.owner}
```

### 4. Show Loading States
```javascript
// ✅ Good: Handle loading
if (loading) return <Spinner />;
if (!user) return <Navigate to="/login" />;

// ❌ Bad: Instant redirect
if (!user) return <Navigate to="/login" />;
```

## Quick Reference

### Component Checklist
- [ ] Import useUser hook
- [ ] Destructure needed values (user, isAdmin, etc.)
- [ ] Conditionally render based on role
- [ ] Handle loading state
- [ ] Handle no-permission state
- [ ] Test with different roles

### Route Protection Checklist
- [ ] Wrap in ProtectedRoute
- [ ] Specify requireAdmin if needed
- [ ] Handle redirect destination
- [ ] Show loading state
- [ ] Test navigation with different roles

---

**Remember:** Frontend permissions are for UX, not security. Always enforce permissions in the backend!

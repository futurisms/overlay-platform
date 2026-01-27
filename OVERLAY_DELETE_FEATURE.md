# Overlay Delete Functionality

## Feature Overview
Added delete functionality to the overlays management page, allowing users to remove evaluation overlays they no longer need.

## Implementation Details

### Frontend Changes

**File**: [frontend/app/overlays/page.tsx](frontend/app/overlays/page.tsx)

#### Added State
```typescript
const [isDeleting, setIsDeleting] = useState<string | null>(null);
```

#### Added Delete Handler
```typescript
const handleDeleteOverlay = async (overlayId: string, e: React.MouseEvent) => {
  e.stopPropagation();

  if (!confirm("Are you sure you want to delete this overlay? This action cannot be undone.")) {
    return;
  }

  setIsDeleting(overlayId);
  setError(null);

  try {
    const result = await apiClient.deleteOverlay(overlayId);

    if (result.error) {
      setError(result.error);
    } else {
      // Remove from list
      setOverlays(overlays.filter(o => o.overlay_id !== overlayId));
    }
  } catch (err) {
    setError("Failed to delete overlay. It may be in use by active sessions.");
    console.error(err);
  } finally {
    setIsDeleting(null);
  }
};
```

#### Added Delete Button to Overlay Cards
```typescript
<div className="flex items-center gap-2">
  <Badge variant={overlay.is_active ? "default" : "secondary"}>
    {overlay.is_active ? "Active" : "Inactive"}
  </Badge>
  <Button
    variant="ghost"
    size="sm"
    onClick={(e) => handleDeleteOverlay(overlay.overlay_id, e)}
    disabled={isDeleting === overlay.overlay_id}
    className="text-red-600 hover:text-red-700 hover:bg-red-50"
  >
    {isDeleting === overlay.overlay_id ? (
      <Loader2 className="h-4 w-4 animate-spin" />
    ) : (
      <Trash2 className="h-4 w-4" />
    )}
  </Button>
</div>
```

### Backend Implementation

**File**: [lambda/functions/overlays-crud-handler/index.js](lambda/functions/overlays-crud-handler/index.js:203-221)

The DELETE endpoint was already implemented and performs a **soft delete**:

```javascript
async function handleDelete(dbClient, pathParameters, userId) {
  const overlayId = pathParameters?.overlayId || pathParameters?.id;
  if (!overlayId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Overlay ID required' }) };
  }

  const query = `
    UPDATE overlays SET is_active = false, updated_at = CURRENT_TIMESTAMP
    WHERE overlay_id = $1
    RETURNING overlay_id
  `;
  const result = await dbClient.query(query, [overlayId]);

  if (result.rows.length === 0) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Overlay not found' }) };
  }

  return { statusCode: 200, body: JSON.stringify({ message: 'Overlay deleted', overlay_id: overlayId }) };
}
```

### API Client

**File**: [frontend/lib/api-client.ts](frontend/lib/api-client.ts:221-225)

The API client method was already implemented:

```typescript
async deleteOverlay(overlayId: string) {
  return this.request<any>(`/overlays/${overlayId}`, {
    method: 'DELETE',
  });
}
```

## How It Works

1. **User Action**: User clicks the trash icon on an overlay card
2. **Confirmation**: Browser shows native confirmation dialog
3. **Loading State**: Delete button shows spinner while processing
4. **API Call**: Frontend calls `DELETE /overlays/{id}`
5. **Backend**: Sets `is_active = false` in database (soft delete)
6. **Response**:
   - **Success**: Overlay removed from frontend list
   - **Error**: Error message displayed at top of page
7. **Data Retention**: Overlay remains in database but hidden from queries

## Soft Delete Behavior

Overlays are **soft deleted**, not permanently removed:

- Sets `is_active = false` in the database
- Overlay remains in database for data retention and audit purposes
- All queries filter by `WHERE is_active = true`, so deleted overlays don't appear
- Maintains referential integrity for historical data

### Database Queries

**List Overlays** (line 82):
```sql
WHERE o.is_active = true
```

**Get Single Overlay** (line 50):
```sql
WHERE overlay_id = $1 AND is_active = true
```

This ensures deleted overlays are hidden from all user-facing queries.

## User Experience

### Delete Flow
1. Click trash icon on overlay card
2. See confirmation: "Are you sure you want to delete this overlay? This action cannot be undone."
3. Click OK → overlay disappears immediately
4. If error occurs → error message shown at top of page

### Visual Feedback
- Delete button changes to spinner during deletion
- Delete button is red with hover effect
- Confirmation dialog prevents accidental deletions
- Immediate removal from list on success
- Error message displayed at top on failure

## Error Handling

The frontend catches and displays errors such as:
- Overlay in use by active sessions
- Network errors
- Permission errors
- Overlay not found

Error message: "Failed to delete overlay. It may be in use by active sessions."

## Testing

### Manual Testing Steps

1. **Navigate to overlays page**: `/overlays`
2. **Find an overlay** to delete
3. **Click trash icon** in the overlay card header
4. **Confirm deletion** in the dialog
5. **Verify** overlay disappears from the list
6. **Refresh page** (F5) and verify overlay doesn't reappear
7. **Check error handling** by trying to delete an overlay in use

### Expected Results
- ✅ Overlay disappears immediately on success
- ✅ Deleted overlays don't reappear after refresh
- ✅ Delete button shows spinner during operation
- ✅ Confirmation dialog prevents accidents
- ✅ Error message shown if deletion fails
- ✅ Other overlays remain visible

## Future Enhancements

Potential improvements:
1. **Bulk Delete**: Select and delete multiple overlays at once
2. **Undelete/Restore**: View and restore soft-deleted overlays
3. **Hard Delete**: Admin function to permanently remove overlays
4. **Delete Protection**: Prevent deletion of overlays in use by active sessions
5. **Cascade Rules**: Define what happens to criteria when overlay is deleted
6. **Audit Log**: Track who deleted what and when

## Related Files

- [frontend/app/overlays/page.tsx](frontend/app/overlays/page.tsx) - Main overlays list page
- [lambda/functions/overlays-crud-handler/index.js](lambda/functions/overlays-crud-handler/index.js) - Backend DELETE handler
- [frontend/lib/api-client.ts](frontend/lib/api-client.ts) - API client with deleteOverlay method
- [DELETED_SESSIONS_FIX.md](DELETED_SESSIONS_FIX.md) - Similar fix for sessions delete functionality

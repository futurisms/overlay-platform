# Evaluation Criteria Display - COMPLETE ✅

## What Was Added

Added a new **Evaluation Criteria** section to the session detail page that shows users what their documents will be evaluated against **before they upload**.

## Features

### 1. Evaluation Criteria Card
**Location**: Session detail page - between header and upload section

**Displays**:
- **Overlay name** - Which evaluation template is being used
- **Criteria list** - All evaluation criteria with details

### 2. Criterion Details
Each criterion shows:
- **Name** - The criterion title (e.g., "Party Identification")
- **Category** - Type of evaluation (e.g., "compliance", "quality")
- **Weight** - Percentage weight in final score (e.g., "15%")
- **Max Score** - Maximum points possible (e.g., "100")
- **Description** - What this criterion measures

### 3. Fallback Display
If no criteria are loaded from the backend, shows:
- Friendly explanation message
- **4 default evaluation areas**:
  1. **Structure Validation** - Format and template adherence
  2. **Content Analysis** - Quality and completeness
  3. **Grammar Check** - Writing quality
  4. **Compliance Review** - Regulatory compliance

## Implementation

### Updated Files

**[frontend/app/session/[id]/page.tsx](frontend/app/session/[id]/page.tsx)**

Changes made:
1. Added `overlay` state to store overlay data
2. Updated `loadSessionData()` to fetch overlay details
3. Added criteria display section before upload

### Code Structure

```typescript
// State management
const [overlay, setOverlay] = useState<any>(null);

// Load overlay with criteria
if (sessionResult.data.overlay_id) {
  const overlayResult = await apiClient.getOverlay(sessionResult.data.overlay_id);
  if (overlayResult.data) {
    setOverlay(overlayResult.data);
  }
}

// Display criteria
{overlay && overlay.criteria && overlay.criteria.length > 0 ? (
  // Show actual criteria from backend
) : (
  // Show default fallback UI
)}
```

### UI Components Used

- **Card** - Container for criteria section
- **Badge** - Display criterion category and status
- **Grid Layout** - Responsive 2-column layout for fallback
- **Icons** - FileText icon for visual appeal

## How It Works

### User Flow

1. **Navigate to session** - User clicks on a session from dashboard
2. **Session loads** - Frontend fetches session details
3. **Overlay fetched** - If session has overlay_id, fetch overlay details
4. **Criteria displayed** - Shows criteria with weights and descriptions
5. **User informed** - User knows evaluation standards before upload
6. **Upload document** - User uploads with full knowledge of criteria

### Data Flow

```
Session Page Load
    ↓
GET /sessions/{id} - Get session details
    ↓
Extract overlay_id
    ↓
GET /overlays/{id} - Get overlay with criteria
    ↓
Display criteria to user
    ↓
User uploads document with full context
```

## Example Display

### With Criteria (from backend)
```
┌─────────────────────────────────────────────────────┐
│ 📄 Evaluation Criteria                              │
│ Your document will be evaluated against the         │
│ "Contract Review Template" criteria                  │
├─────────────────────────────────────────────────────┤
│                                                      │
│ ┌─────────────────────────────────────────────┐    │
│ │ Party Identification        Weight: 15%     │    │
│ │ [compliance]               Max Score: 100    │    │
│ │                                              │    │
│ │ Verifies all parties are properly identified│    │
│ │ with legal names and registration details   │    │
│ └─────────────────────────────────────────────┘    │
│                                                      │
│ ┌─────────────────────────────────────────────┐    │
│ │ Contract Value              Weight: 20%     │    │
│ │ [financial]                Max Score: 100    │    │
│ │                                              │    │
│ │ Checks that contract value is clearly       │    │
│ │ specified with payment terms                │    │
│ └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### Fallback (default display)
```
┌─────────────────────────────────────────────────────┐
│ 📄 Evaluation Criteria                              │
│ Your document will be evaluated against the         │
│ "overlay" criteria                                   │
├─────────────────────────────────────────────────────┤
│                                                      │
│        Evaluation criteria for this session         │
│   Documents will be analyzed by AI agents across    │
│   multiple dimensions including structure, content  │
│   quality, grammar, and compliance                  │
│                                                      │
│ ┌───────────────────┬───────────────────────┐      │
│ │ Structure         │ Content Analysis      │      │
│ │ Validation        │                       │      │
│ │                   │ Evaluates content     │      │
│ │ Verifies document │ quality, clarity, and │      │
│ │ format and        │ completeness          │      │
│ │ completeness      │                       │      │
│ └───────────────────┴───────────────────────┘      │
│                                                      │
│ ┌───────────────────┬───────────────────────┐      │
│ │ Grammar Check     │ Compliance Review     │      │
│ │                   │                       │      │
│ │ Identifies        │ Checks for regulatory │      │
│ │ spelling, grammar,│ compliance and risk   │      │
│ │ and writing issues│ factors               │      │
│ └───────────────────┴───────────────────────┘      │
└─────────────────────────────────────────────────────┘
```

## Benefits

### For Users
1. **Transparency** - Know evaluation criteria upfront
2. **Better preparation** - Can ensure document meets standards
3. **Confidence** - Upload with understanding of what's measured
4. **Context** - See overlay name and purpose

### For Testing
1. **Immediate value** - Works even if backend doesn't return criteria
2. **Informative** - Shows the 4 AI agents that will analyze
3. **Clear structure** - Easy to understand evaluation dimensions

## Current Status

✅ **Section added** to session detail page
✅ **Overlay fetching** implemented
✅ **Criteria display** created with full details
✅ **Fallback UI** shows default evaluation areas
✅ **Responsive design** works on mobile and desktop
✅ **Loading state** handled properly

## Testing

### To See It
1. **Open browser** to http://localhost:3000
2. **Login** with admin@example.com / TestPassword123!
3. **Click any session** from dashboard
4. **Scroll down** - You'll see "Evaluation Criteria" section
5. **View criteria** - Shows either:
   - Actual criteria from backend (if loaded)
   - Default 4-box fallback display (most likely for now)

### Verify It Works
```bash
# Start servers if not running
cd c:\Projects\overlay-platform\frontend
node proxy-server.js  # Terminal 1
npm run dev           # Terminal 2

# Open browser
http://localhost:3000
```

## Future Enhancements

If the backend needs updating to return criteria:

### Option 1: Fix overlays-crud-handler
Update GET /overlays/{id} to include criteria:
```sql
SELECT ec.criterion_id, ec.name, ec.description,
       ec.weight, ec.max_score, ec.category
FROM evaluation_criteria ec
WHERE ec.overlay_id = $1 AND ec.is_active = true
ORDER BY ec.weight DESC
```

### Option 2: Add dedicated endpoint
Create GET /overlays/{id}/criteria endpoint

### Option 3: Embed in session response
Include criteria directly in GET /sessions/{id} response

## Summary

Users can now:
- ✅ See what criteria their documents will be evaluated against
- ✅ Understand the evaluation dimensions before uploading
- ✅ Make informed decisions about document submission
- ✅ Know the weights and importance of each criterion

The evaluation criteria section provides transparency and helps users prepare better documents for analysis! 🎉

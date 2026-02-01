"use client";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DashboardPage;
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
const badge_1 = require("@/components/ui/badge");
const alert_1 = require("@/components/ui/alert");
const input_1 = require("@/components/ui/input");
const label_1 = require("@/components/ui/label");
const textarea_1 = require("@/components/ui/textarea");
const dialog_1 = require("@/components/ui/dialog");
const lucide_react_1 = require("lucide-react");
const api_client_1 = require("@/lib/api-client");
const auth_1 = require("@/lib/auth");
function DashboardPage() {
    const router = (0, navigation_1.useRouter)();
    const [sessions, setSessions] = (0, react_1.useState)([]);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const [user, setUser] = (0, react_1.useState)(null);
    const [isDeleting, setIsDeleting] = (0, react_1.useState)(null);
    const [showNewSessionDialog, setShowNewSessionDialog] = (0, react_1.useState)(false);
    const [showQuickUploadDialog, setShowQuickUploadDialog] = (0, react_1.useState)(false);
    const [showEditSessionDialog, setShowEditSessionDialog] = (0, react_1.useState)(false);
    const [editingSession, setEditingSession] = (0, react_1.useState)(null);
    const [editSessionData, setEditSessionData] = (0, react_1.useState)({ name: "", description: "" });
    const [isUpdating, setIsUpdating] = (0, react_1.useState)(false);
    const [newSessionData, setNewSessionData] = (0, react_1.useState)({
        name: "",
        description: "",
        overlay_id: "",
        start_date: "",
        end_date: "",
    });
    const [overlays, setOverlays] = (0, react_1.useState)([]);
    const [uploadData, setUploadData] = (0, react_1.useState)({
        session_id: "",
        document_name: "",
        document_content: "",
    });
    (0, react_1.useEffect)(() => {
        // Check authentication
        const currentUser = (0, auth_1.getCurrentUser)();
        if (!currentUser) {
            router.push("/login");
            return;
        }
        setUser(currentUser);
        // Load sessions and overlays
        loadSessions();
        loadOverlays();
    }, [router]);
    const loadSessions = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // For testing: Load ALL sessions instead of just available ones
            // In production, you might want to filter by available, active, user's sessions, etc.
            const result = await api_client_1.apiClient.getSessions();
            if (result.error) {
                setError(result.error);
            }
            else if (result.data) {
                setSessions(result.data.sessions || []);
            }
        }
        catch (err) {
            setError("Failed to load sessions");
            console.error(err);
        }
        finally {
            setIsLoading(false);
        }
    };
    const loadOverlays = async () => {
        try {
            const result = await api_client_1.apiClient.getOverlays();
            if (result.data) {
                setOverlays(result.data.overlays || []);
            }
        }
        catch (err) {
            console.error("Failed to load overlays:", err);
        }
    };
    const handleLogout = () => {
        (0, auth_1.logout)();
        api_client_1.apiClient.clearToken();
        router.push("/login");
    };
    const handleSessionClick = (sessionId) => {
        router.push(`/session/${sessionId}`);
    };
    const handleDeleteSession = async (sessionId, e) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this session? This action cannot be undone.")) {
            return;
        }
        setIsDeleting(sessionId);
        try {
            const result = await api_client_1.apiClient.deleteSession(sessionId);
            if (result.error) {
                setError(result.error);
            }
            else {
                // Remove from list
                setSessions(sessions.filter(s => s.session_id !== sessionId));
            }
        }
        catch (err) {
            setError("Failed to delete session");
            console.error(err);
        }
        finally {
            setIsDeleting(null);
        }
    };
    const handleEditSessionClick = (session, e) => {
        e.stopPropagation();
        setEditingSession(session);
        setEditSessionData({
            name: session.name,
            description: session.description || "",
        });
        setShowEditSessionDialog(true);
    };
    const handleUpdateSession = async () => {
        if (!editingSession || !editSessionData.name) {
            setError("Session name is required");
            return;
        }
        setIsUpdating(true);
        try {
            const result = await api_client_1.apiClient.updateSession(editingSession.session_id, {
                name: editSessionData.name,
                description: editSessionData.description,
            });
            if (result.error) {
                setError(result.error);
            }
            else {
                setShowEditSessionDialog(false);
                setEditingSession(null);
                loadSessions(); // Refresh the list
            }
        }
        catch (err) {
            setError("Failed to update session");
            console.error(err);
        }
        finally {
            setIsUpdating(false);
        }
    };
    const handleCreateSession = async () => {
        if (!newSessionData.name || !newSessionData.overlay_id) {
            setError("Session name and overlay are required");
            return;
        }
        try {
            const result = await api_client_1.apiClient.createSession({
                name: newSessionData.name,
                description: newSessionData.description,
                overlay_id: newSessionData.overlay_id,
                start_date: newSessionData.start_date || new Date().toISOString(),
                end_date: newSessionData.end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                status: "active",
            });
            if (result.error) {
                setError(result.error);
            }
            else {
                setShowNewSessionDialog(false);
                setNewSessionData({
                    name: "",
                    description: "",
                    overlay_id: "",
                    start_date: "",
                    end_date: "",
                });
                loadSessions();
            }
        }
        catch (err) {
            setError("Failed to create session");
            console.error(err);
        }
    };
    const handleQuickUpload = async () => {
        if (!uploadData.session_id || !uploadData.document_name || !uploadData.document_content) {
            setError("All fields are required for upload");
            return;
        }
        const selectedSession = sessions.find(s => s.session_id === uploadData.session_id);
        if (!selectedSession?.overlay_id) {
            setError("Selected session does not have an overlay configured");
            return;
        }
        setError(null);
        try {
            const result = await api_client_1.apiClient.createSubmission({
                session_id: uploadData.session_id,
                overlay_id: selectedSession.overlay_id,
                document_name: uploadData.document_name,
                document_content: uploadData.document_content,
                file_size: uploadData.document_content.length,
            });
            if (result.error) {
                setError(result.error);
            }
            else {
                setShowQuickUploadDialog(false);
                setUploadData({ session_id: "", document_name: "", document_content: "" });
                // Show success and redirect
                if (result.data?.submission_id) {
                    alert(`✅ Document uploaded successfully!\n\nRedirecting to view analysis results...`);
                    setTimeout(() => {
                        router.push(`/submission/${result.data.submission_id}`);
                    }, 500);
                }
            }
        }
        catch (err) {
            setError("Failed to upload document");
            console.error(err);
        }
    };
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        setUploadData({ ...uploadData, document_name: file.name });
        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result;
            // Strip the data URL prefix (e.g., "data:application/pdf;base64,")
            const base64 = result.split(",")[1];
            setUploadData(prev => ({ ...prev, document_content: base64 }));
        };
        reader.readAsDataURL(file);
    };
    const getStatusColor = (status) => {
        switch (status) {
            case "active":
                return "default";
            case "pending":
                return "secondary";
            case "completed":
                return "outline";
            default:
                return "outline";
        }
    };
    if (isLoading) {
        return (<div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <lucide_react_1.Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-slate-600"/>
          <p className="text-slate-600 dark:text-slate-400">Loading analysis sessions...</p>
        </div>
      </div>);
    }
    return (<div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-50 mb-2">
              Dashboard
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Welcome back, {user?.email}
            </p>
          </div>
          <button_1.Button variant="outline" onClick={handleLogout}>
            <lucide_react_1.LogOut className="mr-2 h-4 w-4"/>
            Sign Out
          </button_1.Button>
        </div>

        {error && (<alert_1.Alert variant="destructive" className="mb-6">
            <alert_1.AlertDescription>{error}</alert_1.AlertDescription>
          </alert_1.Alert>)}

        {/* Available Sessions */}
        <card_1.Card className="mb-8">
          <card_1.CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <card_1.CardTitle className="flex items-center gap-2">
                  <lucide_react_1.Calendar className="h-5 w-5"/>
                  Analysis Sessions
                </card_1.CardTitle>
                <card_1.CardDescription>Select an analysis session to upload documents and view analyses</card_1.CardDescription>
              </div>
              <div className="flex gap-2">
                <button_1.Button onClick={() => setShowNewSessionDialog(true)} variant="default" size="sm">
                  <lucide_react_1.Plus className="mr-2 h-4 w-4"/>
                  Create Analysis Session
                </button_1.Button>
                <button_1.Button onClick={loadSessions} variant="outline" size="sm">
                  Refresh
                </button_1.Button>
              </div>
            </div>
          </card_1.CardHeader>
          <card_1.CardContent>
            {sessions.length === 0 ? (<div className="text-center py-8">
                <lucide_react_1.FileText className="h-12 w-12 mx-auto mb-4 text-slate-400"/>
                <p className="text-slate-600 dark:text-slate-400 mb-2">No analysis sessions available</p>
                <p className="text-sm text-slate-500 dark:text-slate-500">
                  Analysis sessions will appear here when they are created
                </p>
              </div>) : (<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sessions.map((session) => (<card_1.Card key={session.session_id} className="cursor-pointer hover:border-blue-500 transition-colors" onClick={() => handleSessionClick(session.session_id)}>
                    <card_1.CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <card_1.CardTitle className="text-lg mb-1">{session.name}</card_1.CardTitle>
                          <card_1.CardDescription className="line-clamp-2">
                            {session.description || "No description"}
                          </card_1.CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <badge_1.Badge variant={getStatusColor(session.status)}>
                            {session.status}
                          </badge_1.Badge>
                          <button_1.Button variant="ghost" size="sm" onClick={(e) => handleEditSessionClick(session, e)} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                            <lucide_react_1.Pencil className="h-4 w-4"/>
                          </button_1.Button>
                          <button_1.Button variant="ghost" size="sm" onClick={(e) => handleDeleteSession(session.session_id, e)} disabled={isDeleting === session.session_id} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                            {isDeleting === session.session_id ? (<lucide_react_1.Loader2 className="h-4 w-4 animate-spin"/>) : (<lucide_react_1.Trash2 className="h-4 w-4"/>)}
                          </button_1.Button>
                        </div>
                      </div>
                    </card_1.CardHeader>
                    <card_1.CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          <lucide_react_1.Users className="h-4 w-4"/>
                          <span>{session.participant_count || 0} participants</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          <lucide_react_1.FileText className="h-4 w-4"/>
                          <span>{session.submission_count || 0} submissions</span>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <div className="text-xs text-slate-500 dark:text-slate-500">
                          <p>Start: {new Date(session.start_date).toLocaleDateString()}</p>
                          <p>End: {new Date(session.end_date).toLocaleDateString()}</p>
                          <p className="mt-1">Created by: {session.created_by_name}</p>
                        </div>
                      </div>
                    </card_1.CardContent>
                  </card_1.Card>))}
              </div>)}
          </card_1.CardContent>
        </card_1.Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <card_1.Card className="cursor-pointer hover:border-blue-500 transition-colors" onClick={() => router.push("/submissions")}>
            <card_1.CardHeader>
              <card_1.CardTitle className="text-lg flex items-center gap-2">
                <lucide_react_1.FileText className="h-5 w-5"/>
                My Analyses
              </card_1.CardTitle>
            </card_1.CardHeader>
            <card_1.CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                View all your document analyses and their status
              </p>
            </card_1.CardContent>
          </card_1.Card>

          <card_1.Card className="cursor-pointer hover:border-blue-500 transition-colors" onClick={() => setShowQuickUploadDialog(true)}>
            <card_1.CardHeader>
              <card_1.CardTitle className="text-lg flex items-center gap-2">
                <lucide_react_1.Upload className="h-5 w-5"/>
                Quick Upload
              </card_1.CardTitle>
            </card_1.CardHeader>
            <card_1.CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Upload a document to an available session
              </p>
            </card_1.CardContent>
          </card_1.Card>

          <card_1.Card className="cursor-pointer hover:border-blue-500 transition-colors" onClick={() => router.push("/overlays")}>
            <card_1.CardHeader>
              <card_1.CardTitle className="text-lg flex items-center gap-2">
                <lucide_react_1.Settings className="h-5 w-5"/>
                Intelligence Setup
              </card_1.CardTitle>
            </card_1.CardHeader>
            <card_1.CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Create and manage intelligence evaluation templates
              </p>
            </card_1.CardContent>
          </card_1.Card>
        </div>

        {/* Create New Session Dialog */}
        <dialog_1.Dialog open={showNewSessionDialog} onOpenChange={setShowNewSessionDialog}>
          <dialog_1.DialogContent className="max-w-2xl">
            <dialog_1.DialogHeader>
              <dialog_1.DialogTitle>Create New Analysis Session</dialog_1.DialogTitle>
              <dialog_1.DialogDescription>
                Create a new analysis session for document evaluation
              </dialog_1.DialogDescription>
            </dialog_1.DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <label_1.Label htmlFor="session-name">Session Name *</label_1.Label>
                <input_1.Input id="session-name" placeholder="e.g., Q1 2024 Contract Review" value={newSessionData.name} onChange={(e) => setNewSessionData({ ...newSessionData, name: e.target.value })}/>
              </div>

              <div>
                <label_1.Label htmlFor="session-description">Description</label_1.Label>
                <textarea_1.Textarea id="session-description" placeholder="Describe the purpose of this review session..." rows={3} value={newSessionData.description} onChange={(e) => setNewSessionData({ ...newSessionData, description: e.target.value })}/>
              </div>

              <div>
                <label_1.Label htmlFor="overlay-select">Evaluation Overlay *</label_1.Label>
                <select id="overlay-select" className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" value={newSessionData.overlay_id} onChange={(e) => setNewSessionData({ ...newSessionData, overlay_id: e.target.value })}>
                  <option value="">Select an overlay...</option>
                  {overlays.map((overlay) => (<option key={overlay.overlay_id} value={overlay.overlay_id}>
                      {overlay.name}
                    </option>))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Choose the evaluation criteria template for this session
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label_1.Label htmlFor="start-date">Start Date</label_1.Label>
                  <input_1.Input id="start-date" type="date" value={newSessionData.start_date} onChange={(e) => setNewSessionData({ ...newSessionData, start_date: e.target.value })}/>
                </div>

                <div>
                  <label_1.Label htmlFor="end-date">End Date</label_1.Label>
                  <input_1.Input id="end-date" type="date" value={newSessionData.end_date} onChange={(e) => setNewSessionData({ ...newSessionData, end_date: e.target.value })}/>
                </div>
              </div>
            </div>

            <dialog_1.DialogFooter>
              <button_1.Button variant="outline" onClick={() => setShowNewSessionDialog(false)}>
                Cancel
              </button_1.Button>
              <button_1.Button onClick={handleCreateSession}>
                Create Session
              </button_1.Button>
            </dialog_1.DialogFooter>
          </dialog_1.DialogContent>
        </dialog_1.Dialog>

        {/* Edit Session Dialog */}
        <dialog_1.Dialog open={showEditSessionDialog} onOpenChange={setShowEditSessionDialog}>
          <dialog_1.DialogContent className="max-w-2xl">
            <dialog_1.DialogHeader>
              <dialog_1.DialogTitle>Edit Analysis Session</dialog_1.DialogTitle>
              <dialog_1.DialogDescription>
                Update the session name and description
              </dialog_1.DialogDescription>
            </dialog_1.DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <label_1.Label htmlFor="edit-session-name">Session Name *</label_1.Label>
                <input_1.Input id="edit-session-name" placeholder="e.g., Q1 2024 Contract Review" value={editSessionData.name} onChange={(e) => setEditSessionData({ ...editSessionData, name: e.target.value })}/>
              </div>

              <div>
                <label_1.Label htmlFor="edit-session-description">Description</label_1.Label>
                <textarea_1.Textarea id="edit-session-description" placeholder="Describe the purpose of this review session..." rows={3} value={editSessionData.description} onChange={(e) => setEditSessionData({ ...editSessionData, description: e.target.value })}/>
              </div>
            </div>

            <dialog_1.DialogFooter>
              <button_1.Button variant="outline" onClick={() => setShowEditSessionDialog(false)} disabled={isUpdating}>
                Cancel
              </button_1.Button>
              <button_1.Button onClick={handleUpdateSession} disabled={isUpdating}>
                {isUpdating ? (<>
                    <lucide_react_1.Loader2 className="h-4 w-4 mr-2 animate-spin"/>
                    Updating...
                  </>) : ("Save Changes")}
              </button_1.Button>
            </dialog_1.DialogFooter>
          </dialog_1.DialogContent>
        </dialog_1.Dialog>

        {/* Quick Upload Dialog */}
        <dialog_1.Dialog open={showQuickUploadDialog} onOpenChange={setShowQuickUploadDialog}>
          <dialog_1.DialogContent className="max-w-2xl">
            <dialog_1.DialogHeader>
              <dialog_1.DialogTitle>Quick Upload</dialog_1.DialogTitle>
              <dialog_1.DialogDescription>
                Upload a document to an active review session
              </dialog_1.DialogDescription>
            </dialog_1.DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <label_1.Label htmlFor="upload-session">Select Session *</label_1.Label>
                <select id="upload-session" className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" value={uploadData.session_id} onChange={(e) => setUploadData({ ...uploadData, session_id: e.target.value })}>
                  <option value="">Choose a session...</option>
                  {sessions
            .filter((s) => s.status === "active")
            .map((session) => (<option key={session.session_id} value={session.session_id}>
                        {session.name}
                      </option>))}
                </select>
              </div>

              <div>
                <label_1.Label htmlFor="upload-file">Document *</label_1.Label>
                <input_1.Input id="upload-file" type="file" accept=".pdf,.doc,.docx,.txt" onChange={handleFileChange}/>
                <p className="text-xs text-slate-500 mt-1">
                  Supported formats: PDF, DOC, DOCX, TXT
                </p>
              </div>

              {uploadData.document_name && (<div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-sm text-blue-900">
                    <strong>Selected:</strong> {uploadData.document_name}
                  </p>
                </div>)}
            </div>

            <dialog_1.DialogFooter>
              <button_1.Button variant="outline" onClick={() => setShowQuickUploadDialog(false)}>
                Cancel
              </button_1.Button>
              <button_1.Button onClick={handleQuickUpload} disabled={!uploadData.session_id || !uploadData.document_content}>
                <lucide_react_1.Upload className="mr-2 h-4 w-4"/>
                Upload Document
              </button_1.Button>
            </dialog_1.DialogFooter>
          </dialog_1.DialogContent>
        </dialog_1.Dialog>
      </div>
    </div>);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInBhZ2UudHN4Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFlBQVksQ0FBQzs7O0FBb0NiLGdDQTBvQkM7QUE1cUJELGlDQUE0QztBQUM1QyxnREFBNEM7QUFDNUMsK0NBQWlHO0FBQ2pHLG1EQUFnRDtBQUNoRCxpREFBOEM7QUFDOUMsaURBQWdFO0FBQ2hFLGlEQUE4QztBQUM5QyxpREFBOEM7QUFDOUMsdURBQW9EO0FBQ3BELG1EQU9nQztBQUNoQywrQ0FBa0g7QUFDbEgsaURBQTZDO0FBQzdDLHFDQUFvRDtBQWVwRCxTQUF3QixhQUFhO0lBQ25DLE1BQU0sTUFBTSxHQUFHLElBQUEsc0JBQVMsR0FBRSxDQUFDO0lBQzNCLE1BQU0sQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLEdBQUcsSUFBQSxnQkFBUSxFQUFZLEVBQUUsQ0FBQyxDQUFDO0lBQ3hELE1BQU0sQ0FBQyxTQUFTLEVBQUUsWUFBWSxDQUFDLEdBQUcsSUFBQSxnQkFBUSxFQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2pELE1BQU0sQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLEdBQUcsSUFBQSxnQkFBUSxFQUFnQixJQUFJLENBQUMsQ0FBQztJQUN4RCxNQUFNLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxHQUFHLElBQUEsZ0JBQVEsRUFBTSxJQUFJLENBQUMsQ0FBQztJQUM1QyxNQUFNLENBQUMsVUFBVSxFQUFFLGFBQWEsQ0FBQyxHQUFHLElBQUEsZ0JBQVEsRUFBZ0IsSUFBSSxDQUFDLENBQUM7SUFDbEUsTUFBTSxDQUFDLG9CQUFvQixFQUFFLHVCQUF1QixDQUFDLEdBQUcsSUFBQSxnQkFBUSxFQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3hFLE1BQU0sQ0FBQyxxQkFBcUIsRUFBRSx3QkFBd0IsQ0FBQyxHQUFHLElBQUEsZ0JBQVEsRUFBQyxLQUFLLENBQUMsQ0FBQztJQUMxRSxNQUFNLENBQUMscUJBQXFCLEVBQUUsd0JBQXdC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QUMsQ0FFakU7Z0JBQUEsQ0FBQyxxQkFBTSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEVBQ2hDOztjQUNGLEVBQUUsZUFBTSxDQUNWO1lBQUEsRUFBRSxxQkFBWSxDQUNoQjtVQUFBLEVBQUUsc0JBQWEsQ0FDakI7UUFBQSxFQUFFLGVBQU0sQ0FDVjtNQUFBLEVBQUUsR0FBRyxDQUNQO0lBQUEsRUFBRSxHQUFHLENBQUMsQ0FDUCxDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIlwidXNlIGNsaWVudFwiO1xuXG5pbXBvcnQgeyB1c2VFZmZlY3QsIHVzZVN0YXRlIH0gZnJvbSBcInJlYWN0XCI7XG5pbXBvcnQgeyB1c2VSb3V0ZXIgfSBmcm9tIFwibmV4dC9uYXZpZ2F0aW9uXCI7XG5pbXBvcnQgeyBDYXJkLCBDYXJkQ29udGVudCwgQ2FyZERlc2NyaXB0aW9uLCBDYXJkSGVhZGVyLCBDYXJkVGl0bGUgfSBmcm9tIFwiQC9jb21wb25lbnRzL3VpL2NhcmRcIjtcbmltcG9ydCB7IEJ1dHRvbiB9IGZyb20gXCJAL2NvbXBvbmVudHMvdWkvYnV0dG9uXCI7XG5pbXBvcnQgeyBCYWRnZSB9IGZyb20gXCJAL2NvbXBvbmVudHMvdWkvYmFkZ2VcIjtcbmltcG9ydCB7IEFsZXJ0LCBBbGVydERlc2NyaXB0aW9uIH0gZnJvbSBcIkAvY29tcG9uZW50cy91aS9hbGVydFwiO1xuaW1wb3J0IHsgSW5wdXQgfSBmcm9tIFwiQC9jb21wb25lbnRzL3VpL2lucHV0XCI7XG5pbXBvcnQgeyBMYWJlbCB9IGZyb20gXCJAL2NvbXBvbmVudHMvdWkvbGFiZWxcIjtcbmltcG9ydCB7IFRleHRhcmVhIH0gZnJvbSBcIkAvY29tcG9uZW50cy91aS90ZXh0YXJlYVwiO1xuaW1wb3J0IHtcbiAgRGlhbG9nLFxuICBEaWFsb2dDb250ZW50LFxuICBEaWFsb2dEZXNjcmlwdGlvbixcbiAgRGlhbG9nSGVhZGVyLFxuICBEaWFsb2dUaXRsZSxcbiAgRGlhbG9nRm9vdGVyXG59IGZyb20gXCJAL2NvbXBvbmVudHMvdWkvZGlhbG9nXCI7XG5pbXBvcnQgeyBMb2FkZXIyLCBDYWxlbmRhciwgVXNlcnMsIEZpbGVUZXh0LCBMb2dPdXQsIFVwbG9hZCwgU2V0dGluZ3MsIFRyYXNoMiwgUGx1cywgUGVuY2lsIH0gZnJvbSBcImx1Y2lkZS1yZWFjdFwiO1xuaW1wb3J0IHsgYXBpQ2xpZW50IH0gZnJvbSBcIkAvbGliL2FwaS1jbGllbnRcIjtcbmltcG9ydCB7IGdldEN1cnJlbnRVc2VyLCBsb2dvdXQgfSBmcm9tIFwiQC9saWIvYXV0aFwiO1xuXG5pbnRlcmZhY2UgU2Vzc2lvbiB7XG4gIHNlc3Npb25faWQ6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBkZXNjcmlwdGlvbjogc3RyaW5nO1xuICBzdGF0dXM6IHN0cmluZztcbiAgc3RhcnRfZGF0ZTogc3RyaW5nO1xuICBlbmRfZGF0ZTogc3RyaW5nO1xuICBjcmVhdGVkX2J5X25hbWU6IHN0cmluZztcbiAgcGFydGljaXBhbnRfY291bnQ6IG51bWJlcjtcbiAgc3VibWlzc2lvbl9jb3VudDogbnVtYmVyO1xuICBvdmVybGF5X2lkOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIERhc2hib2FyZFBhZ2UoKSB7XG4gIGNvbnN0IHJvdXRlciA9IHVzZVJvdXRlcigpO1xuICBjb25zdCBbc2Vzc2lvbnMsIHNldFNlc3Npb25zXSA9IHVzZVN0YXRlPFNlc3Npb25bXT4oW10pO1xuICBjb25zdCBbaXNMb2FkaW5nLCBzZXRJc0xvYWRpbmddID0gdXNlU3RhdGUodHJ1ZSk7XG4gIGNvbnN0IFtlcnJvciwgc2V0RXJyb3JdID0gdXNlU3RhdGU8c3RyaW5nIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFt1c2VyLCBzZXRVc2VyXSA9IHVzZVN0YXRlPGFueT4obnVsbCk7XG4gIGNvbnN0IFtpc0RlbGV0aW5nLCBzZXRJc0RlbGV0aW5nXSA9IHVzZVN0YXRlPHN0cmluZyB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbc2hvd05ld1Nlc3Npb25EaWFsb2csIHNldFNob3dOZXdTZXNzaW9uRGlhbG9nXSA9IHVzZVN0YXRlKGZhbHNlKTtcbiAgY29uc3QgW3Nob3dRdWlja1VwbG9hZERpYWxvZywgc2V0U2hvd1F1aWNrVXBsb2FkRGlhbG9nXSA9IHVzZVN0YXRlKGZhbHNlKTtcbiAgY29uc3QgW3Nob3dFZGl0U2Vzc2lvbkRpYWxvZywgc2V0U2hvd0VkaXRTZXNzaW9uRGlhbG9nXSA9IHVzZVN0YXRlKGZhbHNlKTtcbiAgY29uc3QgW2VkaXRpbmdTZXNzaW9uLCBzZXRFZGl0aW5nU2Vzc2lvbl0gPSB1c2VTdGF0ZTxTZXNzaW9uIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtlZGl0U2Vzc2lvbkRhdGEsIHNldEVkaXRTZXNzaW9uRGF0YV0gPSB1c2VTdGF0ZSh7IG5hbWU6IFwiXCIsIGRlc2NyaXB0aW9uOiBcIlwiIH0pO1xuICBjb25zdCBbaXNVcGRhdGluZywgc2V0SXNVcGRhdGluZ10gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IFtuZXdTZXNzaW9uRGF0YSwgc2V0TmV3U2Vzc2lvbkRhdGFdID0gdXNlU3RhdGUoe1xuICAgIG5hbWU6IFwiXCIsXG4gICAgZGVzY3JpcHRpb246IFwiXCIsXG4gICAgb3ZlcmxheV9pZDogXCJcIixcbiAgICBzdGFydF9kYXRlOiBcIlwiLFxuICAgIGVuZF9kYXRlOiBcIlwiLFxuICB9KTtcbiAgY29uc3QgW292ZXJsYXlzLCBzZXRPdmVybGF5c10gPSB1c2VTdGF0ZTxhbnlbXT4oW10pO1xuICBjb25zdCBbdXBsb2FkRGF0YSwgc2V0VXBsb2FkRGF0YV0gPSB1c2VTdGF0ZSh7XG4gICAgc2Vzc2lvbl9pZDogXCJcIixcbiAgICBkb2N1bWVudF9uYW1lOiBcIlwiLFxuICAgIGRvY3VtZW50X2NvbnRlbnQ6IFwiXCIsXG4gIH0pO1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgLy8gQ2hlY2sgYXV0aGVudGljYXRpb25cbiAgICBjb25zdCBjdXJyZW50VXNlciA9IGdldEN1cnJlbnRVc2VyKCk7XG4gICAgaWYgKCFjdXJyZW50VXNlcikge1xuICAgICAgcm91dGVyLnB1c2goXCIvbG9naW5cIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHNldFVzZXIoY3VycmVudFVzZXIpO1xuXG4gICAgLy8gTG9hZCBzZXNzaW9ucyBhbmQgb3ZlcmxheXNcbiAgICBsb2FkU2Vzc2lvbnMoKTtcbiAgICBsb2FkT3ZlcmxheXMoKTtcbiAgfSwgW3JvdXRlcl0pO1xuXG4gIGNvbnN0IGxvYWRTZXNzaW9ucyA9IGFzeW5jICgpID0+IHtcbiAgICBzZXRJc0xvYWRpbmcodHJ1ZSk7XG4gICAgc2V0RXJyb3IobnVsbCk7XG5cbiAgICB0cnkge1xuICAgICAgLy8gRm9yIHRlc3Rpbmc6IExvYWQgQUxMIHNlc3Npb25zIGluc3RlYWQgb2YganVzdCBhdmFpbGFibGUgb25lc1xuICAgICAgLy8gSW4gcHJvZHVjdGlvbiwgeW91IG1pZ2h0IHdhbnQgdG8gZmlsdGVyIGJ5IGF2YWlsYWJsZSwgYWN0aXZlLCB1c2VyJ3Mgc2Vzc2lvbnMsIGV0Yy5cbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGFwaUNsaWVudC5nZXRTZXNzaW9ucygpO1xuXG4gICAgICBpZiAocmVzdWx0LmVycm9yKSB7XG4gICAgICAgIHNldEVycm9yKHJlc3VsdC5lcnJvcik7XG4gICAgICB9IGVsc2UgaWYgKHJlc3VsdC5kYXRhKSB7XG4gICAgICAgIHNldFNlc3Npb25zKHJlc3VsdC5kYXRhLnNlc3Npb25zIHx8IFtdKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHNldEVycm9yKFwiRmFpbGVkIHRvIGxvYWQgc2Vzc2lvbnNcIik7XG4gICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHNldElzTG9hZGluZyhmYWxzZSk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGxvYWRPdmVybGF5cyA9IGFzeW5jICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYXBpQ2xpZW50LmdldE92ZXJsYXlzKCk7XG4gICAgICBpZiAocmVzdWx0LmRhdGEpIHtcbiAgICAgICAgc2V0T3ZlcmxheXMocmVzdWx0LmRhdGEub3ZlcmxheXMgfHwgW10pO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgY29uc29sZS5lcnJvcihcIkZhaWxlZCB0byBsb2FkIG92ZXJsYXlzOlwiLCBlcnIpO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBoYW5kbGVMb2dvdXQgPSAoKSA9PiB7XG4gICAgbG9nb3V0KCk7XG4gICAgYXBpQ2xpZW50LmNsZWFyVG9rZW4oKTtcbiAgICByb3V0ZXIucHVzaChcIi9sb2dpblwiKTtcbiAgfTtcblxuICBjb25zdCBoYW5kbGVTZXNzaW9uQ2xpY2sgPSAoc2Vzc2lvbklkOiBzdHJpbmcpID0+IHtcbiAgICByb3V0ZXIucHVzaChgL3Nlc3Npb24vJHtzZXNzaW9uSWR9YCk7XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlRGVsZXRlU2Vzc2lvbiA9IGFzeW5jIChzZXNzaW9uSWQ6IHN0cmluZywgZTogUmVhY3QuTW91c2VFdmVudCkgPT4ge1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cbiAgICBpZiAoIWNvbmZpcm0oXCJBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gZGVsZXRlIHRoaXMgc2Vzc2lvbj8gVGhpcyBhY3Rpb24gY2Fubm90IGJlIHVuZG9uZS5cIikpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBzZXRJc0RlbGV0aW5nKHNlc3Npb25JZCk7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGFwaUNsaWVudC5kZWxldGVTZXNzaW9uKHNlc3Npb25JZCk7XG4gICAgICBpZiAocmVzdWx0LmVycm9yKSB7XG4gICAgICAgIHNldEVycm9yKHJlc3VsdC5lcnJvcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBSZW1vdmUgZnJvbSBsaXN0XG4gICAgICAgIHNldFNlc3Npb25zKHNlc3Npb25zLmZpbHRlcihzID0+IHMuc2Vzc2lvbl9pZCAhPT0gc2Vzc2lvbklkKSk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBzZXRFcnJvcihcIkZhaWxlZCB0byBkZWxldGUgc2Vzc2lvblwiKTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgc2V0SXNEZWxldGluZyhudWxsKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlRWRpdFNlc3Npb25DbGljayA9IChzZXNzaW9uOiBTZXNzaW9uLCBlOiBSZWFjdC5Nb3VzZUV2ZW50KSA9PiB7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBzZXRFZGl0aW5nU2Vzc2lvbihzZXNzaW9uKTtcbiAgICBzZXRFZGl0U2Vzc2lvbkRhdGEoe1xuICAgICAgbmFtZTogc2Vzc2lvbi5uYW1lLFxuICAgICAgZGVzY3JpcHRpb246IHNlc3Npb24uZGVzY3JpcHRpb24gfHwgXCJcIixcbiAgICB9KTtcbiAgICBzZXRTaG93RWRpdFNlc3Npb25EaWFsb2codHJ1ZSk7XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlVXBkYXRlU2Vzc2lvbiA9IGFzeW5jICgpID0+IHtcbiAgICBpZiAoIWVkaXRpbmdTZXNzaW9uIHx8ICFlZGl0U2Vzc2lvbkRhdGEubmFtZSkge1xuICAgICAgc2V0RXJyb3IoXCJTZXNzaW9uIG5hbWUgaXMgcmVxdWlyZWRcIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgc2V0SXNVcGRhdGluZyh0cnVlKTtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYXBpQ2xpZW50LnVwZGF0ZVNlc3Npb24oZWRpdGluZ1Nlc3Npb24uc2Vzc2lvbl9pZCwge1xuICAgICAgICBuYW1lOiBlZGl0U2Vzc2lvbkRhdGEubmFtZSxcbiAgICAgICAgZGVzY3JpcHRpb246IGVkaXRTZXNzaW9uRGF0YS5kZXNjcmlwdGlvbixcbiAgICAgIH0pO1xuXG4gICAgICBpZiAocmVzdWx0LmVycm9yKSB7XG4gICAgICAgIHNldEVycm9yKHJlc3VsdC5lcnJvcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzZXRTaG93RWRpdFNlc3Npb25EaWFsb2coZmFsc2UpO1xuICAgICAgICBzZXRFZGl0aW5nU2Vzc2lvbihudWxsKTtcbiAgICAgICAgbG9hZFNlc3Npb25zKCk7IC8vIFJlZnJlc2ggdGhlIGxpc3RcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHNldEVycm9yKFwiRmFpbGVkIHRvIHVwZGF0ZSBzZXNzaW9uXCIpO1xuICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBzZXRJc1VwZGF0aW5nKGZhbHNlKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlQ3JlYXRlU2Vzc2lvbiA9IGFzeW5jICgpID0+IHtcbiAgICBpZiAoIW5ld1Nlc3Npb25EYXRhLm5hbWUgfHwgIW5ld1Nlc3Npb25EYXRhLm92ZXJsYXlfaWQpIHtcbiAgICAgIHNldEVycm9yKFwiU2Vzc2lvbiBuYW1lIGFuZCBvdmVybGF5IGFyZSByZXF1aXJlZFwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYXBpQ2xpZW50LmNyZWF0ZVNlc3Npb24oe1xuICAgICAgICBuYW1lOiBuZXdTZXNzaW9uRGF0YS5uYW1lLFxuICAgICAgICBkZXNjcmlwdGlvbjogbmV3U2Vzc2lvbkRhdGEuZGVzY3JpcHRpb24sXG4gICAgICAgIG92ZXJsYXlfaWQ6IG5ld1Nlc3Npb25EYXRhLm92ZXJsYXlfaWQsXG4gICAgICAgIHN0YXJ0X2RhdGU6IG5ld1Nlc3Npb25EYXRhLnN0YXJ0X2RhdGUgfHwgbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICBlbmRfZGF0ZTogbmV3U2Vzc2lvbkRhdGEuZW5kX2RhdGUgfHwgbmV3IERhdGUoRGF0ZS5ub3coKSArIDMwICogMjQgKiA2MCAqIDYwICogMTAwMCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgc3RhdHVzOiBcImFjdGl2ZVwiLFxuICAgICAgfSk7XG5cbiAgICAgIGlmIChyZXN1bHQuZXJyb3IpIHtcbiAgICAgICAgc2V0RXJyb3IocmVzdWx0LmVycm9yKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNldFNob3dOZXdTZXNzaW9uRGlhbG9nKGZhbHNlKTtcbiAgICAgICAgc2V0TmV3U2Vzc2lvbkRhdGEoe1xuICAgICAgICAgIG5hbWU6IFwiXCIsXG4gICAgICAgICAgZGVzY3JpcHRpb246IFwiXCIsXG4gICAgICAgICAgb3ZlcmxheV9pZDogXCJcIixcbiAgICAgICAgICBzdGFydF9kYXRlOiBcIlwiLFxuICAgICAgICAgIGVuZF9kYXRlOiBcIlwiLFxuICAgICAgICB9KTtcbiAgICAgICAgbG9hZFNlc3Npb25zKCk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBzZXRFcnJvcihcIkZhaWxlZCB0byBjcmVhdGUgc2Vzc2lvblwiKTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlUXVpY2tVcGxvYWQgPSBhc3luYyAoKSA9PiB7XG4gICAgaWYgKCF1cGxvYWREYXRhLnNlc3Npb25faWQgfHwgIXVwbG9hZERhdGEuZG9jdW1lbnRfbmFtZSB8fCAhdXBsb2FkRGF0YS5kb2N1bWVudF9jb250ZW50KSB7XG4gICAgICBzZXRFcnJvcihcIkFsbCBmaWVsZHMgYXJlIHJlcXVpcmVkIGZvciB1cGxvYWRcIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3Qgc2VsZWN0ZWRTZXNzaW9uID0gc2Vzc2lvbnMuZmluZChzID0+IHMuc2Vzc2lvbl9pZCA9PT0gdXBsb2FkRGF0YS5zZXNzaW9uX2lkKTtcbiAgICBpZiAoIXNlbGVjdGVkU2Vzc2lvbj8ub3ZlcmxheV9pZCkge1xuICAgICAgc2V0RXJyb3IoXCJTZWxlY3RlZCBzZXNzaW9uIGRvZXMgbm90IGhhdmUgYW4gb3ZlcmxheSBjb25maWd1cmVkXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHNldEVycm9yKG51bGwpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGFwaUNsaWVudC5jcmVhdGVTdWJtaXNzaW9uKHtcbiAgICAgICAgc2Vzc2lvbl9pZDogdXBsb2FkRGF0YS5zZXNzaW9uX2lkLFxuICAgICAgICBvdmVybGF5X2lkOiBzZWxlY3RlZFNlc3Npb24ub3ZlcmxheV9pZCxcbiAgICAgICAgZG9jdW1lbnRfbmFtZTogdXBsb2FkRGF0YS5kb2N1bWVudF9uYW1lLFxuICAgICAgICBkb2N1bWVudF9jb250ZW50OiB1cGxvYWREYXRhLmRvY3VtZW50X2NvbnRlbnQsXG4gICAgICAgIGZpbGVfc2l6ZTogdXBsb2FkRGF0YS5kb2N1bWVudF9jb250ZW50Lmxlbmd0aCxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAocmVzdWx0LmVycm9yKSB7XG4gICAgICAgIHNldEVycm9yKHJlc3VsdC5lcnJvcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzZXRTaG93UXVpY2tVcGxvYWREaWFsb2coZmFsc2UpO1xuICAgICAgICBzZXRVcGxvYWREYXRhKHsgc2Vzc2lvbl9pZDogXCJcIiwgZG9jdW1lbnRfbmFtZTogXCJcIiwgZG9jdW1lbnRfY29udGVudDogXCJcIiB9KTtcblxuICAgICAgICAvLyBTaG93IHN1Y2Nlc3MgYW5kIHJlZGlyZWN0XG4gICAgICAgIGlmIChyZXN1bHQuZGF0YT8uc3VibWlzc2lvbl9pZCkge1xuICAgICAgICAgIGFsZXJ0KGDinIUgRG9jdW1lbnQgdXBsb2FkZWQgc3VjY2Vzc2Z1bGx5IVxcblxcblJlZGlyZWN0aW5nIHRvIHZpZXcgYW5hbHlzaXMgcmVzdWx0cy4uLmApO1xuICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgcm91dGVyLnB1c2goYC9zdWJtaXNzaW9uLyR7cmVzdWx0LmRhdGEuc3VibWlzc2lvbl9pZH1gKTtcbiAgICAgICAgICB9LCA1MDApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBzZXRFcnJvcihcIkZhaWxlZCB0byB1cGxvYWQgZG9jdW1lbnRcIik7XG4gICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGhhbmRsZUZpbGVDaGFuZ2UgPSAoZTogUmVhY3QuQ2hhbmdlRXZlbnQ8SFRNTElucHV0RWxlbWVudD4pID0+IHtcbiAgICBjb25zdCBmaWxlID0gZS50YXJnZXQuZmlsZXM/LlswXTtcbiAgICBpZiAoIWZpbGUpIHJldHVybjtcblxuICAgIHNldFVwbG9hZERhdGEoeyAuLi51cGxvYWREYXRhLCBkb2N1bWVudF9uYW1lOiBmaWxlLm5hbWUgfSk7XG5cbiAgICBjb25zdCByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICAgIHJlYWRlci5vbmxvYWQgPSAoZXZlbnQpID0+IHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGV2ZW50LnRhcmdldD8ucmVzdWx0IGFzIHN0cmluZztcbiAgICAgIC8vIFN0cmlwIHRoZSBkYXRhIFVSTCBwcmVmaXggKGUuZy4sIFwiZGF0YTphcHBsaWNhdGlvbi9wZGY7YmFzZTY0LFwiKVxuICAgICAgY29uc3QgYmFzZTY0ID0gcmVzdWx0LnNwbGl0KFwiLFwiKVsxXTtcbiAgICAgIHNldFVwbG9hZERhdGEocHJldiA9PiAoeyAuLi5wcmV2LCBkb2N1bWVudF9jb250ZW50OiBiYXNlNjQgfSkpO1xuICAgIH07XG4gICAgcmVhZGVyLnJlYWRBc0RhdGFVUkwoZmlsZSk7XG4gIH07XG5cbiAgY29uc3QgZ2V0U3RhdHVzQ29sb3IgPSAoc3RhdHVzOiBzdHJpbmcpID0+IHtcbiAgICBzd2l0Y2ggKHN0YXR1cykge1xuICAgICAgY2FzZSBcImFjdGl2ZVwiOlxuICAgICAgICByZXR1cm4gXCJkZWZhdWx0XCI7XG4gICAgICBjYXNlIFwicGVuZGluZ1wiOlxuICAgICAgICByZXR1cm4gXCJzZWNvbmRhcnlcIjtcbiAgICAgIGNhc2UgXCJjb21wbGV0ZWRcIjpcbiAgICAgICAgcmV0dXJuIFwib3V0bGluZVwiO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIFwib3V0bGluZVwiO1xuICAgIH1cbiAgfTtcblxuICBpZiAoaXNMb2FkaW5nKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwibWluLWgtc2NyZWVuIGJnLWdyYWRpZW50LXRvLWIgZnJvbS1zbGF0ZS01MCB0by1zbGF0ZS0xMDAgZGFyazpmcm9tLXNsYXRlLTkwMCBkYXJrOnRvLXNsYXRlLTgwMCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlclwiPlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtY2VudGVyXCI+XG4gICAgICAgICAgPExvYWRlcjIgY2xhc3NOYW1lPVwiaC04IHctOCBhbmltYXRlLXNwaW4gbXgtYXV0byBtYi00IHRleHQtc2xhdGUtNjAwXCIgLz5cbiAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNsYXRlLTYwMCBkYXJrOnRleHQtc2xhdGUtNDAwXCI+TG9hZGluZyBhbmFseXNpcyBzZXNzaW9ucy4uLjwvcD5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT1cIm1pbi1oLXNjcmVlbiBiZy1ncmFkaWVudC10by1iIGZyb20tc2xhdGUtNTAgdG8tc2xhdGUtMTAwIGRhcms6ZnJvbS1zbGF0ZS05MDAgZGFyazp0by1zbGF0ZS04MDBcIj5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY29udGFpbmVyIG14LWF1dG8gcC02IG1heC13LTd4bFwiPlxuICAgICAgICB7LyogSGVhZGVyICovfVxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1iLTggZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuXCI+XG4gICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgIDxoMSBjbGFzc05hbWU9XCJ0ZXh0LTR4bCBmb250LWJvbGQgdGV4dC1zbGF0ZS05MDAgZGFyazp0ZXh0LXNsYXRlLTUwIG1iLTJcIj5cbiAgICAgICAgICAgICAgRGFzaGJvYXJkXG4gICAgICAgICAgICA8L2gxPlxuICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbGF0ZS02MDAgZGFyazp0ZXh0LXNsYXRlLTQwMFwiPlxuICAgICAgICAgICAgICBXZWxjb21lIGJhY2ssIHt1c2VyPy5lbWFpbH1cbiAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8QnV0dG9uIHZhcmlhbnQ9XCJvdXRsaW5lXCIgb25DbGljaz17aGFuZGxlTG9nb3V0fT5cbiAgICAgICAgICAgIDxMb2dPdXQgY2xhc3NOYW1lPVwibXItMiBoLTQgdy00XCIgLz5cbiAgICAgICAgICAgIFNpZ24gT3V0XG4gICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgIDwvZGl2PlxuXG4gICAgICAgIHtlcnJvciAmJiAoXG4gICAgICAgICAgPEFsZXJ0IHZhcmlhbnQ9XCJkZXN0cnVjdGl2ZVwiIGNsYXNzTmFtZT1cIm1iLTZcIj5cbiAgICAgICAgICAgIDxBbGVydERlc2NyaXB0aW9uPntlcnJvcn08L0FsZXJ0RGVzY3JpcHRpb24+XG4gICAgICAgICAgPC9BbGVydD5cbiAgICAgICAgKX1cblxuICAgICAgICB7LyogQXZhaWxhYmxlIFNlc3Npb25zICovfVxuICAgICAgICA8Q2FyZCBjbGFzc05hbWU9XCJtYi04XCI+XG4gICAgICAgICAgPENhcmRIZWFkZXI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlblwiPlxuICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgIDxDYXJkVGl0bGUgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIj5cbiAgICAgICAgICAgICAgICAgIDxDYWxlbmRhciBjbGFzc05hbWU9XCJoLTUgdy01XCIgLz5cbiAgICAgICAgICAgICAgICAgIEFuYWx5c2lzIFNlc3Npb25zXG4gICAgICAgICAgICAgICAgPC9DYXJkVGl0bGU+XG4gICAgICAgICAgICAgICAgPENhcmREZXNjcmlwdGlvbj5TZWxlY3QgYW4gYW5hbHlzaXMgc2Vzc2lvbiB0byB1cGxvYWQgZG9jdW1lbnRzIGFuZCB2aWV3IGFuYWx5c2VzPC9DYXJkRGVzY3JpcHRpb24+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggZ2FwLTJcIj5cbiAgICAgICAgICAgICAgICA8QnV0dG9uIG9uQ2xpY2s9eygpID0+IHNldFNob3dOZXdTZXNzaW9uRGlhbG9nKHRydWUpfSB2YXJpYW50PVwiZGVmYXVsdFwiIHNpemU9XCJzbVwiPlxuICAgICAgICAgICAgICAgICAgPFBsdXMgY2xhc3NOYW1lPVwibXItMiBoLTQgdy00XCIgLz5cbiAgICAgICAgICAgICAgICAgIENyZWF0ZSBBbmFseXNpcyBTZXNzaW9uXG4gICAgICAgICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgICAgICAgICAgPEJ1dHRvbiBvbkNsaWNrPXtsb2FkU2Vzc2lvbnN9IHZhcmlhbnQ9XCJvdXRsaW5lXCIgc2l6ZT1cInNtXCI+XG4gICAgICAgICAgICAgICAgICBSZWZyZXNoXG4gICAgICAgICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9DYXJkSGVhZGVyPlxuICAgICAgICAgIDxDYXJkQ29udGVudD5cbiAgICAgICAgICAgIHtzZXNzaW9ucy5sZW5ndGggPT09IDAgPyAoXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1jZW50ZXIgcHktOFwiPlxuICAgICAgICAgICAgICAgIDxGaWxlVGV4dCBjbGFzc05hbWU9XCJoLTEyIHctMTIgbXgtYXV0byBtYi00IHRleHQtc2xhdGUtNDAwXCIgLz5cbiAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNsYXRlLTYwMCBkYXJrOnRleHQtc2xhdGUtNDAwIG1iLTJcIj5ObyBhbmFseXNpcyBzZXNzaW9ucyBhdmFpbGFibGU8L3A+XG4gICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbSB0ZXh0LXNsYXRlLTUwMCBkYXJrOnRleHQtc2xhdGUtNTAwXCI+XG4gICAgICAgICAgICAgICAgICBBbmFseXNpcyBzZXNzaW9ucyB3aWxsIGFwcGVhciBoZXJlIHdoZW4gdGhleSBhcmUgY3JlYXRlZFxuICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImdyaWQgZ3JpZC1jb2xzLTEgbWQ6Z3JpZC1jb2xzLTIgZ2FwLTRcIj5cbiAgICAgICAgICAgICAgICB7c2Vzc2lvbnMubWFwKChzZXNzaW9uKSA9PiAoXG4gICAgICAgICAgICAgICAgICA8Q2FyZFxuICAgICAgICAgICAgICAgICAgICBrZXk9e3Nlc3Npb24uc2Vzc2lvbl9pZH1cbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiY3Vyc29yLXBvaW50ZXIgaG92ZXI6Ym9yZGVyLWJsdWUtNTAwIHRyYW5zaXRpb24tY29sb3JzXCJcbiAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gaGFuZGxlU2Vzc2lvbkNsaWNrKHNlc3Npb24uc2Vzc2lvbl9pZCl9XG4gICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgIDxDYXJkSGVhZGVyPlxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1zdGFydCBqdXN0aWZ5LWJldHdlZW5cIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleC0xXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxDYXJkVGl0bGUgY2xhc3NOYW1lPVwidGV4dC1sZyBtYi0xXCI+e3Nlc3Npb24ubmFtZX08L0NhcmRUaXRsZT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPENhcmREZXNjcmlwdGlvbiBjbGFzc05hbWU9XCJsaW5lLWNsYW1wLTJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7c2Vzc2lvbi5kZXNjcmlwdGlvbiB8fCBcIk5vIGRlc2NyaXB0aW9uXCJ9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvQ2FyZERlc2NyaXB0aW9uPlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxCYWRnZSB2YXJpYW50PXtnZXRTdGF0dXNDb2xvcihzZXNzaW9uLnN0YXR1cyl9PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtzZXNzaW9uLnN0YXR1c31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9CYWRnZT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbnQ9XCJnaG9zdFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZT1cInNtXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoZSkgPT4gaGFuZGxlRWRpdFNlc3Npb25DbGljayhzZXNzaW9uLCBlKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ0ZXh0LWJsdWUtNjAwIGhvdmVyOnRleHQtYmx1ZS03MDAgaG92ZXI6YmctYmx1ZS01MFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8UGVuY2lsIGNsYXNzTmFtZT1cImgtNCB3LTRcIiAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbnQ9XCJnaG9zdFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZT1cInNtXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoZSkgPT4gaGFuZGxlRGVsZXRlU2Vzc2lvbihzZXNzaW9uLnNlc3Npb25faWQsIGUpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpc2FibGVkPXtpc0RlbGV0aW5nID09PSBzZXNzaW9uLnNlc3Npb25faWR9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidGV4dC1yZWQtNjAwIGhvdmVyOnRleHQtcmVkLTcwMCBob3ZlcjpiZy1yZWQtNTBcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge2lzRGVsZXRpbmcgPT09IHNlc3Npb24uc2Vzc2lvbl9pZCA/IChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxMb2FkZXIyIGNsYXNzTmFtZT1cImgtNCB3LTQgYW5pbWF0ZS1zcGluXCIgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPFRyYXNoMiBjbGFzc05hbWU9XCJoLTQgdy00XCIgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8L0NhcmRIZWFkZXI+XG4gICAgICAgICAgICAgICAgICAgIDxDYXJkQ29udGVudD5cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImdyaWQgZ3JpZC1jb2xzLTIgZ2FwLTQgdGV4dC1zbVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiB0ZXh0LXNsYXRlLTYwMCBkYXJrOnRleHQtc2xhdGUtNDAwXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxVc2VycyBjbGFzc05hbWU9XCJoLTQgdy00XCIgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4+e3Nlc3Npb24ucGFydGljaXBhbnRfY291bnQgfHwgMH0gcGFydGljaXBhbnRzPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yIHRleHQtc2xhdGUtNjAwIGRhcms6dGV4dC1zbGF0ZS00MDBcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPEZpbGVUZXh0IGNsYXNzTmFtZT1cImgtNCB3LTRcIiAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8c3Bhbj57c2Vzc2lvbi5zdWJtaXNzaW9uX2NvdW50IHx8IDB9IHN1Ym1pc3Npb25zPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtdC00IHB0LTQgYm9yZGVyLXQgYm9yZGVyLXNsYXRlLTIwMCBkYXJrOmJvcmRlci1zbGF0ZS03MDBcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LXNsYXRlLTUwMCBkYXJrOnRleHQtc2xhdGUtNTAwXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxwPlN0YXJ0OiB7bmV3IERhdGUoc2Vzc2lvbi5zdGFydF9kYXRlKS50b0xvY2FsZURhdGVTdHJpbmcoKX08L3A+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxwPkVuZDoge25ldyBEYXRlKHNlc3Npb24uZW5kX2RhdGUpLnRvTG9jYWxlRGF0ZVN0cmluZygpfTwvcD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwibXQtMVwiPkNyZWF0ZWQgYnk6IHtzZXNzaW9uLmNyZWF0ZWRfYnlfbmFtZX08L3A+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPC9DYXJkQ29udGVudD5cbiAgICAgICAgICAgICAgICAgIDwvQ2FyZD5cbiAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICApfVxuICAgICAgICAgIDwvQ2FyZENvbnRlbnQ+XG4gICAgICAgIDwvQ2FyZD5cblxuICAgICAgICB7LyogUXVpY2sgQWN0aW9ucyAqL31cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJncmlkIGdyaWQtY29scy0xIG1kOmdyaWQtY29scy0zIGdhcC00XCI+XG4gICAgICAgICAgPENhcmRcbiAgICAgICAgICAgIGNsYXNzTmFtZT1cImN1cnNvci1wb2ludGVyIGhvdmVyOmJvcmRlci1ibHVlLTUwMCB0cmFuc2l0aW9uLWNvbG9yc1wiXG4gICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiByb3V0ZXIucHVzaChcIi9zdWJtaXNzaW9uc1wiKX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICA8Q2FyZEhlYWRlcj5cbiAgICAgICAgICAgICAgPENhcmRUaXRsZSBjbGFzc05hbWU9XCJ0ZXh0LWxnIGZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgPEZpbGVUZXh0IGNsYXNzTmFtZT1cImgtNSB3LTVcIiAvPlxuICAgICAgICAgICAgICAgIE15IEFuYWx5c2VzXG4gICAgICAgICAgICAgIDwvQ2FyZFRpdGxlPlxuICAgICAgICAgICAgPC9DYXJkSGVhZGVyPlxuICAgICAgICAgICAgPENhcmRDb250ZW50PlxuICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNtIHRleHQtc2xhdGUtNjAwIGRhcms6dGV4dC1zbGF0ZS00MDBcIj5cbiAgICAgICAgICAgICAgICBWaWV3IGFsbCB5b3VyIGRvY3VtZW50IGFuYWx5c2VzIGFuZCB0aGVpciBzdGF0dXNcbiAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgPC9DYXJkQ29udGVudD5cbiAgICAgICAgICA8L0NhcmQ+XG5cbiAgICAgICAgICA8Q2FyZFxuICAgICAgICAgICAgY2xhc3NOYW1lPVwiY3Vyc29yLXBvaW50ZXIgaG92ZXI6Ym9yZGVyLWJsdWUtNTAwIHRyYW5zaXRpb24tY29sb3JzXCJcbiAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFNob3dRdWlja1VwbG9hZERpYWxvZyh0cnVlKX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICA8Q2FyZEhlYWRlcj5cbiAgICAgICAgICAgICAgPENhcmRUaXRsZSBjbGFzc05hbWU9XCJ0ZXh0LWxnIGZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgPFVwbG9hZCBjbGFzc05hbWU9XCJoLTUgdy01XCIgLz5cbiAgICAgICAgICAgICAgICBRdWljayBVcGxvYWRcbiAgICAgICAgICAgICAgPC9DYXJkVGl0bGU+XG4gICAgICAgICAgICA8L0NhcmRIZWFkZXI+XG4gICAgICAgICAgICA8Q2FyZENvbnRlbnQ+XG4gICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtc20gdGV4dC1zbGF0ZS02MDAgZGFyazp0ZXh0LXNsYXRlLTQwMFwiPlxuICAgICAgICAgICAgICAgIFVwbG9hZCBhIGRvY3VtZW50IHRvIGFuIGF2YWlsYWJsZSBzZXNzaW9uXG4gICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgIDwvQ2FyZENvbnRlbnQ+XG4gICAgICAgICAgPC9DYXJkPlxuXG4gICAgICAgICAgPENhcmRcbiAgICAgICAgICAgIGNsYXNzTmFtZT1cImN1cnNvci1wb2ludGVyIGhvdmVyOmJvcmRlci1ibHVlLTUwMCB0cmFuc2l0aW9uLWNvbG9yc1wiXG4gICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiByb3V0ZXIucHVzaChcIi9vdmVybGF5c1wiKX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICA8Q2FyZEhlYWRlcj5cbiAgICAgICAgICAgICAgPENhcmRUaXRsZSBjbGFzc05hbWU9XCJ0ZXh0LWxnIGZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgPFNldHRpbmdzIGNsYXNzTmFtZT1cImgtNSB3LTVcIiAvPlxuICAgICAgICAgICAgICAgIEludGVsbGlnZW5jZSBTZXR1cFxuICAgICAgICAgICAgICA8L0NhcmRUaXRsZT5cbiAgICAgICAgICAgIDwvQ2FyZEhlYWRlcj5cbiAgICAgICAgICAgIDxDYXJkQ29udGVudD5cbiAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbSB0ZXh0LXNsYXRlLTYwMCBkYXJrOnRleHQtc2xhdGUtNDAwXCI+XG4gICAgICAgICAgICAgICAgQ3JlYXRlIGFuZCBtYW5hZ2UgaW50ZWxsaWdlbmNlIGV2YWx1YXRpb24gdGVtcGxhdGVzXG4gICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgIDwvQ2FyZENvbnRlbnQ+XG4gICAgICAgICAgPC9DYXJkPlxuICAgICAgICA8L2Rpdj5cblxuICAgICAgICB7LyogQ3JlYXRlIE5ldyBTZXNzaW9uIERpYWxvZyAqL31cbiAgICAgICAgPERpYWxvZyBvcGVuPXtzaG93TmV3U2Vzc2lvbkRpYWxvZ30gb25PcGVuQ2hhbmdlPXtzZXRTaG93TmV3U2Vzc2lvbkRpYWxvZ30+XG4gICAgICAgICAgPERpYWxvZ0NvbnRlbnQgY2xhc3NOYW1lPVwibWF4LXctMnhsXCI+XG4gICAgICAgICAgICA8RGlhbG9nSGVhZGVyPlxuICAgICAgICAgICAgICA8RGlhbG9nVGl0bGU+Q3JlYXRlIE5ldyBBbmFseXNpcyBTZXNzaW9uPC9EaWFsb2dUaXRsZT5cbiAgICAgICAgICAgICAgPERpYWxvZ0Rlc2NyaXB0aW9uPlxuICAgICAgICAgICAgICAgIENyZWF0ZSBhIG5ldyBhbmFseXNpcyBzZXNzaW9uIGZvciBkb2N1bWVudCBldmFsdWF0aW9uXG4gICAgICAgICAgICAgIDwvRGlhbG9nRGVzY3JpcHRpb24+XG4gICAgICAgICAgICA8L0RpYWxvZ0hlYWRlcj5cblxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTQgcHktNFwiPlxuICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgIDxMYWJlbCBodG1sRm9yPVwic2Vzc2lvbi1uYW1lXCI+U2Vzc2lvbiBOYW1lICo8L0xhYmVsPlxuICAgICAgICAgICAgICAgIDxJbnB1dFxuICAgICAgICAgICAgICAgICAgaWQ9XCJzZXNzaW9uLW5hbWVcIlxuICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJlLmcuLCBRMSAyMDI0IENvbnRyYWN0IFJldmlld1wiXG4gICAgICAgICAgICAgICAgICB2YWx1ZT17bmV3U2Vzc2lvbkRhdGEubmFtZX1cbiAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4gc2V0TmV3U2Vzc2lvbkRhdGEoeyAuLi5uZXdTZXNzaW9uRGF0YSwgbmFtZTogZS50YXJnZXQudmFsdWUgfSl9XG4gICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICA8TGFiZWwgaHRtbEZvcj1cInNlc3Npb24tZGVzY3JpcHRpb25cIj5EZXNjcmlwdGlvbjwvTGFiZWw+XG4gICAgICAgICAgICAgICAgPFRleHRhcmVhXG4gICAgICAgICAgICAgICAgICBpZD1cInNlc3Npb24tZGVzY3JpcHRpb25cIlxuICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJEZXNjcmliZSB0aGUgcHVycG9zZSBvZiB0aGlzIHJldmlldyBzZXNzaW9uLi4uXCJcbiAgICAgICAgICAgICAgICAgIHJvd3M9ezN9XG4gICAgICAgICAgICAgICAgICB2YWx1ZT17bmV3U2Vzc2lvbkRhdGEuZGVzY3JpcHRpb259XG4gICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHNldE5ld1Nlc3Npb25EYXRhKHsgLi4ubmV3U2Vzc2lvbkRhdGEsIGRlc2NyaXB0aW9uOiBlLnRhcmdldC52YWx1ZSB9KX1cbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgIDxMYWJlbCBodG1sRm9yPVwib3ZlcmxheS1zZWxlY3RcIj5FdmFsdWF0aW9uIE92ZXJsYXkgKjwvTGFiZWw+XG4gICAgICAgICAgICAgICAgPHNlbGVjdFxuICAgICAgICAgICAgICAgICAgaWQ9XCJvdmVybGF5LXNlbGVjdFwiXG4gICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgcHgtMyBweS0yIGJvcmRlciBib3JkZXItc2xhdGUtMzAwIHJvdW5kZWQtbWQgZm9jdXM6b3V0bGluZS1ub25lIGZvY3VzOnJpbmctMiBmb2N1czpyaW5nLWJsdWUtNTAwXCJcbiAgICAgICAgICAgICAgICAgIHZhbHVlPXtuZXdTZXNzaW9uRGF0YS5vdmVybGF5X2lkfVxuICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiBzZXROZXdTZXNzaW9uRGF0YSh7IC4uLm5ld1Nlc3Npb25EYXRhLCBvdmVybGF5X2lkOiBlLnRhcmdldC52YWx1ZSB9KX1cbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICA8b3B0aW9uIHZhbHVlPVwiXCI+U2VsZWN0IGFuIG92ZXJsYXkuLi48L29wdGlvbj5cbiAgICAgICAgICAgICAgICAgIHtvdmVybGF5cy5tYXAoKG92ZXJsYXkpID0+IChcbiAgICAgICAgICAgICAgICAgICAgPG9wdGlvbiBrZXk9e292ZXJsYXkub3ZlcmxheV9pZH0gdmFsdWU9e292ZXJsYXkub3ZlcmxheV9pZH0+XG4gICAgICAgICAgICAgICAgICAgICAge292ZXJsYXkubmFtZX1cbiAgICAgICAgICAgICAgICAgICAgPC9vcHRpb24+XG4gICAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgICA8L3NlbGVjdD5cbiAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtc2xhdGUtNTAwIG10LTFcIj5cbiAgICAgICAgICAgICAgICAgIENob29zZSB0aGUgZXZhbHVhdGlvbiBjcml0ZXJpYSB0ZW1wbGF0ZSBmb3IgdGhpcyBzZXNzaW9uXG4gICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImdyaWQgZ3JpZC1jb2xzLTIgZ2FwLTRcIj5cbiAgICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgICAgPExhYmVsIGh0bWxGb3I9XCJzdGFydC1kYXRlXCI+U3RhcnQgRGF0ZTwvTGFiZWw+XG4gICAgICAgICAgICAgICAgICA8SW5wdXRcbiAgICAgICAgICAgICAgICAgICAgaWQ9XCJzdGFydC1kYXRlXCJcbiAgICAgICAgICAgICAgICAgICAgdHlwZT1cImRhdGVcIlxuICAgICAgICAgICAgICAgICAgICB2YWx1ZT17bmV3U2Vzc2lvbkRhdGEuc3RhcnRfZGF0ZX1cbiAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiBzZXROZXdTZXNzaW9uRGF0YSh7IC4uLm5ld1Nlc3Npb25EYXRhLCBzdGFydF9kYXRlOiBlLnRhcmdldC52YWx1ZSB9KX1cbiAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgICAgPExhYmVsIGh0bWxGb3I9XCJlbmQtZGF0ZVwiPkVuZCBEYXRlPC9MYWJlbD5cbiAgICAgICAgICAgICAgICAgIDxJbnB1dFxuICAgICAgICAgICAgICAgICAgICBpZD1cImVuZC1kYXRlXCJcbiAgICAgICAgICAgICAgICAgICAgdHlwZT1cImRhdGVcIlxuICAgICAgICAgICAgICAgICAgICB2YWx1ZT17bmV3U2Vzc2lvbkRhdGEuZW5kX2RhdGV9XG4gICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4gc2V0TmV3U2Vzc2lvbkRhdGEoeyAuLi5uZXdTZXNzaW9uRGF0YSwgZW5kX2RhdGU6IGUudGFyZ2V0LnZhbHVlIH0pfVxuICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgPERpYWxvZ0Zvb3Rlcj5cbiAgICAgICAgICAgICAgPEJ1dHRvbiB2YXJpYW50PVwib3V0bGluZVwiIG9uQ2xpY2s9eygpID0+IHNldFNob3dOZXdTZXNzaW9uRGlhbG9nKGZhbHNlKX0+XG4gICAgICAgICAgICAgICAgQ2FuY2VsXG4gICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgICA8QnV0dG9uIG9uQ2xpY2s9e2hhbmRsZUNyZWF0ZVNlc3Npb259PlxuICAgICAgICAgICAgICAgIENyZWF0ZSBTZXNzaW9uXG4gICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgPC9EaWFsb2dGb290ZXI+XG4gICAgICAgICAgPC9EaWFsb2dDb250ZW50PlxuICAgICAgICA8L0RpYWxvZz5cblxuICAgICAgICB7LyogRWRpdCBTZXNzaW9uIERpYWxvZyAqL31cbiAgICAgICAgPERpYWxvZyBvcGVuPXtzaG93RWRpdFNlc3Npb25EaWFsb2d9IG9uT3BlbkNoYW5nZT17c2V0U2hvd0VkaXRTZXNzaW9uRGlhbG9nfT5cbiAgICAgICAgICA8RGlhbG9nQ29udGVudCBjbGFzc05hbWU9XCJtYXgtdy0yeGxcIj5cbiAgICAgICAgICAgIDxEaWFsb2dIZWFkZXI+XG4gICAgICAgICAgICAgIDxEaWFsb2dUaXRsZT5FZGl0IEFuYWx5c2lzIFNlc3Npb248L0RpYWxvZ1RpdGxlPlxuICAgICAgICAgICAgICA8RGlhbG9nRGVzY3JpcHRpb24+XG4gICAgICAgICAgICAgICAgVXBkYXRlIHRoZSBzZXNzaW9uIG5hbWUgYW5kIGRlc2NyaXB0aW9uXG4gICAgICAgICAgICAgIDwvRGlhbG9nRGVzY3JpcHRpb24+XG4gICAgICAgICAgICA8L0RpYWxvZ0hlYWRlcj5cblxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTQgcHktNFwiPlxuICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgIDxMYWJlbCBodG1sRm9yPVwiZWRpdC1zZXNzaW9uLW5hbWVcIj5TZXNzaW9uIE5hbWUgKjwvTGFiZWw+XG4gICAgICAgICAgICAgICAgPElucHV0XG4gICAgICAgICAgICAgICAgICBpZD1cImVkaXQtc2Vzc2lvbi1uYW1lXCJcbiAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiZS5nLiwgUTEgMjAyNCBDb250cmFjdCBSZXZpZXdcIlxuICAgICAgICAgICAgICAgICAgdmFsdWU9e2VkaXRTZXNzaW9uRGF0YS5uYW1lfVxuICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiBzZXRFZGl0U2Vzc2lvbkRhdGEoeyAuLi5lZGl0U2Vzc2lvbkRhdGEsIG5hbWU6IGUudGFyZ2V0LnZhbHVlIH0pfVxuICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgPExhYmVsIGh0bWxGb3I9XCJlZGl0LXNlc3Npb24tZGVzY3JpcHRpb25cIj5EZXNjcmlwdGlvbjwvTGFiZWw+XG4gICAgICAgICAgICAgICAgPFRleHRhcmVhXG4gICAgICAgICAgICAgICAgICBpZD1cImVkaXQtc2Vzc2lvbi1kZXNjcmlwdGlvblwiXG4gICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIkRlc2NyaWJlIHRoZSBwdXJwb3NlIG9mIHRoaXMgcmV2aWV3IHNlc3Npb24uLi5cIlxuICAgICAgICAgICAgICAgICAgcm93cz17M31cbiAgICAgICAgICAgICAgICAgIHZhbHVlPXtlZGl0U2Vzc2lvbkRhdGEuZGVzY3JpcHRpb259XG4gICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHNldEVkaXRTZXNzaW9uRGF0YSh7IC4uLmVkaXRTZXNzaW9uRGF0YSwgZGVzY3JpcHRpb246IGUudGFyZ2V0LnZhbHVlIH0pfVxuICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgIDxEaWFsb2dGb290ZXI+XG4gICAgICAgICAgICAgIDxCdXR0b24gdmFyaWFudD1cIm91dGxpbmVcIiBvbkNsaWNrPXsoKSA9PiBzZXRTaG93RWRpdFNlc3Npb25EaWFsb2coZmFsc2UpfSBkaXNhYmxlZD17aXNVcGRhdGluZ30+XG4gICAgICAgICAgICAgICAgQ2FuY2VsXG4gICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgICA8QnV0dG9uIG9uQ2xpY2s9e2hhbmRsZVVwZGF0ZVNlc3Npb259IGRpc2FibGVkPXtpc1VwZGF0aW5nfT5cbiAgICAgICAgICAgICAgICB7aXNVcGRhdGluZyA/IChcbiAgICAgICAgICAgICAgICAgIDw+XG4gICAgICAgICAgICAgICAgICAgIDxMb2FkZXIyIGNsYXNzTmFtZT1cImgtNCB3LTQgbXItMiBhbmltYXRlLXNwaW5cIiAvPlxuICAgICAgICAgICAgICAgICAgICBVcGRhdGluZy4uLlxuICAgICAgICAgICAgICAgICAgPC8+XG4gICAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICAgIFwiU2F2ZSBDaGFuZ2VzXCJcbiAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgICAgIDwvRGlhbG9nRm9vdGVyPlxuICAgICAgICAgIDwvRGlhbG9nQ29udGVudD5cbiAgICAgICAgPC9EaWFsb2c+XG5cbiAgICAgICAgey8qIFF1aWNrIFVwbG9hZCBEaWFsb2cgKi99XG4gICAgICAgIDxEaWFsb2cgb3Blbj17c2hvd1F1aWNrVXBsb2FkRGlhbG9nfSBvbk9wZW5DaGFuZ2U9e3NldFNob3dRdWlja1VwbG9hZERpYWxvZ30+XG4gICAgICAgICAgPERpYWxvZ0NvbnRlbnQgY2xhc3NOYW1lPVwibWF4LXctMnhsXCI+XG4gICAgICAgICAgICA8RGlhbG9nSGVhZGVyPlxuICAgICAgICAgICAgICA8RGlhbG9nVGl0bGU+UXVpY2sgVXBsb2FkPC9EaWFsb2dUaXRsZT5cbiAgICAgICAgICAgICAgPERpYWxvZ0Rlc2NyaXB0aW9uPlxuICAgICAgICAgICAgICAgIFVwbG9hZCBhIGRvY3VtZW50IHRvIGFuIGFjdGl2ZSByZXZpZXcgc2Vzc2lvblxuICAgICAgICAgICAgICA8L0RpYWxvZ0Rlc2NyaXB0aW9uPlxuICAgICAgICAgICAgPC9EaWFsb2dIZWFkZXI+XG5cbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS00IHB5LTRcIj5cbiAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICA8TGFiZWwgaHRtbEZvcj1cInVwbG9hZC1zZXNzaW9uXCI+U2VsZWN0IFNlc3Npb24gKjwvTGFiZWw+XG4gICAgICAgICAgICAgICAgPHNlbGVjdFxuICAgICAgICAgICAgICAgICAgaWQ9XCJ1cGxvYWQtc2Vzc2lvblwiXG4gICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgcHgtMyBweS0yIGJvcmRlciBib3JkZXItc2xhdGUtMzAwIHJvdW5kZWQtbWQgZm9jdXM6b3V0bGluZS1ub25lIGZvY3VzOnJpbmctMiBmb2N1czpyaW5nLWJsdWUtNTAwXCJcbiAgICAgICAgICAgICAgICAgIHZhbHVlPXt1cGxvYWREYXRhLnNlc3Npb25faWR9XG4gICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHNldFVwbG9hZERhdGEoeyAuLi51cGxvYWREYXRhLCBzZXNzaW9uX2lkOiBlLnRhcmdldC52YWx1ZSB9KX1cbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICA8b3B0aW9uIHZhbHVlPVwiXCI+Q2hvb3NlIGEgc2Vzc2lvbi4uLjwvb3B0aW9uPlxuICAgICAgICAgICAgICAgICAge3Nlc3Npb25zXG4gICAgICAgICAgICAgICAgICAgIC5maWx0ZXIoKHMpID0+IHMuc3RhdHVzID09PSBcImFjdGl2ZVwiKVxuICAgICAgICAgICAgICAgICAgICAubWFwKChzZXNzaW9uKSA9PiAoXG4gICAgICAgICAgICAgICAgICAgICAgPG9wdGlvbiBrZXk9e3Nlc3Npb24uc2Vzc2lvbl9pZH0gdmFsdWU9e3Nlc3Npb24uc2Vzc2lvbl9pZH0+XG4gICAgICAgICAgICAgICAgICAgICAgICB7c2Vzc2lvbi5uYW1lfVxuICAgICAgICAgICAgICAgICAgICAgIDwvb3B0aW9uPlxuICAgICAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgICA8L3NlbGVjdD5cbiAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICA8TGFiZWwgaHRtbEZvcj1cInVwbG9hZC1maWxlXCI+RG9jdW1lbnQgKjwvTGFiZWw+XG4gICAgICAgICAgICAgICAgPElucHV0XG4gICAgICAgICAgICAgICAgICBpZD1cInVwbG9hZC1maWxlXCJcbiAgICAgICAgICAgICAgICAgIHR5cGU9XCJmaWxlXCJcbiAgICAgICAgICAgICAgICAgIGFjY2VwdD1cIi5wZGYsLmRvYywuZG9jeCwudHh0XCJcbiAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXtoYW5kbGVGaWxlQ2hhbmdlfVxuICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LXNsYXRlLTUwMCBtdC0xXCI+XG4gICAgICAgICAgICAgICAgICBTdXBwb3J0ZWQgZm9ybWF0czogUERGLCBET0MsIERPQ1gsIFRYVFxuICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAge3VwbG9hZERhdGEuZG9jdW1lbnRfbmFtZSAmJiAoXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1ibHVlLTUwIGJvcmRlciBib3JkZXItYmx1ZS0yMDAgcm91bmRlZC1tZCBwLTNcIj5cbiAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtc20gdGV4dC1ibHVlLTkwMFwiPlxuICAgICAgICAgICAgICAgICAgICA8c3Ryb25nPlNlbGVjdGVkOjwvc3Ryb25nPiB7dXBsb2FkRGF0YS5kb2N1bWVudF9uYW1lfVxuICAgICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgIDxEaWFsb2dGb290ZXI+XG4gICAgICAgICAgICAgIDxCdXR0b24gdmFyaWFudD1cIm91dGxpbmVcIiBvbkNsaWNrPXsoKSA9PiBzZXRTaG93UXVpY2tVcGxvYWREaWFsb2coZmFsc2UpfT5cbiAgICAgICAgICAgICAgICBDYW5jZWxcbiAgICAgICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgICBvbkNsaWNrPXtoYW5kbGVRdWlja1VwbG9hZH1cbiAgICAgICAgICAgICAgICBkaXNhYmxlZD17IXVwbG9hZERhdGEuc2Vzc2lvbl9pZCB8fCAhdXBsb2FkRGF0YS5kb2N1bWVudF9jb250ZW50fVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgPFVwbG9hZCBjbGFzc05hbWU9XCJtci0yIGgtNCB3LTRcIiAvPlxuICAgICAgICAgICAgICAgIFVwbG9hZCBEb2N1bWVudFxuICAgICAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgICAgIDwvRGlhbG9nRm9vdGVyPlxuICAgICAgICAgIDwvRGlhbG9nQ29udGVudD5cbiAgICAgICAgPC9EaWFsb2c+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn1cbiJdfQ==
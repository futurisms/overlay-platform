"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Loader2, Calendar, Users, FileText, LogOut, Upload, Settings, Trash2, Plus, Pencil } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { getCurrentUser, logout } from "@/lib/auth";

interface Session {
  session_id: string;
  name: string;
  description: string;
  status: string;
  start_date: string;
  end_date: string;
  created_by_name: string;
  participant_count: number;
  submission_count: number;
  overlay_id: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [showNewSessionDialog, setShowNewSessionDialog] = useState(false);
  const [showQuickUploadDialog, setShowQuickUploadDialog] = useState(false);
  const [showEditSessionDialog, setShowEditSessionDialog] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editSessionData, setEditSessionData] = useState({ name: "", description: "" });
  const [isUpdating, setIsUpdating] = useState(false);
  const [newSessionData, setNewSessionData] = useState({
    name: "",
    description: "",
    overlay_id: "",
    start_date: "",
    end_date: "",
  });
  const [overlays, setOverlays] = useState<any[]>([]);
  const [uploadData, setUploadData] = useState({
    session_id: "",
    document_name: "",
    document_content: "",
  });

  useEffect(() => {
    // Check authentication
    const currentUser = getCurrentUser();
    if (!currentUser) {
      router.push("/login");
      return;
    }
    setUser(currentUser);

    // Check if user is admin (has system_admin group)
    const userIsAdmin = currentUser.groups?.includes('system_admin') || false;
    setIsAdmin(userIsAdmin);

    // Load sessions and overlays
    loadSessions();
    if (userIsAdmin) {
      loadOverlays(); // Only admins need overlays for creating sessions
    }
  }, [router]);

  const loadSessions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // For testing: Load ALL sessions instead of just available ones
      // In production, you might want to filter by available, active, user's sessions, etc.
      const result = await apiClient.getSessions();

      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setSessions(result.data.sessions || []);
      }
    } catch (err) {
      setError("Failed to load sessions");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadOverlays = async () => {
    try {
      const result = await apiClient.getOverlays();
      if (result.data) {
        setOverlays(result.data.overlays || []);
      }
    } catch (err) {
      console.error("Failed to load overlays:", err);
    }
  };

  const handleLogout = () => {
    logout();
    apiClient.clearToken();
    router.push("/login");
  };

  const handleSessionClick = (sessionId: string) => {
    router.push(`/session/${sessionId}`);
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm("Are you sure you want to delete this session? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(sessionId);
    try {
      const result = await apiClient.deleteSession(sessionId);
      if (result.error) {
        setError(result.error);
      } else {
        // Remove from list
        setSessions(sessions.filter(s => s.session_id !== sessionId));
      }
    } catch (err) {
      setError("Failed to delete session");
      console.error(err);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleEditSessionClick = (session: Session, e: React.MouseEvent) => {
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
      const result = await apiClient.updateSession(editingSession.session_id, {
        name: editSessionData.name,
        description: editSessionData.description,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setShowEditSessionDialog(false);
        setEditingSession(null);
        loadSessions(); // Refresh the list
      }
    } catch (err) {
      setError("Failed to update session");
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateSession = async () => {
    if (!newSessionData.name || !newSessionData.overlay_id) {
      setError("Session name and overlay are required");
      return;
    }

    try {
      const result = await apiClient.createSession({
        name: newSessionData.name,
        description: newSessionData.description,
        overlay_id: newSessionData.overlay_id,
        start_date: newSessionData.start_date || new Date().toISOString(),
        end_date: newSessionData.end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: "active",
      });

      if (result.error) {
        setError(result.error);
      } else {
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
    } catch (err) {
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
      const result = await apiClient.createSubmission({
        session_id: uploadData.session_id,
        overlay_id: selectedSession.overlay_id,
        document_name: uploadData.document_name,
        document_content: uploadData.document_content,
        file_size: uploadData.document_content.length,
      });

      if (result.error) {
        setError(result.error);
      } else {
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
    } catch (err) {
      setError("Failed to upload document");
      console.error(err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadData({ ...uploadData, document_name: file.name });

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      // Strip the data URL prefix (e.g., "data:application/pdf;base64,")
      const base64 = result.split(",")[1];
      setUploadData(prev => ({ ...prev, document_content: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const getStatusColor = (status: string) => {
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
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-slate-600" />
          <p className="text-slate-600 dark:text-slate-400">Loading analysis sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
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
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Available Sessions */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Analysis Sessions
                </CardTitle>
                <CardDescription>Select an analysis session to upload documents and view analyses</CardDescription>
              </div>
              <div className="flex gap-2">
                {isAdmin && (
                  <Button onClick={() => setShowNewSessionDialog(true)} variant="default" size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Analysis Session
                  </Button>
                )}
                <Button onClick={loadSessions} variant="outline" size="sm">
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                <p className="text-slate-600 dark:text-slate-400 mb-2">No analysis sessions available</p>
                <p className="text-sm text-slate-500 dark:text-slate-500">
                  Analysis sessions will appear here when they are created
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sessions.map((session) => (
                  <Card
                    key={session.session_id}
                    className="cursor-pointer hover:border-blue-500 transition-colors"
                    onClick={() => handleSessionClick(session.session_id)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg mb-1">{session.name}</CardTitle>
                          <CardDescription className="line-clamp-2">
                            {session.description || "No description"}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={getStatusColor(session.status)}>
                            {session.status}
                          </Badge>
                          {isAdmin && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => handleEditSessionClick(session, e)}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => handleDeleteSession(session.session_id, e)}
                                disabled={isDeleting === session.session_id}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                {isDeleting === session.session_id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          <Users className="h-4 w-4" />
                          <span>{session.participant_count || 0} participants</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          <FileText className="h-4 w-4" />
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className={`grid grid-cols-1 ${isAdmin ? 'md:grid-cols-3' : 'md:grid-cols-1'} gap-4`}>
          <Card
            className="cursor-pointer hover:border-blue-500 transition-colors"
            onClick={() => router.push("/submissions")}
          >
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                My Analyses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                View all your document analyses and their status
              </p>
            </CardContent>
          </Card>

          {isAdmin && (
            <>
              <Card
                className="cursor-pointer hover:border-blue-500 transition-colors"
                onClick={() => setShowQuickUploadDialog(true)}
              >
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Quick Upload
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Upload a document to an available session
                  </p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:border-blue-500 transition-colors"
                onClick={() => router.push("/overlays")}
              >
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Intelligence Setup
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Create and manage intelligence evaluation templates
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Create New Session Dialog */}
        <Dialog open={showNewSessionDialog} onOpenChange={setShowNewSessionDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Analysis Session</DialogTitle>
              <DialogDescription>
                Create a new analysis session for document evaluation
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="session-name">Session Name *</Label>
                <Input
                  id="session-name"
                  placeholder="e.g., Q1 2024 Contract Review"
                  value={newSessionData.name}
                  onChange={(e) => setNewSessionData({ ...newSessionData, name: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="session-description">Description</Label>
                <Textarea
                  id="session-description"
                  placeholder="Describe the purpose of this review session..."
                  rows={3}
                  value={newSessionData.description}
                  onChange={(e) => setNewSessionData({ ...newSessionData, description: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="overlay-select">Evaluation Overlay *</Label>
                <select
                  id="overlay-select"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newSessionData.overlay_id}
                  onChange={(e) => setNewSessionData({ ...newSessionData, overlay_id: e.target.value })}
                >
                  <option value="">Select an overlay...</option>
                  {overlays.map((overlay) => (
                    <option key={overlay.overlay_id} value={overlay.overlay_id}>
                      {overlay.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Choose the evaluation criteria template for this session
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={newSessionData.start_date}
                    onChange={(e) => setNewSessionData({ ...newSessionData, start_date: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={newSessionData.end_date}
                    onChange={(e) => setNewSessionData({ ...newSessionData, end_date: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewSessionDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateSession}>
                Create Session
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Session Dialog */}
        <Dialog open={showEditSessionDialog} onOpenChange={setShowEditSessionDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Analysis Session</DialogTitle>
              <DialogDescription>
                Update the session name and description
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="edit-session-name">Session Name *</Label>
                <Input
                  id="edit-session-name"
                  placeholder="e.g., Q1 2024 Contract Review"
                  value={editSessionData.name}
                  onChange={(e) => setEditSessionData({ ...editSessionData, name: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="edit-session-description">Description</Label>
                <Textarea
                  id="edit-session-description"
                  placeholder="Describe the purpose of this review session..."
                  rows={3}
                  value={editSessionData.description}
                  onChange={(e) => setEditSessionData({ ...editSessionData, description: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditSessionDialog(false)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button onClick={handleUpdateSession} disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Quick Upload Dialog */}
        <Dialog open={showQuickUploadDialog} onOpenChange={setShowQuickUploadDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Quick Upload</DialogTitle>
              <DialogDescription>
                Upload a document to an active review session
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="upload-session">Select Session *</Label>
                <select
                  id="upload-session"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={uploadData.session_id}
                  onChange={(e) => setUploadData({ ...uploadData, session_id: e.target.value })}
                >
                  <option value="">Choose a session...</option>
                  {sessions
                    .filter((s) => s.status === "active")
                    .map((session) => (
                      <option key={session.session_id} value={session.session_id}>
                        {session.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <Label htmlFor="upload-file">Document *</Label>
                <Input
                  id="upload-file"
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={handleFileChange}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Supported formats: PDF, DOC, DOCX, TXT
                </p>
              </div>

              {uploadData.document_name && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-sm text-blue-900">
                    <strong>Selected:</strong> {uploadData.document_name}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowQuickUploadDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleQuickUpload}
                disabled={!uploadData.session_id || !uploadData.document_content}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Document
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

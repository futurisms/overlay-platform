"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import {
  Loader2,
  ArrowLeft,
  Upload,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Layers,
  Users,
  Type,
  CheckCircle,
  Paperclip,
  X,
  Trash2,
  Edit,
  UserPlus,
  Copy,
  Mail,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { getCurrentUser } from "@/lib/auth";
import { toast } from "sonner";

interface Submission {
  submission_id: string;
  document_name: string;
  status: string;
  ai_analysis_status: string;
  submitted_at: string;
  submitted_by_name: string;
  overall_score: number | null;
}

interface Participant {
  user_id: string;
  role: string;
  joined_at: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface Overlay {
  overlay_id: string;
  name: string;
  description: string;
  document_type: string;
  document_purpose?: string;
  when_used?: string;
  process_context?: string;
  target_audience?: string;
  criteria?: any[];
}

export default function SessionPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params?.id as string;

  const [session, setSession] = useState<any>(null);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState<string>("");
  const [pastedTitle, setPastedTitle] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successSubmissionId, setSuccessSubmissionId] = useState<string | null>(null);
  const [successDocumentName, setSuccessDocumentName] = useState<string>("");
  const [appendixFiles, setAppendixFiles] = useState<File[]>([]);
  const [appendixError, setAppendixError] = useState<string | null>(null);
  const [deleteSubmissionId, setDeleteSubmissionId] = useState<string | null>(null);
  const [deleteSubmissionName, setDeleteSubmissionName] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Invitation modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [participantToRemove, setParticipantToRemove] = useState<{
    userId: string;
    firstName: string;
    lastName: string;
  } | null>(null);

  useEffect(() => {
    // Check authentication
    const user = getCurrentUser();
    console.log('🔍 DEBUG: Current user from localStorage:', user);
    console.log('🔍 DEBUG: User role:', user?.role);
    console.log('🔍 DEBUG: Is admin check:', user?.role === 'system_admin');
    setCurrentUser(user);
    if (!user) {
      router.push("/login");
      return;
    }

    if (sessionId) {
      loadSessionData();
    }
  }, [sessionId, router]);

  const loadSessionData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load session details and submissions in parallel
      const [sessionResult, submissionsResult] = await Promise.all([
        apiClient.getSession(sessionId),
        apiClient.getSessionSubmissions(sessionId),
      ]);

      if (sessionResult.error) {
        setError(sessionResult.error);
      } else if (sessionResult.data) {
        setSession(sessionResult.data);

        // Load overlay details if we have an overlay_id
        if (sessionResult.data.overlay_id) {
          const overlayResult = await apiClient.getOverlay(sessionResult.data.overlay_id);
          if (overlayResult.data) {
            setOverlay(overlayResult.data);
          }
        }
      }

      if (submissionsResult.data) {
        setSubmissions(submissionsResult.data.submissions || []);
      }
    } catch (err) {
      setError("Failed to load session data");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setUploadError(null);
    }
  };

  const handleAppendixSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files);
    const errors: string[] = [];

    // Validate each file
    for (const file of newFiles) {
      // Check if PDF
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        errors.push(`"${file.name}" is not a PDF file`);
        continue;
      }
      // Check size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        errors.push(`"${file.name}" exceeds 5MB limit (${(file.size / (1024 * 1024)).toFixed(2)}MB)`);
        continue;
      }
    }

    if (errors.length > 0) {
      setAppendixError(errors.join('. '));
      return;
    }

    // Add valid files to the list
    setAppendixFiles(prev => [...prev, ...newFiles]);
    setAppendixError(null);

    // Reset the input
    event.target.value = '';
  };

  const removeAppendix = (index: number) => {
    setAppendixFiles(prev => prev.filter((_, i) => i !== index));
    setAppendixError(null);
  };

  const handleUpload = async () => {
    if (!uploadFile || !session) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      // Read main file as base64
      const fileContent = await readFileAsBase64(uploadFile);

      // Read appendices as base64
      const appendicesData = [];
      for (let i = 0; i < appendixFiles.length; i++) {
        const appendixContent = await readFileAsBase64(appendixFiles[i]);
        appendicesData.push({
          file_name: appendixFiles[i].name,
          file_content: appendixContent,
          file_size: appendixFiles[i].size,
          upload_order: i + 1,
        });
      }

      const documentNameWithAppendices = uploadFile.name + (appendixFiles.length > 0 ? ` (+${appendixFiles.length} appendix${appendixFiles.length > 1 ? 'es' : ''})` : '');

      const result = await apiClient.createSubmission({
        session_id: sessionId,
        overlay_id: session.overlay_id,
        document_name: uploadFile.name,
        document_content: fileContent,
        file_size: uploadFile.size,
        appendices: appendicesData.length > 0 ? appendicesData : undefined,
      });

      if (result.error) {
        setUploadError(result.error);
      } else if (result.data?.submission_id) {
        // Success - show dialog
        setUploadFile(null);
        setAppendixFiles([]);
        setSuccessSubmissionId(result.data.submission_id);
        setSuccessDocumentName(documentNameWithAppendices);
        setShowSuccessDialog(true);
        await loadSessionData();
      }
    } catch (err) {
      setUploadError("Failed to upload document");
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handlePasteSubmit = async () => {
    if (!pastedText.trim() || !session) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      // Convert text to base64 (UTF-8 safe encoding)
      // Use TextEncoder for proper UTF-8 handling, then convert to base64
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(pastedText);
      const textContent = btoa(String.fromCharCode(...uint8Array));
      const textSizeBytes = new Blob([pastedText]).size;

      // Check size limit (10MB)
      const maxSizeBytes = 10 * 1024 * 1024; // 10MB
      if (textSizeBytes > maxSizeBytes) {
        setUploadError(`Text is too large (${(textSizeBytes / (1024 * 1024)).toFixed(2)}MB). Maximum size is 10MB.`);
        setIsUploading(false);
        return;
      }

      // Generate display name for pasted text
      const displayName = pastedTitle.trim() ||
        `Pasted Content - ${new Date().toLocaleDateString()}`;

      // Read appendices as base64
      const appendicesData = [];
      for (let i = 0; i < appendixFiles.length; i++) {
        const appendixContent = await readFileAsBase64(appendixFiles[i]);
        appendicesData.push({
          file_name: appendixFiles[i].name,
          file_content: appendixContent,
          file_size: appendixFiles[i].size,
          upload_order: i + 1,
        });
      }

      const documentNameWithAppendices = displayName + (appendixFiles.length > 0 ? ` (+${appendixFiles.length} appendix${appendixFiles.length > 1 ? 'es' : ''})` : '');

      const result = await apiClient.createSubmission({
        session_id: sessionId,
        overlay_id: session.overlay_id,
        document_name: displayName,
        document_content: textContent,
        file_size: textSizeBytes,
        is_pasted_text: true, // Flag to indicate this is pasted text
        appendices: appendicesData.length > 0 ? appendicesData : undefined,
      });

      if (result.error) {
        setUploadError(result.error);
      } else if (result.data?.submission_id) {
        // Success - clear text and show dialog
        setPastedText("");
        setPastedTitle("");
        setAppendixFiles([]);
        setSuccessSubmissionId(result.data.submission_id);
        setSuccessDocumentName(documentNameWithAppendices);
        setShowSuccessDialog(true);
        await loadSessionData();
      }
    } catch (err) {
      setUploadError("Failed to submit text");
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:text/plain;base64,")
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "in_progress":
        return "secondary";
      case "failed":
        return "destructive";
      default:
        return "outline";
    }
  };

  const handleSubmissionClick = (submissionId: string) => {
    router.push(`/submission/${submissionId}`);
  };

  const handleDeleteClick = (event: React.MouseEvent, submissionId: string, documentName: string) => {
    event.stopPropagation(); // Prevent navigation to submission detail
    setDeleteSubmissionId(submissionId);
    setDeleteSubmissionName(documentName);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteSubmissionId) return;

    setIsDeleting(true);
    try {
      const result = await apiClient.deleteSubmission(deleteSubmissionId);

      if (result.error) {
        setError(`Failed to delete submission: ${result.error}`);
      } else {
        // Remove from local state
        setSubmissions(prev => prev.filter(s => s.submission_id !== deleteSubmissionId));
        // Close dialog
        setDeleteSubmissionId(null);
        setDeleteSubmissionName("");
      }
    } catch (err) {
      setError("Failed to delete submission");
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteSubmissionId(null);
    setDeleteSubmissionName("");
  };

  // Invitation handlers
  const handleInviteClick = () => {
    setShowInviteModal(true);
    setInviteEmail("");
    setInviteError(null);
    setInviteSuccess(null);
    setInviteLink(null);
  };

  const handleInviteSubmit = async () => {
    if (!inviteEmail.trim()) {
      setInviteError("Email is required");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      setInviteError("Please enter a valid email address");
      return;
    }

    setIsInviting(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      const result = await apiClient.createInvitation(sessionId, inviteEmail);

      if (result.error) {
        setInviteError(result.error);
      } else if (result.data) {
        // Check if user already exists
        if (result.data.user) {
          setInviteSuccess(`${result.data.user.email} already has an account. Access has been granted to this session.`);
          setInviteLink(null);
        } else if (result.data.inviteLink) {
          setInviteSuccess("Invitation created successfully!");
          setInviteLink(result.data.inviteLink);
        }
      }
    } catch (err) {
      setInviteError("Failed to send invitation");
      console.error(err);
    } finally {
      setIsInviting(false);
    }
  };

  const handleCopyInviteLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      // Could add a toast notification here
    }
  };

  const handleCloseInviteModal = () => {
    setShowInviteModal(false);
    setInviteEmail("");
    setInviteError(null);
    setInviteSuccess(null);
    setInviteLink(null);
  };

  const handleRemoveParticipant = async () => {
    if (!participantToRemove) return;

    const { userId, firstName, lastName } = participantToRemove;
    setRemovingUserId(userId);

    try {
      const response = await apiClient.revokeSessionAccess(sessionId, userId);

      if (response.error) {
        throw new Error(response.error);
      }

      // Immediately update participants list in UI for instant feedback
      if (session && session.participants) {
        const updatedSession = {
          ...session,
          participants: session.participants.filter((p: any) => p.user_id !== userId)
        };
        setSession(updatedSession);
      }

      // Show success message
      toast.success(`${firstName} ${lastName} removed from session`);

      // Close dialog
      setParticipantToRemove(null);

      // Refresh data from server in background to ensure consistency
      await loadSessionData();

    } catch (error) {
      console.error('Error removing participant:', error);
      toast.error('Failed to remove participant. Please try again.');
    } finally {
      setRemovingUserId(null);
    }
  };

  const isAdmin = () => {
    const roleCheck = currentUser?.role === 'admin';
    const groupCheck = currentUser?.groups?.includes('system_admin');
    const result = roleCheck || groupCheck;
    console.log('🔍 DEBUG isAdmin(): currentUser?.role =', currentUser?.role, '| currentUser?.groups =', currentUser?.groups, '| roleCheck =', roleCheck, '| groupCheck =', groupCheck, '| Result:', result);
    return result;
  };

  // Helper functions for participants display
  const getUserInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "outline" => {
    if (role === 'admin' || role === 'owner' || role === 'moderator') return 'default';
    if (role === 'reviewer') return 'secondary';
    return 'outline';
  };

  const formatJoinedDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-slate-600" />
          <p className="text-slate-600 dark:text-slate-400">Loading session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" onClick={() => router.push("/dashboard")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>

          {session && (
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-50 mb-2">
                  {session.name}
                </h1>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  {session.description || "No description"}
                </p>
                <Badge variant={getStatusColor(session.status)}>{session.status}</Badge>
              </div>

              {/* Invite Analyst Button (Admin Only) */}
              {isAdmin() && (
                <div>
                  <Button onClick={handleInviteClick} variant="default">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Invite Analyst
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Document Context Section */}
        {session && overlay && (overlay.document_purpose || overlay.when_used || overlay.process_context || overlay.target_audience) && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Document Context</CardTitle>
              <CardDescription>
                Understanding the evaluation context for "{session.overlay_name}" documents
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {overlay.document_purpose && (
                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Document Purpose
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{overlay.document_purpose}</p>
                </div>
              )}
              {overlay.when_used && (
                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    When to Use
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{overlay.when_used}</p>
                </div>
              )}
              {overlay.process_context && (
                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Process Context
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{overlay.process_context}</p>
                </div>
              )}
              {overlay.target_audience && (
                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Target Audience
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{overlay.target_audience}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Evaluation Criteria Section - Admin Only */}
        {session && isAdmin() && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Evaluation Criteria
                  </CardTitle>
                  <CardDescription>
                    Your document will be evaluated against the "{session.overlay_name || 'overlay'}" criteria
                  </CardDescription>
                </div>
                {overlay?.overlay_id && (
                  <Button
                    onClick={() => router.push(`/overlays/${overlay.overlay_id}/edit-criteria`)}
                    variant="outline"
                    size="sm"
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Criteria
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {overlay && overlay.criteria && overlay.criteria.length > 0 ? (
                <div className="space-y-4">
                  {overlay.criteria.map((criterion: any, index: number) => (
                    <div
                      key={criterion.criteria_id || index}
                      className="border border-slate-200 dark:border-slate-700 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-lg text-slate-900 dark:text-slate-100">
                            {criterion.name}
                          </h4>
                          {criterion.category && (
                            <Badge variant="outline" className="mt-1">
                              {criterion.category}
                            </Badge>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
                            Weight: {criterion.weight}%
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-500">
                            Max Score: {criterion.max_score}
                          </div>
                        </div>
                      </div>
                      {criterion.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                          {criterion.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                  <p className="text-slate-600 dark:text-slate-400 mb-2">
                    Evaluation criteria for this session
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-500">
                    Documents will be analyzed by AI agents across multiple dimensions including structure, content quality, grammar, and compliance
                  </p>
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-left max-w-2xl mx-auto">
                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                      <h5 className="font-semibold text-sm mb-2">Structure Validation</h5>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Verifies document format, completeness, and adherence to templates
                      </p>
                    </div>
                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                      <h5 className="font-semibold text-sm mb-2">Content Analysis</h5>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Evaluates content quality, clarity, and completeness
                      </p>
                    </div>
                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                      <h5 className="font-semibold text-sm mb-2">Grammar Check</h5>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Identifies spelling, grammar, and writing quality issues
                      </p>
                    </div>
                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                      <h5 className="font-semibold text-sm mb-2">Compliance Review</h5>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Checks for regulatory compliance and risk factors
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Upload/Paste Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Submit Document
            </CardTitle>
            <CardDescription>Upload a file or paste text for AI analysis in this session</CardDescription>
          </CardHeader>
          <CardContent>
            {uploadError && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{uploadError}</AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Upload File
                </TabsTrigger>
                <TabsTrigger value="paste" className="flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  Paste Text
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                    Main Document
                  </label>
                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-8 text-center hover:border-slate-400 dark:hover:border-slate-600 transition-colors">
                    <input
                      type="file"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                      accept=".txt,.pdf,.docx,.doc"
                      disabled={isUploading}
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <FileText className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                      <p className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
                        {uploadFile ? uploadFile.name : "Click to upload or drag and drop"}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        PDF, DOCX, DOC, or TXT (max 10MB)
                      </p>
                    </label>
                  </div>
                </div>

                {/* Appendices Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Appendices (Optional)
                    </label>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      PDF only, max 5MB each
                    </span>
                  </div>

                  {appendixError && (
                    <Alert variant="destructive" className="mb-3">
                      <AlertDescription>{appendixError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-6 text-center hover:border-slate-400 dark:hover:border-slate-600 transition-colors">
                    <input
                      type="file"
                      onChange={handleAppendixSelect}
                      className="hidden"
                      id="appendix-upload"
                      accept=".pdf"
                      multiple
                      disabled={isUploading}
                    />
                    <label htmlFor="appendix-upload" className="cursor-pointer">
                      <Paperclip className="h-10 w-10 mx-auto mb-3 text-slate-400" />
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Add PDF appendices
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        e.g., Gantt charts, budgets, supporting documents
                      </p>
                    </label>
                  </div>

                  {/* Display selected appendices */}
                  {appendixFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {appendixFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-3 rounded-lg"
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <Paperclip className="h-4 w-4 text-slate-500" />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {file.name}
                            </span>
                            <span className="text-xs text-slate-500">
                              ({(file.size / 1024).toFixed(0)} KB)
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAppendix(index)}
                            disabled={isUploading}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {uploadFile && (
                  <div className="flex items-center gap-4">
                    <Button onClick={handleUpload} disabled={isUploading} className="flex-1">
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload Document{appendixFiles.length > 0 ? ` (+${appendixFiles.length} appendix${appendixFiles.length > 1 ? 'es' : ''})` : ''}
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setUploadFile(null);
                        setAppendixFiles([]);
                      }}
                      disabled={isUploading}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="paste" className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="paste-title" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Document Title (Optional)
                    </label>
                    <Input
                      id="paste-title"
                      placeholder="e.g., Contract Review Draft, Meeting Notes..."
                      value={pastedTitle}
                      onChange={(e) => setPastedTitle(e.target.value)}
                      disabled={isUploading}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      If not provided, will default to "Pasted Content - {new Date().toLocaleDateString()}"
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="paste-text" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Document Content
                    </label>
                    <Textarea
                      id="paste-text"
                      placeholder="Paste your document text here..."
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      className="min-h-[300px] font-mono text-sm"
                      disabled={isUploading}
                    />
                    <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                      <span>
                        {pastedText.length.toLocaleString()} characters
                        {pastedText.length > 0 && ` (${(new Blob([pastedText]).size / 1024).toFixed(2)} KB)`}
                      </span>
                      <span className="text-xs">
                        Maximum size: 10MB
                      </span>
                    </div>
                  </div>

                  {/* Appendices Section */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Appendices (Optional)
                      </label>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        PDF only, max 5MB each
                      </span>
                    </div>

                    {appendixError && (
                      <Alert variant="destructive" className="mb-3">
                        <AlertDescription>{appendixError}</AlertDescription>
                      </Alert>
                    )}

                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-6 text-center hover:border-slate-400 dark:hover:border-slate-600 transition-colors">
                      <input
                        type="file"
                        onChange={handleAppendixSelect}
                        className="hidden"
                        id="paste-appendix-upload"
                        accept=".pdf"
                        multiple
                        disabled={isUploading}
                      />
                      <label htmlFor="paste-appendix-upload" className="cursor-pointer">
                        <Paperclip className="h-10 w-10 mx-auto mb-3 text-slate-400" />
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Add PDF appendices
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          e.g., Gantt charts, budgets, supporting documents
                        </p>
                      </label>
                    </div>

                    {/* Display selected appendices */}
                    {appendixFiles.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {appendixFiles.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-3 rounded-lg"
                          >
                            <div className="flex items-center gap-2 flex-1">
                              <Paperclip className="h-4 w-4 text-slate-500" />
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {file.name}
                              </span>
                              <span className="text-xs text-slate-500">
                                ({(file.size / 1024).toFixed(0)} KB)
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeAppendix(index)}
                              disabled={isUploading}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {pastedText.trim().length > 0 && (
                  <div className="flex items-center gap-4">
                    <Button onClick={handlePasteSubmit} disabled={isUploading} className="flex-1">
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Submit Text{appendixFiles.length > 0 ? ` (+${appendixFiles.length} appendix${appendixFiles.length > 1 ? 'es' : ''})` : ''}
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPastedText("");
                        setPastedTitle("");
                        setAppendixFiles([]);
                      }}
                      disabled={isUploading}
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Success Dialog */}
        <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <DialogTitle className="text-xl">Document Submitted Successfully!</DialogTitle>
              </div>
              <DialogDescription className="text-base pt-2">
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  "{successDocumentName}"
                </span>{" "}
                has been uploaded and submitted for analysis.
              </DialogDescription>
            </DialogHeader>

            {/* Analysis in Progress Indicator */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
              <div className="flex items-start gap-3">
                <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    AI Analysis In Progress
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Our 6 AI agents are analyzing your document. This typically takes <strong>1-2 minutes</strong>.
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                    You can view real-time progress on the analysis page.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowSuccessDialog(false)}
                className="flex-1"
              >
                Stay Here
              </Button>
              <Button
                onClick={() => {
                  setShowSuccessDialog(false);
                  if (successSubmissionId) {
                    router.push(`/submission/${successSubmissionId}`);
                  }
                }}
                className="flex-1"
              >
                <FileText className="mr-2 h-4 w-4" />
                View Progress
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Invitation Modal */}
        <Dialog open={showInviteModal} onOpenChange={handleCloseInviteModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Invite Analyst to Session
              </DialogTitle>
              <DialogDescription>
                Send an invitation to an analyst to join "{session?.name}". They will receive an invite link to create their account.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {inviteError && (
                <Alert variant="destructive">
                  <AlertDescription>{inviteError}</AlertDescription>
                </Alert>
              )}

              {inviteSuccess && (
                <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <AlertDescription className="text-green-800 dark:text-green-300">
                    {inviteSuccess}
                  </AlertDescription>
                </Alert>
              )}

              {!inviteSuccess && (
                <>
                  <div className="space-y-2">
                    <label htmlFor="invite-email" className="text-sm font-medium">
                      Email Address
                    </label>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-slate-400" />
                      <Input
                        id="invite-email"
                        type="email"
                        placeholder="analyst@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        disabled={isInviting}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      onClick={handleInviteSubmit}
                      disabled={isInviting || !inviteEmail.trim()}
                      className="flex-1"
                    >
                      {isInviting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail className="mr-2 h-4 w-4" />
                          Send Invitation
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCloseInviteModal}
                      disabled={isInviting}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              )}

              {inviteLink && (
                <div className="space-y-3">
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-900">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2 block">
                      Invitation Link
                    </label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm bg-white dark:bg-slate-800 px-3 py-2 rounded border border-slate-200 dark:border-slate-700 overflow-x-auto">
                        {inviteLink}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCopyInviteLink}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Share this link with the analyst. The invitation expires in 7 days.
                  </p>

                  <Button
                    onClick={handleCloseInviteModal}
                    className="w-full"
                  >
                    Done
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Participants Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Session Participants ({session?.participants?.length || 0})
            </CardTitle>
            <CardDescription>Users with access to this analysis session</CardDescription>
          </CardHeader>
          <CardContent>
            {!session?.participants || session.participants.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                <p className="text-slate-600 dark:text-slate-400 mb-2">No participants yet</p>
                <p className="text-sm text-slate-500 dark:text-slate-500">
                  Invite users to collaborate on this session
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {session.participants.map((participant: Participant) => (
                  <div
                    key={participant.user_id}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:border-blue-500 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar with initials */}
                      <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
                        {getUserInitials(participant.first_name || 'U', participant.last_name || 'N')}
                      </div>

                      {/* Participant details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm truncate">
                            {participant.first_name} {participant.last_name}
                          </p>
                          <Badge variant={getRoleBadgeVariant(participant.role)} className="text-xs">
                            {participant.role}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 truncate mb-1">
                          {participant.email}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-500">
                          Joined {formatJoinedDate(participant.joined_at)}
                        </p>
                      </div>

                      {/* Remove button (admin only, can't remove self) */}
                      {isAdmin() && participant.user_id !== currentUser?.sub && (
                        <button
                          onClick={() => setParticipantToRemove({
                            userId: participant.user_id,
                            firstName: participant.first_name,
                            lastName: participant.last_name
                          })}
                          disabled={removingUserId === participant.user_id}
                          className={`text-red-500 hover:text-red-700 transition-colors flex-shrink-0 ${
                            removingUserId === participant.user_id ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          title="Remove access"
                        >
                          {removingUserId === participant.user_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submissions List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Analyses ({submissions.length})
                </CardTitle>
                <CardDescription>Documents submitted to this analysis session</CardDescription>
              </div>
              <Button onClick={loadSessionData} variant="outline" size="sm">
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {submissions.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                <p className="text-slate-600 dark:text-slate-400 mb-2">No analyses yet</p>
                <p className="text-sm text-slate-500 dark:text-slate-500">
                  Upload a document to get started
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {submissions.map((submission) => (
                  <div
                    key={submission.submission_id}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:border-blue-500 transition-colors cursor-pointer"
                    onClick={() => handleSubmissionClick(submission.submission_id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-lg">{submission.document_name}</h4>
                          <Badge variant={getStatusColor(submission.ai_analysis_status)}>
                            {submission.ai_analysis_status}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                          Submitted by {submission.submitted_by_name} on{" "}
                          {new Date(submission.submitted_at).toLocaleString()}
                        </p>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(submission.ai_analysis_status)}
                            <span className="text-slate-600 dark:text-slate-400">
                              Status: {submission.status}
                            </span>
                          </div>
                          {submission.overall_score !== null && (
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                Score: {submission.overall_score}/100
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                        onClick={(e) => handleDeleteClick(e, submission.submission_id, submission.document_name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteSubmissionId !== null} onOpenChange={(open) => !open && handleDeleteCancel()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Submission</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{deleteSubmissionName}</strong>?
                This action cannot be undone and will permanently remove the submission,
                all associated feedback, and analysis results.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleDeleteCancel} disabled={isDeleting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Remove Participant Confirmation Dialog */}
        <AlertDialog
          open={participantToRemove !== null}
          onOpenChange={(open) => !open && setParticipantToRemove(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Participant?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2">
                  <p>
                    Are you sure you want to remove{' '}
                    <span className="font-semibold">
                      {participantToRemove?.firstName} {participantToRemove?.lastName}
                    </span>{' '}
                    from this session?
                  </p>
                  <p className="text-red-600 text-sm">
                    They will immediately lose access to all submissions in this session.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={removingUserId !== null}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleRemoveParticipant();
                }}
                disabled={removingUserId !== null}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                {removingUserId ? 'Removing...' : 'Remove Participant'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

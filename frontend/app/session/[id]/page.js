"use client";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SessionPage;
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
const badge_1 = require("@/components/ui/badge");
const alert_1 = require("@/components/ui/alert");
const tabs_1 = require("@/components/ui/tabs");
const textarea_1 = require("@/components/ui/textarea");
const input_1 = require("@/components/ui/input");
const dialog_1 = require("@/components/ui/dialog");
const lucide_react_1 = require("lucide-react");
const api_client_1 = require("@/lib/api-client");
const auth_1 = require("@/lib/auth");
function SessionPage() {
    const router = (0, navigation_1.useRouter)();
    const params = (0, navigation_1.useParams)();
    const sessionId = params?.id;
    const [session, setSession] = (0, react_1.useState)(null);
    const [overlay, setOverlay] = (0, react_1.useState)(null);
    const [submissions, setSubmissions] = (0, react_1.useState)([]);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const [uploadFile, setUploadFile] = (0, react_1.useState)(null);
    const [pastedText, setPastedText] = (0, react_1.useState)("");
    const [pastedTitle, setPastedTitle] = (0, react_1.useState)("");
    const [isUploading, setIsUploading] = (0, react_1.useState)(false);
    const [uploadError, setUploadError] = (0, react_1.useState)(null);
    const [showSuccessDialog, setShowSuccessDialog] = (0, react_1.useState)(false);
    const [successSubmissionId, setSuccessSubmissionId] = (0, react_1.useState)(null);
    const [successDocumentName, setSuccessDocumentName] = (0, react_1.useState)("");
    const [appendixFiles, setAppendixFiles] = (0, react_1.useState)([]);
    const [appendixError, setAppendixError] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        // Check authentication
        const currentUser = (0, auth_1.getCurrentUser)();
        if (!currentUser) {
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
                api_client_1.apiClient.getSession(sessionId),
                api_client_1.apiClient.getSessionSubmissions(sessionId),
            ]);
            if (sessionResult.error) {
                setError(sessionResult.error);
            }
            else if (sessionResult.data) {
                setSession(sessionResult.data);
                // Load overlay details if we have an overlay_id
                if (sessionResult.data.overlay_id) {
                    const overlayResult = await api_client_1.apiClient.getOverlay(sessionResult.data.overlay_id);
                    if (overlayResult.data) {
                        setOverlay(overlayResult.data);
                    }
                }
            }
            if (submissionsResult.data) {
                setSubmissions(submissionsResult.data.submissions || []);
            }
        }
        catch (err) {
            setError("Failed to load session data");
            console.error(err);
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleFileSelect = (event) => {
        const file = event.target.files?.[0];
        if (file) {
            setUploadFile(file);
            setUploadError(null);
        }
    };
    const handleAppendixSelect = (event) => {
        const files = event.target.files;
        if (!files || files.length === 0)
            return;
        const newFiles = Array.from(files);
        const errors = [];
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
    const removeAppendix = (index) => {
        setAppendixFiles(prev => prev.filter((_, i) => i !== index));
        setAppendixError(null);
    };
    const handleUpload = async () => {
        if (!uploadFile || !session)
            return;
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
            const result = await api_client_1.apiClient.createSubmission({
                session_id: sessionId,
                overlay_id: session.overlay_id,
                document_name: uploadFile.name,
                document_content: fileContent,
                file_size: uploadFile.size,
                appendices: appendicesData.length > 0 ? appendicesData : undefined,
            });
            if (result.error) {
                setUploadError(result.error);
            }
            else if (result.data?.submission_id) {
                // Success - show dialog
                setUploadFile(null);
                setAppendixFiles([]);
                setSuccessSubmissionId(result.data.submission_id);
                setSuccessDocumentName(documentNameWithAppendices);
                setShowSuccessDialog(true);
                await loadSessionData();
            }
        }
        catch (err) {
            setUploadError("Failed to upload document");
            console.error(err);
        }
        finally {
            setIsUploading(false);
        }
    };
    const handlePasteSubmit = async () => {
        if (!pastedText.trim() || !session)
            return;
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
            const result = await api_client_1.apiClient.createSubmission({
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
            }
            else if (result.data?.submission_id) {
                // Success - clear text and show dialog
                setPastedText("");
                setPastedTitle("");
                setAppendixFiles([]);
                setSuccessSubmissionId(result.data.submission_id);
                setSuccessDocumentName(documentNameWithAppendices);
                setShowSuccessDialog(true);
                await loadSessionData();
            }
        }
        catch (err) {
            setUploadError("Failed to submit text");
            console.error(err);
        }
        finally {
            setIsUploading(false);
        }
    };
    const readFileAsBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result;
                // Remove data URL prefix (e.g., "data:text/plain;base64,")
                const base64 = result.split(",")[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };
    const getStatusIcon = (status) => {
        switch (status) {
            case "completed":
                return <lucide_react_1.CheckCircle2 className="h-4 w-4 text-green-600"/>;
            case "in_progress":
                return <lucide_react_1.Clock className="h-4 w-4 text-yellow-600"/>;
            case "failed":
                return <lucide_react_1.XCircle className="h-4 w-4 text-red-600"/>;
            default:
                return <lucide_react_1.Clock className="h-4 w-4 text-slate-400"/>;
        }
    };
    const getStatusColor = (status) => {
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
    const handleSubmissionClick = (submissionId) => {
        router.push(`/submission/${submissionId}`);
    };
    if (isLoading) {
        return (<div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <lucide_react_1.Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-slate-600"/>
          <p className="text-slate-600 dark:text-slate-400">Loading session...</p>
        </div>
      </div>);
    }
    return (<div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <button_1.Button variant="ghost" onClick={() => router.push("/dashboard")} className="mb-4">
            <lucide_react_1.ArrowLeft className="mr-2 h-4 w-4"/>
            Back to Dashboard
          </button_1.Button>

          {session && (<div className="flex items-start justify-between">
              <div>
                <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-50 mb-2">
                  {session.name}
                </h1>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  {session.description || "No description"}
                </p>
                <badge_1.Badge variant={getStatusColor(session.status)}>{session.status}</badge_1.Badge>
              </div>
            </div>)}
        </div>

        {error && (<alert_1.Alert variant="destructive" className="mb-6">
            <alert_1.AlertDescription>{error}</alert_1.AlertDescription>
          </alert_1.Alert>)}

        {/* Document Context Section */}
        {session && overlay && (overlay.document_purpose || overlay.when_used || overlay.process_context || overlay.target_audience) && (<card_1.Card className="mb-6">
            <card_1.CardHeader>
              <card_1.CardTitle>Document Context</card_1.CardTitle>
              <card_1.CardDescription>
                Understanding the evaluation context for "{session.overlay_name}" documents
              </card_1.CardDescription>
            </card_1.CardHeader>
            <card_1.CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {overlay.document_purpose && (<div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <lucide_react_1.FileText className="h-4 w-4"/>
                    Document Purpose
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{overlay.document_purpose}</p>
                </div>)}
              {overlay.when_used && (<div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <lucide_react_1.Clock className="h-4 w-4"/>
                    When to Use
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{overlay.when_used}</p>
                </div>)}
              {overlay.process_context && (<div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <lucide_react_1.Layers className="h-4 w-4"/>
                    Process Context
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{overlay.process_context}</p>
                </div>)}
              {overlay.target_audience && (<div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <lucide_react_1.Users className="h-4 w-4"/>
                    Target Audience
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{overlay.target_audience}</p>
                </div>)}
            </card_1.CardContent>
          </card_1.Card>)}

        {/* Evaluation Criteria Section */}
        {session && (<card_1.Card className="mb-8">
            <card_1.CardHeader>
              <card_1.CardTitle className="flex items-center gap-2">
                <lucide_react_1.FileText className="h-5 w-5"/>
                Evaluation Criteria
              </card_1.CardTitle>
              <card_1.CardDescription>
                Your document will be evaluated against the "{session.overlay_name || 'overlay'}" criteria
              </card_1.CardDescription>
            </card_1.CardHeader>
            <card_1.CardContent>
              {overlay && overlay.criteria && overlay.criteria.length > 0 ? (<div className="space-y-4">
                  {overlay.criteria.map((criterion, index) => (<div key={criterion.criterion_id || index} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-lg text-slate-900 dark:text-slate-100">
                            {criterion.name}
                          </h4>
                          {criterion.category && (<badge_1.Badge variant="outline" className="mt-1">
                              {criterion.category}
                            </badge_1.Badge>)}
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
                      {criterion.description && (<p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                          {criterion.description}
                        </p>)}
                    </div>))}
                </div>) : (<div className="text-center py-8">
                  <lucide_react_1.FileText className="h-12 w-12 mx-auto mb-4 text-slate-400"/>
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
                </div>)}
            </card_1.CardContent>
          </card_1.Card>)}

        {/* Upload/Paste Section */}
        <card_1.Card className="mb-8">
          <card_1.CardHeader>
            <card_1.CardTitle className="flex items-center gap-2">
              <lucide_react_1.Upload className="h-5 w-5"/>
              Submit Document
            </card_1.CardTitle>
            <card_1.CardDescription>Upload a file or paste text for AI analysis in this session</card_1.CardDescription>
          </card_1.CardHeader>
          <card_1.CardContent>
            {uploadError && (<alert_1.Alert variant="destructive" className="mb-4">
                <alert_1.AlertDescription>{uploadError}</alert_1.AlertDescription>
              </alert_1.Alert>)}

            <tabs_1.Tabs defaultValue="upload" className="w-full">
              <tabs_1.TabsList className="grid w-full grid-cols-2">
                <tabs_1.TabsTrigger value="upload" className="flex items-center gap-2">
                  <lucide_react_1.Upload className="h-4 w-4"/>
                  Upload File
                </tabs_1.TabsTrigger>
                <tabs_1.TabsTrigger value="paste" className="flex items-center gap-2">
                  <lucide_react_1.Type className="h-4 w-4"/>
                  Paste Text
                </tabs_1.TabsTrigger>
              </tabs_1.TabsList>

              <tabs_1.TabsContent value="upload" className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                    Main Document
                  </label>
                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-8 text-center hover:border-slate-400 dark:hover:border-slate-600 transition-colors">
                    <input type="file" onChange={handleFileSelect} className="hidden" id="file-upload" accept=".txt,.pdf,.docx,.doc" disabled={isUploading}/>
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <lucide_react_1.FileText className="h-12 w-12 mx-auto mb-4 text-slate-400"/>
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

                  {appendixError && (<alert_1.Alert variant="destructive" className="mb-3">
                      <alert_1.AlertDescription>{appendixError}</alert_1.AlertDescription>
                    </alert_1.Alert>)}

                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-6 text-center hover:border-slate-400 dark:hover:border-slate-600 transition-colors">
                    <input type="file" onChange={handleAppendixSelect} className="hidden" id="appendix-upload" accept=".pdf" multiple disabled={isUploading}/>
                    <label htmlFor="appendix-upload" className="cursor-pointer">
                      <lucide_react_1.Paperclip className="h-10 w-10 mx-auto mb-3 text-slate-400"/>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Add PDF appendices
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        e.g., Gantt charts, budgets, supporting documents
                      </p>
                    </label>
                  </div>

                  {/* Display selected appendices */}
                  {appendixFiles.length > 0 && (<div className="mt-3 space-y-2">
                      {appendixFiles.map((file, index) => (<div key={index} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-3 rounded-lg">
                          <div className="flex items-center gap-2 flex-1">
                            <lucide_react_1.Paperclip className="h-4 w-4 text-slate-500"/>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {file.name}
                            </span>
                            <span className="text-xs text-slate-500">
                              ({(file.size / 1024).toFixed(0)} KB)
                            </span>
                          </div>
                          <button_1.Button variant="ghost" size="sm" onClick={() => removeAppendix(index)} disabled={isUploading}>
                            <lucide_react_1.X className="h-4 w-4"/>
                          </button_1.Button>
                        </div>))}
                    </div>)}
                </div>

                {uploadFile && (<div className="flex items-center gap-4">
                    <button_1.Button onClick={handleUpload} disabled={isUploading} className="flex-1">
                      {isUploading ? (<>
                          <lucide_react_1.Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                          Uploading...
                        </>) : (<>
                          <lucide_react_1.Upload className="mr-2 h-4 w-4"/>
                          Upload Document{appendixFiles.length > 0 ? ` (+${appendixFiles.length} appendix${appendixFiles.length > 1 ? 'es' : ''})` : ''}
                        </>)}
                    </button_1.Button>
                    <button_1.Button variant="outline" onClick={() => {
                setUploadFile(null);
                setAppendixFiles([]);
            }} disabled={isUploading}>
                      Cancel
                    </button_1.Button>
                  </div>)}
              </tabs_1.TabsContent>

              <tabs_1.TabsContent value="paste" className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="paste-title" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Document Title (Optional)
                    </label>
                    <input_1.Input id="paste-title" placeholder="e.g., Contract Review Draft, Meeting Notes..." value={pastedTitle} onChange={(e) => setPastedTitle(e.target.value)} disabled={isUploading} className="w-full"/>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      If not provided, will default to "Pasted Content - {new Date().toLocaleDateString()}"
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="paste-text" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Document Content
                    </label>
                    <textarea_1.Textarea id="paste-text" placeholder="Paste your document text here..." value={pastedText} onChange={(e) => setPastedText(e.target.value)} className="min-h-[300px] font-mono text-sm" disabled={isUploading}/>
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

                    {appendixError && (<alert_1.Alert variant="destructive" className="mb-3">
                        <alert_1.AlertDescription>{appendixError}</alert_1.AlertDescription>
                      </alert_1.Alert>)}

                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-6 text-center hover:border-slate-400 dark:hover:border-slate-600 transition-colors">
                      <input type="file" onChange={handleAppendixSelect} className="hidden" id="paste-appendix-upload" accept=".pdf" multiple disabled={isUploading}/>
                      <label htmlFor="paste-appendix-upload" className="cursor-pointer">
                        <lucide_react_1.Paperclip className="h-10 w-10 mx-auto mb-3 text-slate-400"/>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Add PDF appendices
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          e.g., Gantt charts, budgets, supporting documents
                        </p>
                      </label>
                    </div>

                    {/* Display selected appendices */}
                    {appendixFiles.length > 0 && (<div className="mt-3 space-y-2">
                        {appendixFiles.map((file, index) => (<div key={index} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-3 rounded-lg">
                            <div className="flex items-center gap-2 flex-1">
                              <lucide_react_1.Paperclip className="h-4 w-4 text-slate-500"/>
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {file.name}
                              </span>
                              <span className="text-xs text-slate-500">
                                ({(file.size / 1024).toFixed(0)} KB)
                              </span>
                            </div>
                            <button_1.Button variant="ghost" size="sm" onClick={() => removeAppendix(index)} disabled={isUploading}>
                              <lucide_react_1.X className="h-4 w-4"/>
                            </button_1.Button>
                          </div>))}
                      </div>)}
                  </div>
                </div>

                {pastedText.trim().length > 0 && (<div className="flex items-center gap-4">
                    <button_1.Button onClick={handlePasteSubmit} disabled={isUploading} className="flex-1">
                      {isUploading ? (<>
                          <lucide_react_1.Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                          Submitting...
                        </>) : (<>
                          <lucide_react_1.Upload className="mr-2 h-4 w-4"/>
                          Submit Text{appendixFiles.length > 0 ? ` (+${appendixFiles.length} appendix${appendixFiles.length > 1 ? 'es' : ''})` : ''}
                        </>)}
                    </button_1.Button>
                    <button_1.Button variant="outline" onClick={() => {
                setPastedText("");
                setPastedTitle("");
                setAppendixFiles([]);
            }} disabled={isUploading}>
                      Clear
                    </button_1.Button>
                  </div>)}
              </tabs_1.TabsContent>
            </tabs_1.Tabs>
          </card_1.CardContent>
        </card_1.Card>

        {/* Success Dialog */}
        <dialog_1.Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
          <dialog_1.DialogContent className="sm:max-w-md">
            <dialog_1.DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                  <lucide_react_1.CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400"/>
                </div>
                <dialog_1.DialogTitle className="text-xl">Document Submitted Successfully!</dialog_1.DialogTitle>
              </div>
              <dialog_1.DialogDescription className="text-base pt-2">
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  "{successDocumentName}"
                </span>{" "}
                has been uploaded and submitted for analysis.
              </dialog_1.DialogDescription>
            </dialog_1.DialogHeader>

            {/* Analysis in Progress Indicator */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
              <div className="flex items-start gap-3">
                <lucide_react_1.Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin mt-0.5 flex-shrink-0"/>
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
              <button_1.Button variant="outline" onClick={() => setShowSuccessDialog(false)} className="flex-1">
                Stay Here
              </button_1.Button>
              <button_1.Button onClick={() => {
            setShowSuccessDialog(false);
            if (successSubmissionId) {
                router.push(`/submission/${successSubmissionId}`);
            }
        }} className="flex-1">
                <lucide_react_1.FileText className="mr-2 h-4 w-4"/>
                View Progress
              </button_1.Button>
            </div>
          </dialog_1.DialogContent>
        </dialog_1.Dialog>

        {/* Submissions List */}
        <card_1.Card>
          <card_1.CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <card_1.CardTitle className="flex items-center gap-2">
                  <lucide_react_1.FileText className="h-5 w-5"/>
                  Analyses ({submissions.length})
                </card_1.CardTitle>
                <card_1.CardDescription>Documents submitted to this analysis session</card_1.CardDescription>
              </div>
              <button_1.Button onClick={loadSessionData} variant="outline" size="sm">
                Refresh
              </button_1.Button>
            </div>
          </card_1.CardHeader>
          <card_1.CardContent>
            {submissions.length === 0 ? (<div className="text-center py-8">
                <lucide_react_1.FileText className="h-12 w-12 mx-auto mb-4 text-slate-400"/>
                <p className="text-slate-600 dark:text-slate-400 mb-2">No analyses yet</p>
                <p className="text-sm text-slate-500 dark:text-slate-500">
                  Upload a document to get started
                </p>
              </div>) : (<div className="space-y-4">
                {submissions.map((submission) => (<div key={submission.submission_id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:border-blue-500 transition-colors cursor-pointer" onClick={() => handleSubmissionClick(submission.submission_id)}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-lg">{submission.document_name}</h4>
                          <badge_1.Badge variant={getStatusColor(submission.ai_analysis_status)}>
                            {submission.ai_analysis_status}
                          </badge_1.Badge>
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
                          {submission.overall_score !== null && (<div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                Score: {submission.overall_score}/100
                              </span>
                            </div>)}
                        </div>
                      </div>
                    </div>
                  </div>))}
              </div>)}
          </card_1.CardContent>
        </card_1.Card>
      </div>
    </div>);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInBhZ2UudHN4Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFlBQVksQ0FBQzs7O0FBcURiLDhCQTIzQkM7QUE5NkJELGlDQUE0QztBQUM1QyxnREFBdUQ7QUFDdkQsK0NBQWlHO0FBQ2pHLG1EQUFnRDtBQUNoRCxpREFBOEM7QUFDOUMsaURBQWdFO0FBRWhFLCtDQUFnRjtBQUNoRix1REFBb0Q7QUFDcEQsaURBQThDO0FBQzlDLG1EQUE2RztBQUM3RywrQ0Fjc0I7QUFDdEIsaURBQTZDO0FBQzdDLHFDQUE0QztBQXdCNUMsU0FBd0IsV0FBVztJQUNqQyxNQUFNLE1BQU0sR0FBRyxJQUFBLHNCQUFTLEdBQUUsQ0FBQztJQUMzQixNQUFNLE1BQU0sR0FBRyxJQUFBLHNCQUFTLEdBQUUsQ0FBQztJQUMzQixNQUFNLFNBQVMsR0FBRyxNQUFNLEVBQUUsRUFBWSxDQUFDO0lBRXZDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsVUFBVSxDQUFDLEdBQUcsSUFBQSxnQkFBUSxFQUFNLElBQUksQ0FBQyxDQUFDO0lBQ2xELE1BQU0sQ0FBQyxPQUFPLEVBQUUsVUFBVSxDQUFDLEdBQUcsSUFBQSxnQkFBUSxFQUFpQixJQUFJLENBQUMsQ0FBQztJQUM3RCxNQUFNLENBQUMsV0FBVyxFQUFFLGNBQWMsQ0FBQyxHQUFHLElBQUEsZ0JBQVEsRUFBZSxFQUFFLENBQUMsQ0FBQztJQUNqRSxNQUFNLENBQUMsU0FBUyxFQUFFLFlBQVksQ0FBQyxHQUFHLElBQUEsZ0JBQVEsRUFBQyxJQUFJLENBQUMsQ0FBQztJQUNqRCxNQUFNLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxHQUFHLElBQUEsZ0JBQVEsRUFBZ0IsSUFBSSxDQUFDLENBQUM7SUFDeEQsTUFBTSxDQUFDLFVBQVUsRUFBRSxhQUFhLENBQUMsR0FBRyxJQUFBLGdCQUFRLEVBQWMsSUFBSSxDQUFDLENBQUM7SUFDaEUsTUFBTSxDQUFDLFVBQVUsRUFBRSxhQUFh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SSxJQUFJLENBQ3BDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyx5QkFBeUIsQ0FDdEM7OEJBQUEsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLGtEQUFrRCxDQUNoRTt1Q0FBTyxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUM7OEJBQ25DLEVBQUUsSUFBSSxDQUNSOzRCQUFBLEVBQUUsR0FBRyxDQUFDLENBQ1AsQ0FDSDt3QkFBQSxFQUFFLEdBQUcsQ0FDUDtzQkFBQSxFQUFFLEdBQUcsQ0FDUDtvQkFBQSxFQUFFLEdBQUcsQ0FDUDtrQkFBQSxFQUFFLEdBQUcsQ0FBQyxDQUNQLENBQUMsQ0FDSjtjQUFBLEVBQUUsR0FBRyxDQUFDLENBQ1AsQ0FDSDtVQUFBLEVBQUUsa0JBQVcsQ0FDZjtRQUFBLEVBQUUsV0FBSSxDQUNSO01BQUEsRUFBRSxHQUFHLENBQ1A7SUFBQSxFQUFFLEdBQUcsQ0FBQyxDQUNQLENBQUM7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiXCJ1c2UgY2xpZW50XCI7XG5cbmltcG9ydCB7IHVzZUVmZmVjdCwgdXNlU3RhdGUgfSBmcm9tIFwicmVhY3RcIjtcbmltcG9ydCB7IHVzZVJvdXRlciwgdXNlUGFyYW1zIH0gZnJvbSBcIm5leHQvbmF2aWdhdGlvblwiO1xuaW1wb3J0IHsgQ2FyZCwgQ2FyZENvbnRlbnQsIENhcmREZXNjcmlwdGlvbiwgQ2FyZEhlYWRlciwgQ2FyZFRpdGxlIH0gZnJvbSBcIkAvY29tcG9uZW50cy91aS9jYXJkXCI7XG5pbXBvcnQgeyBCdXR0b24gfSBmcm9tIFwiQC9jb21wb25lbnRzL3VpL2J1dHRvblwiO1xuaW1wb3J0IHsgQmFkZ2UgfSBmcm9tIFwiQC9jb21wb25lbnRzL3VpL2JhZGdlXCI7XG5pbXBvcnQgeyBBbGVydCwgQWxlcnREZXNjcmlwdGlvbiB9IGZyb20gXCJAL2NvbXBvbmVudHMvdWkvYWxlcnRcIjtcbmltcG9ydCB7IFByb2dyZXNzIH0gZnJvbSBcIkAvY29tcG9uZW50cy91aS9wcm9ncmVzc1wiO1xuaW1wb3J0IHsgVGFicywgVGFic0NvbnRlbnQsIFRhYnNMaXN0LCBUYWJzVHJpZ2dlciB9IGZyb20gXCJAL2NvbXBvbmVudHMvdWkvdGFic1wiO1xuaW1wb3J0IHsgVGV4dGFyZWEgfSBmcm9tIFwiQC9jb21wb25lbnRzL3VpL3RleHRhcmVhXCI7XG5pbXBvcnQgeyBJbnB1dCB9IGZyb20gXCJAL2NvbXBvbmVudHMvdWkvaW5wdXRcIjtcbmltcG9ydCB7IERpYWxvZywgRGlhbG9nQ29udGVudCwgRGlhbG9nRGVzY3JpcHRpb24sIERpYWxvZ0hlYWRlciwgRGlhbG9nVGl0bGUgfSBmcm9tIFwiQC9jb21wb25lbnRzL3VpL2RpYWxvZ1wiO1xuaW1wb3J0IHtcbiAgTG9hZGVyMixcbiAgQXJyb3dMZWZ0LFxuICBVcGxvYWQsXG4gIEZpbGVUZXh0LFxuICBDbG9jayxcbiAgQ2hlY2tDaXJjbGUyLFxuICBYQ2lyY2xlLFxuICBMYXllcnMsXG4gIFVzZXJzLFxuICBUeXBlLFxuICBDaGVja0NpcmNsZSxcbiAgUGFwZXJjbGlwLFxuICBYLFxufSBmcm9tIFwibHVjaWRlLXJlYWN0XCI7XG5pbXBvcnQgeyBhcGlDbGllbnQgfSBmcm9tIFwiQC9saWIvYXBpLWNsaWVudFwiO1xuaW1wb3J0IHsgZ2V0Q3VycmVudFVzZXIgfSBmcm9tIFwiQC9saWIvYXV0aFwiO1xuXG5pbnRlcmZhY2UgU3VibWlzc2lvbiB7XG4gIHN1Ym1pc3Npb25faWQ6IHN0cmluZztcbiAgZG9jdW1lbnRfbmFtZTogc3RyaW5nO1xuICBzdGF0dXM6IHN0cmluZztcbiAgYWlfYW5hbHlzaXNfc3RhdHVzOiBzdHJpbmc7XG4gIHN1Ym1pdHRlZF9hdDogc3RyaW5nO1xuICBzdWJtaXR0ZWRfYnlfbmFtZTogc3RyaW5nO1xuICBvdmVyYWxsX3Njb3JlOiBudW1iZXIgfCBudWxsO1xufVxuXG5pbnRlcmZhY2UgT3ZlcmxheSB7XG4gIG92ZXJsYXlfaWQ6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBkZXNjcmlwdGlvbjogc3RyaW5nO1xuICBkb2N1bWVudF90eXBlOiBzdHJpbmc7XG4gIGRvY3VtZW50X3B1cnBvc2U/OiBzdHJpbmc7XG4gIHdoZW5fdXNlZD86IHN0cmluZztcbiAgcHJvY2Vzc19jb250ZXh0Pzogc3RyaW5nO1xuICB0YXJnZXRfYXVkaWVuY2U/OiBzdHJpbmc7XG4gIGNyaXRlcmlhPzogYW55W107XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIFNlc3Npb25QYWdlKCkge1xuICBjb25zdCByb3V0ZXIgPSB1c2VSb3V0ZXIoKTtcbiAgY29uc3QgcGFyYW1zID0gdXNlUGFyYW1zKCk7XG4gIGNvbnN0IHNlc3Npb25JZCA9IHBhcmFtcz8uaWQgYXMgc3RyaW5nO1xuXG4gIGNvbnN0IFtzZXNzaW9uLCBzZXRTZXNzaW9uXSA9IHVzZVN0YXRlPGFueT4obnVsbCk7XG4gIGNvbnN0IFtvdmVybGF5LCBzZXRPdmVybGF5XSA9IHVzZVN0YXRlPE92ZXJsYXkgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW3N1Ym1pc3Npb25zLCBzZXRTdWJtaXNzaW9uc10gPSB1c2VTdGF0ZTxTdWJtaXNzaW9uW10+KFtdKTtcbiAgY29uc3QgW2lzTG9hZGluZywgc2V0SXNMb2FkaW5nXSA9IHVzZVN0YXRlKHRydWUpO1xuICBjb25zdCBbZXJyb3IsIHNldEVycm9yXSA9IHVzZVN0YXRlPHN0cmluZyB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbdXBsb2FkRmlsZSwgc2V0VXBsb2FkRmlsZV0gPSB1c2VTdGF0ZTxGaWxlIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtwYXN0ZWRUZXh0LCBzZXRQYXN0ZWRUZXh0XSA9IHVzZVN0YXRlPHN0cmluZz4oXCJcIik7XG4gIGNvbnN0IFtwYXN0ZWRUaXRsZSwgc2V0UGFzdGVkVGl0bGVdID0gdXNlU3RhdGU8c3RyaW5nPihcIlwiKTtcbiAgY29uc3QgW2lzVXBsb2FkaW5nLCBzZXRJc1VwbG9hZGluZ10gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IFt1cGxvYWRFcnJvciwgc2V0VXBsb2FkRXJyb3JdID0gdXNlU3RhdGU8c3RyaW5nIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtzaG93U3VjY2Vzc0RpYWxvZywgc2V0U2hvd1N1Y2Nlc3NEaWFsb2ddID0gdXNlU3RhdGUoZmFsc2UpO1xuICBjb25zdCBbc3VjY2Vzc1N1Ym1pc3Npb25JZCwgc2V0U3VjY2Vzc1N1Ym1pc3Npb25JZF0gPSB1c2VTdGF0ZTxzdHJpbmcgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW3N1Y2Nlc3NEb2N1bWVudE5hbWUsIHNldFN1Y2Nlc3NEb2N1bWVudE5hbWVdID0gdXNlU3RhdGU8c3RyaW5nPihcIlwiKTtcbiAgY29uc3QgW2FwcGVuZGl4RmlsZXMsIHNldEFwcGVuZGl4RmlsZXNdID0gdXNlU3RhdGU8RmlsZVtdPihbXSk7XG4gIGNvbnN0IFthcHBlbmRpeEVycm9yLCBzZXRBcHBlbmRpeEVycm9yXSA9IHVzZVN0YXRlPHN0cmluZyB8IG51bGw+KG51bGwpO1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgLy8gQ2hlY2sgYXV0aGVudGljYXRpb25cbiAgICBjb25zdCBjdXJyZW50VXNlciA9IGdldEN1cnJlbnRVc2VyKCk7XG4gICAgaWYgKCFjdXJyZW50VXNlcikge1xuICAgICAgcm91dGVyLnB1c2goXCIvbG9naW5cIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNlc3Npb25JZCkge1xuICAgICAgbG9hZFNlc3Npb25EYXRhKCk7XG4gICAgfVxuICB9LCBbc2Vzc2lvbklkLCByb3V0ZXJdKTtcblxuICBjb25zdCBsb2FkU2Vzc2lvbkRhdGEgPSBhc3luYyAoKSA9PiB7XG4gICAgc2V0SXNMb2FkaW5nKHRydWUpO1xuICAgIHNldEVycm9yKG51bGwpO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIExvYWQgc2Vzc2lvbiBkZXRhaWxzIGFuZCBzdWJtaXNzaW9ucyBpbiBwYXJhbGxlbFxuICAgICAgY29uc3QgW3Nlc3Npb25SZXN1bHQsIHN1Ym1pc3Npb25zUmVzdWx0XSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgICAgYXBpQ2xpZW50LmdldFNlc3Npb24oc2Vzc2lvbklkKSxcbiAgICAgICAgYXBpQ2xpZW50LmdldFNlc3Npb25TdWJtaXNzaW9ucyhzZXNzaW9uSWQpLFxuICAgICAgXSk7XG5cbiAgICAgIGlmIChzZXNzaW9uUmVzdWx0LmVycm9yKSB7XG4gICAgICAgIHNldEVycm9yKHNlc3Npb25SZXN1bHQuZXJyb3IpO1xuICAgICAgfSBlbHNlIGlmIChzZXNzaW9uUmVzdWx0LmRhdGEpIHtcbiAgICAgICAgc2V0U2Vzc2lvbihzZXNzaW9uUmVzdWx0LmRhdGEpO1xuXG4gICAgICAgIC8vIExvYWQgb3ZlcmxheSBkZXRhaWxzIGlmIHdlIGhhdmUgYW4gb3ZlcmxheV9pZFxuICAgICAgICBpZiAoc2Vzc2lvblJlc3VsdC5kYXRhLm92ZXJsYXlfaWQpIHtcbiAgICAgICAgICBjb25zdCBvdmVybGF5UmVzdWx0ID0gYXdhaXQgYXBpQ2xpZW50LmdldE92ZXJsYXkoc2Vzc2lvblJlc3VsdC5kYXRhLm92ZXJsYXlfaWQpO1xuICAgICAgICAgIGlmIChvdmVybGF5UmVzdWx0LmRhdGEpIHtcbiAgICAgICAgICAgIHNldE92ZXJsYXkob3ZlcmxheVJlc3VsdC5kYXRhKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHN1Ym1pc3Npb25zUmVzdWx0LmRhdGEpIHtcbiAgICAgICAgc2V0U3VibWlzc2lvbnMoc3VibWlzc2lvbnNSZXN1bHQuZGF0YS5zdWJtaXNzaW9ucyB8fCBbXSk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBzZXRFcnJvcihcIkZhaWxlZCB0byBsb2FkIHNlc3Npb24gZGF0YVwiKTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgc2V0SXNMb2FkaW5nKGZhbHNlKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlRmlsZVNlbGVjdCA9IChldmVudDogUmVhY3QuQ2hhbmdlRXZlbnQ8SFRNTElucHV0RWxlbWVudD4pID0+IHtcbiAgICBjb25zdCBmaWxlID0gZXZlbnQudGFyZ2V0LmZpbGVzPy5bMF07XG4gICAgaWYgKGZpbGUpIHtcbiAgICAgIHNldFVwbG9hZEZpbGUoZmlsZSk7XG4gICAgICBzZXRVcGxvYWRFcnJvcihudWxsKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlQXBwZW5kaXhTZWxlY3QgPSAoZXZlbnQ6IFJlYWN0LkNoYW5nZUV2ZW50PEhUTUxJbnB1dEVsZW1lbnQ+KSA9PiB7XG4gICAgY29uc3QgZmlsZXMgPSBldmVudC50YXJnZXQuZmlsZXM7XG4gICAgaWYgKCFmaWxlcyB8fCBmaWxlcy5sZW5ndGggPT09IDApIHJldHVybjtcblxuICAgIGNvbnN0IG5ld0ZpbGVzID0gQXJyYXkuZnJvbShmaWxlcyk7XG4gICAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgLy8gVmFsaWRhdGUgZWFjaCBmaWxlXG4gICAgZm9yIChjb25zdCBmaWxlIG9mIG5ld0ZpbGVzKSB7XG4gICAgICAvLyBDaGVjayBpZiBQREZcbiAgICAgIGlmICghZmlsZS5uYW1lLnRvTG93ZXJDYXNlKCkuZW5kc1dpdGgoJy5wZGYnKSkge1xuICAgICAgICBlcnJvcnMucHVzaChgXCIke2ZpbGUubmFtZX1cIiBpcyBub3QgYSBQREYgZmlsZWApO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8vIENoZWNrIHNpemUgKDVNQiBtYXgpXG4gICAgICBpZiAoZmlsZS5zaXplID4gNSAqIDEwMjQgKiAxMDI0KSB7XG4gICAgICAgIGVycm9ycy5wdXNoKGBcIiR7ZmlsZS5uYW1lfVwiIGV4Y2VlZHMgNU1CIGxpbWl0ICgkeyhmaWxlLnNpemUgLyAoMTAyNCAqIDEwMjQpKS50b0ZpeGVkKDIpfU1CKWApO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICAgIHNldEFwcGVuZGl4RXJyb3IoZXJyb3JzLmpvaW4oJy4gJykpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIEFkZCB2YWxpZCBmaWxlcyB0byB0aGUgbGlzdFxuICAgIHNldEFwcGVuZGl4RmlsZXMocHJldiA9PiBbLi4ucHJldiwgLi4ubmV3RmlsZXNdKTtcbiAgICBzZXRBcHBlbmRpeEVycm9yKG51bGwpO1xuXG4gICAgLy8gUmVzZXQgdGhlIGlucHV0XG4gICAgZXZlbnQudGFyZ2V0LnZhbHVlID0gJyc7XG4gIH07XG5cbiAgY29uc3QgcmVtb3ZlQXBwZW5kaXggPSAoaW5kZXg6IG51bWJlcikgPT4ge1xuICAgIHNldEFwcGVuZGl4RmlsZXMocHJldiA9PiBwcmV2LmZpbHRlcigoXywgaSkgPT4gaSAhPT0gaW5kZXgpKTtcbiAgICBzZXRBcHBlbmRpeEVycm9yKG51bGwpO1xuICB9O1xuXG4gIGNvbnN0IGhhbmRsZVVwbG9hZCA9IGFzeW5jICgpID0+IHtcbiAgICBpZiAoIXVwbG9hZEZpbGUgfHwgIXNlc3Npb24pIHJldHVybjtcblxuICAgIHNldElzVXBsb2FkaW5nKHRydWUpO1xuICAgIHNldFVwbG9hZEVycm9yKG51bGwpO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIFJlYWQgbWFpbiBmaWxlIGFzIGJhc2U2NFxuICAgICAgY29uc3QgZmlsZUNvbnRlbnQgPSBhd2FpdCByZWFkRmlsZUFzQmFzZTY0KHVwbG9hZEZpbGUpO1xuXG4gICAgICAvLyBSZWFkIGFwcGVuZGljZXMgYXMgYmFzZTY0XG4gICAgICBjb25zdCBhcHBlbmRpY2VzRGF0YSA9IFtdO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcHBlbmRpeEZpbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGFwcGVuZGl4Q29udGVudCA9IGF3YWl0IHJlYWRGaWxlQXNCYXNlNjQoYXBwZW5kaXhGaWxlc1tpXSk7XG4gICAgICAgIGFwcGVuZGljZXNEYXRhLnB1c2goe1xuICAgICAgICAgIGZpbGVfbmFtZTogYXBwZW5kaXhGaWxlc1tpXS5uYW1lLFxuICAgICAgICAgIGZpbGVfY29udGVudDogYXBwZW5kaXhDb250ZW50LFxuICAgICAgICAgIGZpbGVfc2l6ZTogYXBwZW5kaXhGaWxlc1tpXS5zaXplLFxuICAgICAgICAgIHVwbG9hZF9vcmRlcjogaSArIDEsXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBkb2N1bWVudE5hbWVXaXRoQXBwZW5kaWNlcyA9IHVwbG9hZEZpbGUubmFtZSArIChhcHBlbmRpeEZpbGVzLmxlbmd0aCA+IDAgPyBgICgrJHthcHBlbmRpeEZpbGVzLmxlbmd0aH0gYXBwZW5kaXgke2FwcGVuZGl4RmlsZXMubGVuZ3RoID4gMSA/ICdlcycgOiAnJ30pYCA6ICcnKTtcblxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYXBpQ2xpZW50LmNyZWF0ZVN1Ym1pc3Npb24oe1xuICAgICAgICBzZXNzaW9uX2lkOiBzZXNzaW9uSWQsXG4gICAgICAgIG92ZXJsYXlfaWQ6IHNlc3Npb24ub3ZlcmxheV9pZCxcbiAgICAgICAgZG9jdW1lbnRfbmFtZTogdXBsb2FkRmlsZS5uYW1lLFxuICAgICAgICBkb2N1bWVudF9jb250ZW50OiBmaWxlQ29udGVudCxcbiAgICAgICAgZmlsZV9zaXplOiB1cGxvYWRGaWxlLnNpemUsXG4gICAgICAgIGFwcGVuZGljZXM6IGFwcGVuZGljZXNEYXRhLmxlbmd0aCA+IDAgPyBhcHBlbmRpY2VzRGF0YSA6IHVuZGVmaW5lZCxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAocmVzdWx0LmVycm9yKSB7XG4gICAgICAgIHNldFVwbG9hZEVycm9yKHJlc3VsdC5lcnJvcik7XG4gICAgICB9IGVsc2UgaWYgKHJlc3VsdC5kYXRhPy5zdWJtaXNzaW9uX2lkKSB7XG4gICAgICAgIC8vIFN1Y2Nlc3MgLSBzaG93IGRpYWxvZ1xuICAgICAgICBzZXRVcGxvYWRGaWxlKG51bGwpO1xuICAgICAgICBzZXRBcHBlbmRpeEZpbGVzKFtdKTtcbiAgICAgICAgc2V0U3VjY2Vzc1N1Ym1pc3Npb25JZChyZXN1bHQuZGF0YS5zdWJtaXNzaW9uX2lkKTtcbiAgICAgICAgc2V0U3VjY2Vzc0RvY3VtZW50TmFtZShkb2N1bWVudE5hbWVXaXRoQXBwZW5kaWNlcyk7XG4gICAgICAgIHNldFNob3dTdWNjZXNzRGlhbG9nKHRydWUpO1xuICAgICAgICBhd2FpdCBsb2FkU2Vzc2lvbkRhdGEoKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHNldFVwbG9hZEVycm9yKFwiRmFpbGVkIHRvIHVwbG9hZCBkb2N1bWVudFwiKTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgc2V0SXNVcGxvYWRpbmcoZmFsc2UpO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBoYW5kbGVQYXN0ZVN1Ym1pdCA9IGFzeW5jICgpID0+IHtcbiAgICBpZiAoIXBhc3RlZFRleHQudHJpbSgpIHx8ICFzZXNzaW9uKSByZXR1cm47XG5cbiAgICBzZXRJc1VwbG9hZGluZyh0cnVlKTtcbiAgICBzZXRVcGxvYWRFcnJvcihudWxsKTtcblxuICAgIHRyeSB7XG4gICAgICAvLyBDb252ZXJ0IHRleHQgdG8gYmFzZTY0IChVVEYtOCBzYWZlIGVuY29kaW5nKVxuICAgICAgLy8gVXNlIFRleHRFbmNvZGVyIGZvciBwcm9wZXIgVVRGLTggaGFuZGxpbmcsIHRoZW4gY29udmVydCB0byBiYXNlNjRcbiAgICAgIGNvbnN0IGVuY29kZXIgPSBuZXcgVGV4dEVuY29kZXIoKTtcbiAgICAgIGNvbnN0IHVpbnQ4QXJyYXkgPSBlbmNvZGVyLmVuY29kZShwYXN0ZWRUZXh0KTtcbiAgICAgIGNvbnN0IHRleHRDb250ZW50ID0gYnRvYShTdHJpbmcuZnJvbUNoYXJDb2RlKC4uLnVpbnQ4QXJyYXkpKTtcbiAgICAgIGNvbnN0IHRleHRTaXplQnl0ZXMgPSBuZXcgQmxvYihbcGFzdGVkVGV4dF0pLnNpemU7XG5cbiAgICAgIC8vIENoZWNrIHNpemUgbGltaXQgKDEwTUIpXG4gICAgICBjb25zdCBtYXhTaXplQnl0ZXMgPSAxMCAqIDEwMjQgKiAxMDI0OyAvLyAxME1CXG4gICAgICBpZiAodGV4dFNpemVCeXRlcyA+IG1heFNpemVCeXRlcykge1xuICAgICAgICBzZXRVcGxvYWRFcnJvcihgVGV4dCBpcyB0b28gbGFyZ2UgKCR7KHRleHRTaXplQnl0ZXMgLyAoMTAyNCAqIDEwMjQpKS50b0ZpeGVkKDIpfU1CKS4gTWF4aW11bSBzaXplIGlzIDEwTUIuYCk7XG4gICAgICAgIHNldElzVXBsb2FkaW5nKGZhbHNlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBHZW5lcmF0ZSBkaXNwbGF5IG5hbWUgZm9yIHBhc3RlZCB0ZXh0XG4gICAgICBjb25zdCBkaXNwbGF5TmFtZSA9IHBhc3RlZFRpdGxlLnRyaW0oKSB8fFxuICAgICAgICBgUGFzdGVkIENvbnRlbnQgLSAke25ldyBEYXRlKCkudG9Mb2NhbGVEYXRlU3RyaW5nKCl9YDtcblxuICAgICAgLy8gUmVhZCBhcHBlbmRpY2VzIGFzIGJhc2U2NFxuICAgICAgY29uc3QgYXBwZW5kaWNlc0RhdGEgPSBbXTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXBwZW5kaXhGaWxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBhcHBlbmRpeENvbnRlbnQgPSBhd2FpdCByZWFkRmlsZUFzQmFzZTY0KGFwcGVuZGl4RmlsZXNbaV0pO1xuICAgICAgICBhcHBlbmRpY2VzRGF0YS5wdXNoKHtcbiAgICAgICAgICBmaWxlX25hbWU6IGFwcGVuZGl4RmlsZXNbaV0ubmFtZSxcbiAgICAgICAgICBmaWxlX2NvbnRlbnQ6IGFwcGVuZGl4Q29udGVudCxcbiAgICAgICAgICBmaWxlX3NpemU6IGFwcGVuZGl4RmlsZXNbaV0uc2l6ZSxcbiAgICAgICAgICB1cGxvYWRfb3JkZXI6IGkgKyAxLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZG9jdW1lbnROYW1lV2l0aEFwcGVuZGljZXMgPSBkaXNwbGF5TmFtZSArIChhcHBlbmRpeEZpbGVzLmxlbmd0aCA+IDAgPyBgICgrJHthcHBlbmRpeEZpbGVzLmxlbmd0aH0gYXBwZW5kaXgke2FwcGVuZGl4RmlsZXMubGVuZ3RoID4gMSA/ICdlcycgOiAnJ30pYCA6ICcnKTtcblxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYXBpQ2xpZW50LmNyZWF0ZVN1Ym1pc3Npb24oe1xuICAgICAgICBzZXNzaW9uX2lkOiBzZXNzaW9uSWQsXG4gICAgICAgIG92ZXJsYXlfaWQ6IHNlc3Npb24ub3ZlcmxheV9pZCxcbiAgICAgICAgZG9jdW1lbnRfbmFtZTogZGlzcGxheU5hbWUsXG4gICAgICAgIGRvY3VtZW50X2NvbnRlbnQ6IHRleHRDb250ZW50LFxuICAgICAgICBmaWxlX3NpemU6IHRleHRTaXplQnl0ZXMsXG4gICAgICAgIGlzX3Bhc3RlZF90ZXh0OiB0cnVlLCAvLyBGbGFnIHRvIGluZGljYXRlIHRoaXMgaXMgcGFzdGVkIHRleHRcbiAgICAgICAgYXBwZW5kaWNlczogYXBwZW5kaWNlc0RhdGEubGVuZ3RoID4gMCA/IGFwcGVuZGljZXNEYXRhIDogdW5kZWZpbmVkLFxuICAgICAgfSk7XG5cbiAgICAgIGlmIChyZXN1bHQuZXJyb3IpIHtcbiAgICAgICAgc2V0VXBsb2FkRXJyb3IocmVzdWx0LmVycm9yKTtcbiAgICAgIH0gZWxzZSBpZiAocmVzdWx0LmRhdGE/LnN1Ym1pc3Npb25faWQpIHtcbiAgICAgICAgLy8gU3VjY2VzcyAtIGNsZWFyIHRleHQgYW5kIHNob3cgZGlhbG9nXG4gICAgICAgIHNldFBhc3RlZFRleHQoXCJcIik7XG4gICAgICAgIHNldFBhc3RlZFRpdGxlKFwiXCIpO1xuICAgICAgICBzZXRBcHBlbmRpeEZpbGVzKFtdKTtcbiAgICAgICAgc2V0U3VjY2Vzc1N1Ym1pc3Npb25JZChyZXN1bHQuZGF0YS5zdWJtaXNzaW9uX2lkKTtcbiAgICAgICAgc2V0U3VjY2Vzc0RvY3VtZW50TmFtZShkb2N1bWVudE5hbWVXaXRoQXBwZW5kaWNlcyk7XG4gICAgICAgIHNldFNob3dTdWNjZXNzRGlhbG9nKHRydWUpO1xuICAgICAgICBhd2FpdCBsb2FkU2Vzc2lvbkRhdGEoKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHNldFVwbG9hZEVycm9yKFwiRmFpbGVkIHRvIHN1Ym1pdCB0ZXh0XCIpO1xuICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBzZXRJc1VwbG9hZGluZyhmYWxzZSk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IHJlYWRGaWxlQXNCYXNlNjQgPSAoZmlsZTogRmlsZSk6IFByb21pc2U8c3RyaW5nPiA9PiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgICByZWFkZXIub25sb2FkID0gKCkgPT4ge1xuICAgICAgICBjb25zdCByZXN1bHQgPSByZWFkZXIucmVzdWx0IGFzIHN0cmluZztcbiAgICAgICAgLy8gUmVtb3ZlIGRhdGEgVVJMIHByZWZpeCAoZS5nLiwgXCJkYXRhOnRleHQvcGxhaW47YmFzZTY0LFwiKVxuICAgICAgICBjb25zdCBiYXNlNjQgPSByZXN1bHQuc3BsaXQoXCIsXCIpWzFdO1xuICAgICAgICByZXNvbHZlKGJhc2U2NCk7XG4gICAgICB9O1xuICAgICAgcmVhZGVyLm9uZXJyb3IgPSByZWplY3Q7XG4gICAgICByZWFkZXIucmVhZEFzRGF0YVVSTChmaWxlKTtcbiAgICB9KTtcbiAgfTtcblxuICBjb25zdCBnZXRTdGF0dXNJY29uID0gKHN0YXR1czogc3RyaW5nKSA9PiB7XG4gICAgc3dpdGNoIChzdGF0dXMpIHtcbiAgICAgIGNhc2UgXCJjb21wbGV0ZWRcIjpcbiAgICAgICAgcmV0dXJuIDxDaGVja0NpcmNsZTIgY2xhc3NOYW1lPVwiaC00IHctNCB0ZXh0LWdyZWVuLTYwMFwiIC8+O1xuICAgICAgY2FzZSBcImluX3Byb2dyZXNzXCI6XG4gICAgICAgIHJldHVybiA8Q2xvY2sgY2xhc3NOYW1lPVwiaC00IHctNCB0ZXh0LXllbGxvdy02MDBcIiAvPjtcbiAgICAgIGNhc2UgXCJmYWlsZWRcIjpcbiAgICAgICAgcmV0dXJuIDxYQ2lyY2xlIGNsYXNzTmFtZT1cImgtNCB3LTQgdGV4dC1yZWQtNjAwXCIgLz47XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gPENsb2NrIGNsYXNzTmFtZT1cImgtNCB3LTQgdGV4dC1zbGF0ZS00MDBcIiAvPjtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgZ2V0U3RhdHVzQ29sb3IgPSAoc3RhdHVzOiBzdHJpbmcpID0+IHtcbiAgICBzd2l0Y2ggKHN0YXR1cykge1xuICAgICAgY2FzZSBcImNvbXBsZXRlZFwiOlxuICAgICAgICByZXR1cm4gXCJkZWZhdWx0XCI7XG4gICAgICBjYXNlIFwiaW5fcHJvZ3Jlc3NcIjpcbiAgICAgICAgcmV0dXJuIFwic2Vjb25kYXJ5XCI7XG4gICAgICBjYXNlIFwiZmFpbGVkXCI6XG4gICAgICAgIHJldHVybiBcImRlc3RydWN0aXZlXCI7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gXCJvdXRsaW5lXCI7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGhhbmRsZVN1Ym1pc3Npb25DbGljayA9IChzdWJtaXNzaW9uSWQ6IHN0cmluZykgPT4ge1xuICAgIHJvdXRlci5wdXNoKGAvc3VibWlzc2lvbi8ke3N1Ym1pc3Npb25JZH1gKTtcbiAgfTtcblxuICBpZiAoaXNMb2FkaW5nKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwibWluLWgtc2NyZWVuIGJnLWdyYWRpZW50LXRvLWIgZnJvbS1zbGF0ZS01MCB0by1zbGF0ZS0xMDAgZGFyazpmcm9tLXNsYXRlLTkwMCBkYXJrOnRvLXNsYXRlLTgwMCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlclwiPlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtY2VudGVyXCI+XG4gICAgICAgICAgPExvYWRlcjIgY2xhc3NOYW1lPVwiaC04IHctOCBhbmltYXRlLXNwaW4gbXgtYXV0byBtYi00IHRleHQtc2xhdGUtNjAwXCIgLz5cbiAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNsYXRlLTYwMCBkYXJrOnRleHQtc2xhdGUtNDAwXCI+TG9hZGluZyBzZXNzaW9uLi4uPC9wPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICk7XG4gIH1cblxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3NOYW1lPVwibWluLWgtc2NyZWVuIGJnLWdyYWRpZW50LXRvLWIgZnJvbS1zbGF0ZS01MCB0by1zbGF0ZS0xMDAgZGFyazpmcm9tLXNsYXRlLTkwMCBkYXJrOnRvLXNsYXRlLTgwMFwiPlxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJjb250YWluZXIgbXgtYXV0byBwLTYgbWF4LXctN3hsXCI+XG4gICAgICAgIHsvKiBIZWFkZXIgKi99XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibWItOFwiPlxuICAgICAgICAgIDxCdXR0b24gdmFyaWFudD1cImdob3N0XCIgb25DbGljaz17KCkgPT4gcm91dGVyLnB1c2goXCIvZGFzaGJvYXJkXCIpfSBjbGFzc05hbWU9XCJtYi00XCI+XG4gICAgICAgICAgICA8QXJyb3dMZWZ0IGNsYXNzTmFtZT1cIm1yLTIgaC00IHctNFwiIC8+XG4gICAgICAgICAgICBCYWNrIHRvIERhc2hib2FyZFxuICAgICAgICAgIDwvQnV0dG9uPlxuXG4gICAgICAgICAge3Nlc3Npb24gJiYgKFxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLXN0YXJ0IGp1c3RpZnktYmV0d2VlblwiPlxuICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgIDxoMSBjbGFzc05hbWU9XCJ0ZXh0LTR4bCBmb250LWJvbGQgdGV4dC1zbGF0ZS05MDAgZGFyazp0ZXh0LXNsYXRlLTUwIG1iLTJcIj5cbiAgICAgICAgICAgICAgICAgIHtzZXNzaW9uLm5hbWV9XG4gICAgICAgICAgICAgICAgPC9oMT5cbiAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNsYXRlLTYwMCBkYXJrOnRleHQtc2xhdGUtNDAwIG1iLTRcIj5cbiAgICAgICAgICAgICAgICAgIHtzZXNzaW9uLmRlc2NyaXB0aW9uIHx8IFwiTm8gZGVzY3JpcHRpb25cIn1cbiAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgICAgPEJhZGdlIHZhcmlhbnQ9e2dldFN0YXR1c0NvbG9yKHNlc3Npb24uc3RhdHVzKX0+e3Nlc3Npb24uc3RhdHVzfTwvQmFkZ2U+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgKX1cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAge2Vycm9yICYmIChcbiAgICAgICAgICA8QWxlcnQgdmFyaWFudD1cImRlc3RydWN0aXZlXCIgY2xhc3NOYW1lPVwibWItNlwiPlxuICAgICAgICAgICAgPEFsZXJ0RGVzY3JpcHRpb24+e2Vycm9yfTwvQWxlcnREZXNjcmlwdGlvbj5cbiAgICAgICAgICA8L0FsZXJ0PlxuICAgICAgICApfVxuXG4gICAgICAgIHsvKiBEb2N1bWVudCBDb250ZXh0IFNlY3Rpb24gKi99XG4gICAgICAgIHtzZXNzaW9uICYmIG92ZXJsYXkgJiYgKG92ZXJsYXkuZG9jdW1lbnRfcHVycG9zZSB8fCBvdmVybGF5LndoZW5fdXNlZCB8fCBvdmVybGF5LnByb2Nlc3NfY29udGV4dCB8fCBvdmVybGF5LnRhcmdldF9hdWRpZW5jZSkgJiYgKFxuICAgICAgICAgIDxDYXJkIGNsYXNzTmFtZT1cIm1iLTZcIj5cbiAgICAgICAgICAgIDxDYXJkSGVhZGVyPlxuICAgICAgICAgICAgICA8Q2FyZFRpdGxlPkRvY3VtZW50IENvbnRleHQ8L0NhcmRUaXRsZT5cbiAgICAgICAgICAgICAgPENhcmREZXNjcmlwdGlvbj5cbiAgICAgICAgICAgICAgICBVbmRlcnN0YW5kaW5nIHRoZSBldmFsdWF0aW9uIGNvbnRleHQgZm9yIFwie3Nlc3Npb24ub3ZlcmxheV9uYW1lfVwiIGRvY3VtZW50c1xuICAgICAgICAgICAgICA8L0NhcmREZXNjcmlwdGlvbj5cbiAgICAgICAgICAgIDwvQ2FyZEhlYWRlcj5cbiAgICAgICAgICAgIDxDYXJkQ29udGVudCBjbGFzc05hbWU9XCJncmlkIGdyaWQtY29scy0xIG1kOmdyaWQtY29scy0yIGdhcC00XCI+XG4gICAgICAgICAgICAgIHtvdmVybGF5LmRvY3VtZW50X3B1cnBvc2UgJiYgKFxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctc2xhdGUtNTAgZGFyazpiZy1zbGF0ZS05MDAgcC00IHJvdW5kZWQtbGdcIj5cbiAgICAgICAgICAgICAgICAgIDxoNCBjbGFzc05hbWU9XCJmb250LXNlbWlib2xkIHRleHQtc20gbWItMiBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxuICAgICAgICAgICAgICAgICAgICA8RmlsZVRleHQgY2xhc3NOYW1lPVwiaC00IHctNFwiIC8+XG4gICAgICAgICAgICAgICAgICAgIERvY3VtZW50IFB1cnBvc2VcbiAgICAgICAgICAgICAgICAgIDwvaDQ+XG4gICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNtIHRleHQtc2xhdGUtNjAwIGRhcms6dGV4dC1zbGF0ZS00MDBcIj57b3ZlcmxheS5kb2N1bWVudF9wdXJwb3NlfTwvcD5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAge292ZXJsYXkud2hlbl91c2VkICYmIChcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLXNsYXRlLTUwIGRhcms6Ymctc2xhdGUtOTAwIHAtNCByb3VuZGVkLWxnXCI+XG4gICAgICAgICAgICAgICAgICA8aDQgY2xhc3NOYW1lPVwiZm9udC1zZW1pYm9sZCB0ZXh0LXNtIG1iLTIgZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIj5cbiAgICAgICAgICAgICAgICAgICAgPENsb2NrIGNsYXNzTmFtZT1cImgtNCB3LTRcIiAvPlxuICAgICAgICAgICAgICAgICAgICBXaGVuIHRvIFVzZVxuICAgICAgICAgICAgICAgICAgPC9oND5cbiAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtc20gdGV4dC1zbGF0ZS02MDAgZGFyazp0ZXh0LXNsYXRlLTQwMFwiPntvdmVybGF5LndoZW5fdXNlZH08L3A+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgIHtvdmVybGF5LnByb2Nlc3NfY29udGV4dCAmJiAoXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1zbGF0ZS01MCBkYXJrOmJnLXNsYXRlLTkwMCBwLTQgcm91bmRlZC1sZ1wiPlxuICAgICAgICAgICAgICAgICAgPGg0IGNsYXNzTmFtZT1cImZvbnQtc2VtaWJvbGQgdGV4dC1zbSBtYi0yIGZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgICAgIDxMYXllcnMgY2xhc3NOYW1lPVwiaC00IHctNFwiIC8+XG4gICAgICAgICAgICAgICAgICAgIFByb2Nlc3MgQ29udGV4dFxuICAgICAgICAgICAgICAgICAgPC9oND5cbiAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtc20gdGV4dC1zbGF0ZS02MDAgZGFyazp0ZXh0LXNsYXRlLTQwMFwiPntvdmVybGF5LnByb2Nlc3NfY29udGV4dH08L3A+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgIHtvdmVybGF5LnRhcmdldF9hdWRpZW5jZSAmJiAoXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1zbGF0ZS01MCBkYXJrOmJnLXNsYXRlLTkwMCBwLTQgcm91bmRlZC1sZ1wiPlxuICAgICAgICAgICAgICAgICAgPGg0IGNsYXNzTmFtZT1cImZvbnQtc2VtaWJvbGQgdGV4dC1zbSBtYi0yIGZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgICAgIDxVc2VycyBjbGFzc05hbWU9XCJoLTQgdy00XCIgLz5cbiAgICAgICAgICAgICAgICAgICAgVGFyZ2V0IEF1ZGllbmNlXG4gICAgICAgICAgICAgICAgICA8L2g0PlxuICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbSB0ZXh0LXNsYXRlLTYwMCBkYXJrOnRleHQtc2xhdGUtNDAwXCI+e292ZXJsYXkudGFyZ2V0X2F1ZGllbmNlfTwvcD5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgIDwvQ2FyZENvbnRlbnQ+XG4gICAgICAgICAgPC9DYXJkPlxuICAgICAgICApfVxuXG4gICAgICAgIHsvKiBFdmFsdWF0aW9uIENyaXRlcmlhIFNlY3Rpb24gKi99XG4gICAgICAgIHtzZXNzaW9uICYmIChcbiAgICAgICAgICA8Q2FyZCBjbGFzc05hbWU9XCJtYi04XCI+XG4gICAgICAgICAgICA8Q2FyZEhlYWRlcj5cbiAgICAgICAgICAgICAgPENhcmRUaXRsZSBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxuICAgICAgICAgICAgICAgIDxGaWxlVGV4dCBjbGFzc05hbWU9XCJoLTUgdy01XCIgLz5cbiAgICAgICAgICAgICAgICBFdmFsdWF0aW9uIENyaXRlcmlhXG4gICAgICAgICAgICAgIDwvQ2FyZFRpdGxlPlxuICAgICAgICAgICAgICA8Q2FyZERlc2NyaXB0aW9uPlxuICAgICAgICAgICAgICAgIFlvdXIgZG9jdW1lbnQgd2lsbCBiZSBldmFsdWF0ZWQgYWdhaW5zdCB0aGUgXCJ7c2Vzc2lvbi5vdmVybGF5X25hbWUgfHwgJ292ZXJsYXknfVwiIGNyaXRlcmlhXG4gICAgICAgICAgICAgIDwvQ2FyZERlc2NyaXB0aW9uPlxuICAgICAgICAgICAgPC9DYXJkSGVhZGVyPlxuICAgICAgICAgICAgPENhcmRDb250ZW50PlxuICAgICAgICAgICAgICB7b3ZlcmxheSAmJiBvdmVybGF5LmNyaXRlcmlhICYmIG92ZXJsYXkuY3JpdGVyaWEubGVuZ3RoID4gMCA/IChcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktNFwiPlxuICAgICAgICAgICAgICAgICAge292ZXJsYXkuY3JpdGVyaWEubWFwKChjcml0ZXJpb246IGFueSwgaW5kZXg6IG51bWJlcikgPT4gKFxuICAgICAgICAgICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgICAgICAgICAga2V5PXtjcml0ZXJpb24uY3JpdGVyaW9uX2lkIHx8IGluZGV4fVxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJvcmRlciBib3JkZXItc2xhdGUtMjAwIGRhcms6Ym9yZGVyLXNsYXRlLTcwMCByb3VuZGVkLWxnIHAtNFwiXG4gICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtc3RhcnQganVzdGlmeS1iZXR3ZWVuIG1iLTJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleC0xXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxoNCBjbGFzc05hbWU9XCJmb250LXNlbWlib2xkIHRleHQtbGcgdGV4dC1zbGF0ZS05MDAgZGFyazp0ZXh0LXNsYXRlLTEwMFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtjcml0ZXJpb24ubmFtZX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9oND5cbiAgICAgICAgICAgICAgICAgICAgICAgICAge2NyaXRlcmlvbi5jYXRlZ29yeSAmJiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPEJhZGdlIHZhcmlhbnQ9XCJvdXRsaW5lXCIgY2xhc3NOYW1lPVwibXQtMVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2NyaXRlcmlvbi5jYXRlZ29yeX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L0JhZGdlPlxuICAgICAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtcmlnaHQgbWwtNFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtc20gZm9udC1tZWRpdW0gdGV4dC1zbGF0ZS02MDAgZGFyazp0ZXh0LXNsYXRlLTQwMFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFdlaWdodDoge2NyaXRlcmlvbi53ZWlnaHR9JVxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtc2xhdGUtNTAwIGRhcms6dGV4dC1zbGF0ZS01MDBcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXggU2NvcmU6IHtjcml0ZXJpb24ubWF4X3Njb3JlfVxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgIHtjcml0ZXJpb24uZGVzY3JpcHRpb24gJiYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbSB0ZXh0LXNsYXRlLTYwMCBkYXJrOnRleHQtc2xhdGUtNDAwIG10LTJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAge2NyaXRlcmlvbi5kZXNjcmlwdGlvbn1cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1jZW50ZXIgcHktOFwiPlxuICAgICAgICAgICAgICAgICAgPEZpbGVUZXh0IGNsYXNzTmFtZT1cImgtMTIgdy0xMiBteC1hdXRvIG1iLTQgdGV4dC1zbGF0ZS00MDBcIiAvPlxuICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbGF0ZS02MDAgZGFyazp0ZXh0LXNsYXRlLTQwMCBtYi0yXCI+XG4gICAgICAgICAgICAgICAgICAgIEV2YWx1YXRpb24gY3JpdGVyaWEgZm9yIHRoaXMgc2Vzc2lvblxuICAgICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbSB0ZXh0LXNsYXRlLTUwMCBkYXJrOnRleHQtc2xhdGUtNTAwXCI+XG4gICAgICAgICAgICAgICAgICAgIERvY3VtZW50cyB3aWxsIGJlIGFuYWx5emVkIGJ5IEFJIGFnZW50cyBhY3Jvc3MgbXVsdGlwbGUgZGltZW5zaW9ucyBpbmNsdWRpbmcgc3RydWN0dXJlLCBjb250ZW50IHF1YWxpdHksIGdyYW1tYXIsIGFuZCBjb21wbGlhbmNlXG4gICAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm10LTYgZ3JpZCBncmlkLWNvbHMtMSBtZDpncmlkLWNvbHMtMiBnYXAtNCB0ZXh0LWxlZnQgbWF4LXctMnhsIG14LWF1dG9cIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJib3JkZXIgYm9yZGVyLXNsYXRlLTIwMCBkYXJrOmJvcmRlci1zbGF0ZS03MDAgcm91bmRlZC1sZyBwLTRcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8aDUgY2xhc3NOYW1lPVwiZm9udC1zZW1pYm9sZCB0ZXh0LXNtIG1iLTJcIj5TdHJ1Y3R1cmUgVmFsaWRhdGlvbjwvaDU+XG4gICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LXNsYXRlLTYwMCBkYXJrOnRleHQtc2xhdGUtNDAwXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICBWZXJpZmllcyBkb2N1bWVudCBmb3JtYXQsIGNvbXBsZXRlbmVzcywgYW5kIGFkaGVyZW5jZSB0byB0ZW1wbGF0ZXNcbiAgICAgICAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJvcmRlciBib3JkZXItc2xhdGUtMjAwIGRhcms6Ym9yZGVyLXNsYXRlLTcwMCByb3VuZGVkLWxnIHAtNFwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxoNSBjbGFzc05hbWU9XCJmb250LXNlbWlib2xkIHRleHQtc20gbWItMlwiPkNvbnRlbnQgQW5hbHlzaXM8L2g1PlxuICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1zbGF0ZS02MDAgZGFyazp0ZXh0LXNsYXRlLTQwMFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgRXZhbHVhdGVzIGNvbnRlbnQgcXVhbGl0eSwgY2xhcml0eSwgYW5kIGNvbXBsZXRlbmVzc1xuICAgICAgICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYm9yZGVyIGJvcmRlci1zbGF0ZS0yMDAgZGFyazpib3JkZXItc2xhdGUtNzAwIHJvdW5kZWQtbGcgcC00XCI+XG4gICAgICAgICAgICAgICAgICAgICAgPGg1IGNsYXNzTmFtZT1cImZvbnQtc2VtaWJvbGQgdGV4dC1zbSBtYi0yXCI+R3JhbW1hciBDaGVjazwvaDU+XG4gICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LXNsYXRlLTYwMCBkYXJrOnRleHQtc2xhdGUtNDAwXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICBJZGVudGlmaWVzIHNwZWxsaW5nLCBncmFtbWFyLCBhbmQgd3JpdGluZyBxdWFsaXR5IGlzc3Vlc1xuICAgICAgICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYm9yZGVyIGJvcmRlci1zbGF0ZS0yMDAgZGFyazpib3JkZXItc2xhdGUtNzAwIHJvdW5kZWQtbGcgcC00XCI+XG4gICAgICAgICAgICAgICAgICAgICAgPGg1IGNsYXNzTmFtZT1cImZvbnQtc2VtaWJvbGQgdGV4dC1zbSBtYi0yXCI+Q29tcGxpYW5jZSBSZXZpZXc8L2g1PlxuICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1zbGF0ZS02MDAgZGFyazp0ZXh0LXNsYXRlLTQwMFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgQ2hlY2tzIGZvciByZWd1bGF0b3J5IGNvbXBsaWFuY2UgYW5kIHJpc2sgZmFjdG9yc1xuICAgICAgICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgIDwvQ2FyZENvbnRlbnQ+XG4gICAgICAgICAgPC9DYXJkPlxuICAgICAgICApfVxuXG4gICAgICAgIHsvKiBVcGxvYWQvUGFzdGUgU2VjdGlvbiAqL31cbiAgICAgICAgPENhcmQgY2xhc3NOYW1lPVwibWItOFwiPlxuICAgICAgICAgIDxDYXJkSGVhZGVyPlxuICAgICAgICAgICAgPENhcmRUaXRsZSBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxuICAgICAgICAgICAgICA8VXBsb2FkIGNsYXNzTmFtZT1cImgtNSB3LTVcIiAvPlxuICAgICAgICAgICAgICBTdWJtaXQgRG9jdW1lbnRcbiAgICAgICAgICAgIDwvQ2FyZFRpdGxlPlxuICAgICAgICAgICAgPENhcmREZXNjcmlwdGlvbj5VcGxvYWQgYSBmaWxlIG9yIHBhc3RlIHRleHQgZm9yIEFJIGFuYWx5c2lzIGluIHRoaXMgc2Vzc2lvbjwvQ2FyZERlc2NyaXB0aW9uPlxuICAgICAgICAgIDwvQ2FyZEhlYWRlcj5cbiAgICAgICAgICA8Q2FyZENvbnRlbnQ+XG4gICAgICAgICAgICB7dXBsb2FkRXJyb3IgJiYgKFxuICAgICAgICAgICAgICA8QWxlcnQgdmFyaWFudD1cImRlc3RydWN0aXZlXCIgY2xhc3NOYW1lPVwibWItNFwiPlxuICAgICAgICAgICAgICAgIDxBbGVydERlc2NyaXB0aW9uPnt1cGxvYWRFcnJvcn08L0FsZXJ0RGVzY3JpcHRpb24+XG4gICAgICAgICAgICAgIDwvQWxlcnQ+XG4gICAgICAgICAgICApfVxuXG4gICAgICAgICAgICA8VGFicyBkZWZhdWx0VmFsdWU9XCJ1cGxvYWRcIiBjbGFzc05hbWU9XCJ3LWZ1bGxcIj5cbiAgICAgICAgICAgICAgPFRhYnNMaXN0IGNsYXNzTmFtZT1cImdyaWQgdy1mdWxsIGdyaWQtY29scy0yXCI+XG4gICAgICAgICAgICAgICAgPFRhYnNUcmlnZ2VyIHZhbHVlPVwidXBsb2FkXCIgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIj5cbiAgICAgICAgICAgICAgICAgIDxVcGxvYWQgY2xhc3NOYW1lPVwiaC00IHctNFwiIC8+XG4gICAgICAgICAgICAgICAgICBVcGxvYWQgRmlsZVxuICAgICAgICAgICAgICAgIDwvVGFic1RyaWdnZXI+XG4gICAgICAgICAgICAgICAgPFRhYnNUcmlnZ2VyIHZhbHVlPVwicGFzdGVcIiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxuICAgICAgICAgICAgICAgICAgPFR5cGUgY2xhc3NOYW1lPVwiaC00IHctNFwiIC8+XG4gICAgICAgICAgICAgICAgICBQYXN0ZSBUZXh0XG4gICAgICAgICAgICAgICAgPC9UYWJzVHJpZ2dlcj5cbiAgICAgICAgICAgICAgPC9UYWJzTGlzdD5cblxuICAgICAgICAgICAgICA8VGFic0NvbnRlbnQgdmFsdWU9XCJ1cGxvYWRcIiBjbGFzc05hbWU9XCJzcGFjZS15LTRcIj5cbiAgICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgICAgPGxhYmVsIGNsYXNzTmFtZT1cInRleHQtc20gZm9udC1tZWRpdW0gdGV4dC1zbGF0ZS03MDAgZGFyazp0ZXh0LXNsYXRlLTMwMCBtYi0yIGJsb2NrXCI+XG4gICAgICAgICAgICAgICAgICAgIE1haW4gRG9jdW1lbnRcbiAgICAgICAgICAgICAgICAgIDwvbGFiZWw+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJvcmRlci0yIGJvcmRlci1kYXNoZWQgYm9yZGVyLXNsYXRlLTMwMCBkYXJrOmJvcmRlci1zbGF0ZS03MDAgcm91bmRlZC1sZyBwLTggdGV4dC1jZW50ZXIgaG92ZXI6Ym9yZGVyLXNsYXRlLTQwMCBkYXJrOmhvdmVyOmJvcmRlci1zbGF0ZS02MDAgdHJhbnNpdGlvbi1jb2xvcnNcIj5cbiAgICAgICAgICAgICAgICAgICAgPGlucHV0XG4gICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImZpbGVcIlxuICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXtoYW5kbGVGaWxlU2VsZWN0fVxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImhpZGRlblwiXG4gICAgICAgICAgICAgICAgICAgICAgaWQ9XCJmaWxlLXVwbG9hZFwiXG4gICAgICAgICAgICAgICAgICAgICAgYWNjZXB0PVwiLnR4dCwucGRmLC5kb2N4LC5kb2NcIlxuICAgICAgICAgICAgICAgICAgICAgIGRpc2FibGVkPXtpc1VwbG9hZGluZ31cbiAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgPGxhYmVsIGh0bWxGb3I9XCJmaWxlLXVwbG9hZFwiIGNsYXNzTmFtZT1cImN1cnNvci1wb2ludGVyXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPEZpbGVUZXh0IGNsYXNzTmFtZT1cImgtMTIgdy0xMiBteC1hdXRvIG1iLTQgdGV4dC1zbGF0ZS00MDBcIiAvPlxuICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtbGcgZm9udC1tZWRpdW0gdGV4dC1zbGF0ZS03MDAgZGFyazp0ZXh0LXNsYXRlLTMwMCBtYi0yXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICB7dXBsb2FkRmlsZSA/IHVwbG9hZEZpbGUubmFtZSA6IFwiQ2xpY2sgdG8gdXBsb2FkIG9yIGRyYWcgYW5kIGRyb3BcIn1cbiAgICAgICAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbSB0ZXh0LXNsYXRlLTUwMCBkYXJrOnRleHQtc2xhdGUtNDAwXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICBQREYsIERPQ1gsIERPQywgb3IgVFhUIChtYXggMTBNQilcbiAgICAgICAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgICAgICAgIDwvbGFiZWw+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICAgIHsvKiBBcHBlbmRpY2VzIFNlY3Rpb24gKi99XG4gICAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIG1iLTJcIj5cbiAgICAgICAgICAgICAgICAgICAgPGxhYmVsIGNsYXNzTmFtZT1cInRleHQtc20gZm9udC1tZWRpdW0gdGV4dC1zbGF0ZS03MDAgZGFyazp0ZXh0LXNsYXRlLTMwMFwiPlxuICAgICAgICAgICAgICAgICAgICAgIEFwcGVuZGljZXMgKE9wdGlvbmFsKVxuICAgICAgICAgICAgICAgICAgICA8L2xhYmVsPlxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtc2xhdGUtNTAwIGRhcms6dGV4dC1zbGF0ZS00MDBcIj5cbiAgICAgICAgICAgICAgICAgICAgICBQREYgb25seSwgbWF4IDVNQiBlYWNoXG4gICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgICAgICB7YXBwZW5kaXhFcnJvciAmJiAoXG4gICAgICAgICAgICAgICAgICAgIDxBbGVydCB2YXJpYW50PVwiZGVzdHJ1Y3RpdmVcIiBjbGFzc05hbWU9XCJtYi0zXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPEFsZXJ0RGVzY3JpcHRpb24+e2FwcGVuZGl4RXJyb3J9PC9BbGVydERlc2NyaXB0aW9uPlxuICAgICAgICAgICAgICAgICAgICA8L0FsZXJ0PlxuICAgICAgICAgICAgICAgICAgKX1cblxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJib3JkZXItMiBib3JkZXItZGFzaGVkIGJvcmRlci1zbGF0ZS0zMDAgZGFyazpib3JkZXItc2xhdGUtNzAwIHJvdW5kZWQtbGcgcC02IHRleHQtY2VudGVyIGhvdmVyOmJvcmRlci1zbGF0ZS00MDAgZGFyazpob3Zlcjpib3JkZXItc2xhdGUtNjAwIHRyYW5zaXRpb24tY29sb3JzXCI+XG4gICAgICAgICAgICAgICAgICAgIDxpbnB1dFxuICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJmaWxlXCJcbiAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17aGFuZGxlQXBwZW5kaXhTZWxlY3R9XG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiaGlkZGVuXCJcbiAgICAgICAgICAgICAgICAgICAgICBpZD1cImFwcGVuZGl4LXVwbG9hZFwiXG4gICAgICAgICAgICAgICAgICAgICAgYWNjZXB0PVwiLnBkZlwiXG4gICAgICAgICAgICAgICAgICAgICAgbXVsdGlwbGVcbiAgICAgICAgICAgICAgICAgICAgICBkaXNhYmxlZD17aXNVcGxvYWRpbmd9XG4gICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgIDxsYWJlbCBodG1sRm9yPVwiYXBwZW5kaXgtdXBsb2FkXCIgY2xhc3NOYW1lPVwiY3Vyc29yLXBvaW50ZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgICA8UGFwZXJjbGlwIGNsYXNzTmFtZT1cImgtMTAgdy0xMCBteC1hdXRvIG1iLTMgdGV4dC1zbGF0ZS00MDBcIiAvPlxuICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtc20gZm9udC1tZWRpdW0gdGV4dC1zbGF0ZS03MDAgZGFyazp0ZXh0LXNsYXRlLTMwMCBtYi0xXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICBBZGQgUERGIGFwcGVuZGljZXNcbiAgICAgICAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LXNsYXRlLTUwMCBkYXJrOnRleHQtc2xhdGUtNDAwXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICBlLmcuLCBHYW50dCBjaGFydHMsIGJ1ZGdldHMsIHN1cHBvcnRpbmcgZG9jdW1lbnRzXG4gICAgICAgICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICAgICAgICA8L2xhYmVsPlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgICAgIHsvKiBEaXNwbGF5IHNlbGVjdGVkIGFwcGVuZGljZXMgKi99XG4gICAgICAgICAgICAgICAgICB7YXBwZW5kaXhGaWxlcy5sZW5ndGggPiAwICYmIChcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtdC0zIHNwYWNlLXktMlwiPlxuICAgICAgICAgICAgICAgICAgICAgIHthcHBlbmRpeEZpbGVzLm1hcCgoZmlsZSwgaW5kZXgpID0+IChcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICAgICAgICAgICAga2V5PXtpbmRleH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIGJnLXNsYXRlLTUwIGRhcms6Ymctc2xhdGUtOTAwIHAtMyByb3VuZGVkLWxnXCJcbiAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiBmbGV4LTFcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8UGFwZXJjbGlwIGNsYXNzTmFtZT1cImgtNCB3LTQgdGV4dC1zbGF0ZS01MDBcIiAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtc20gZm9udC1tZWRpdW0gdGV4dC1zbGF0ZS03MDAgZGFyazp0ZXh0LXNsYXRlLTMwMFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2ZpbGUubmFtZX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LXNsYXRlLTUwMFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKHsoZmlsZS5zaXplIC8gMTAyNCkudG9GaXhlZCgwKX0gS0IpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbnQ9XCJnaG9zdFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZT1cInNtXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiByZW1vdmVBcHBlbmRpeChpbmRleCl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9e2lzVXBsb2FkaW5nfVxuICAgICAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPFggY2xhc3NOYW1lPVwiaC00IHctNFwiIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICAgIHt1cGxvYWRGaWxlICYmIChcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTRcIj5cbiAgICAgICAgICAgICAgICAgICAgPEJ1dHRvbiBvbkNsaWNrPXtoYW5kbGVVcGxvYWR9IGRpc2FibGVkPXtpc1VwbG9hZGluZ30gY2xhc3NOYW1lPVwiZmxleC0xXCI+XG4gICAgICAgICAgICAgICAgICAgICAge2lzVXBsb2FkaW5nID8gKFxuICAgICAgICAgICAgICAgICAgICAgICAgPD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPExvYWRlcjIgY2xhc3NOYW1lPVwibXItMiBoLTQgdy00IGFuaW1hdGUtc3BpblwiIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIFVwbG9hZGluZy4uLlxuICAgICAgICAgICAgICAgICAgICAgICAgPC8+XG4gICAgICAgICAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICAgICAgICAgIDw+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxVcGxvYWQgY2xhc3NOYW1lPVwibXItMiBoLTQgdy00XCIgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgVXBsb2FkIERvY3VtZW50e2FwcGVuZGl4RmlsZXMubGVuZ3RoID4gMCA/IGAgKCske2FwcGVuZGl4RmlsZXMubGVuZ3RofSBhcHBlbmRpeCR7YXBwZW5kaXhGaWxlcy5sZW5ndGggPiAxID8gJ2VzJyA6ICcnfSlgIDogJyd9XG4gICAgICAgICAgICAgICAgICAgICAgICA8Lz5cbiAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbnQ9XCJvdXRsaW5lXCJcbiAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRVcGxvYWRGaWxlKG51bGwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2V0QXBwZW5kaXhGaWxlcyhbXSk7XG4gICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICBkaXNhYmxlZD17aXNVcGxvYWRpbmd9XG4gICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICBDYW5jZWxcbiAgICAgICAgICAgICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICA8L1RhYnNDb250ZW50PlxuXG4gICAgICAgICAgICAgIDxUYWJzQ29udGVudCB2YWx1ZT1cInBhc3RlXCIgY2xhc3NOYW1lPVwic3BhY2UteS00XCI+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTRcIj5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS0yXCI+XG4gICAgICAgICAgICAgICAgICAgIDxsYWJlbCBodG1sRm9yPVwicGFzdGUtdGl0bGVcIiBjbGFzc05hbWU9XCJ0ZXh0LXNtIGZvbnQtbWVkaXVtIHRleHQtc2xhdGUtNzAwIGRhcms6dGV4dC1zbGF0ZS0zMDBcIj5cbiAgICAgICAgICAgICAgICAgICAgICBEb2N1bWVudCBUaXRsZSAoT3B0aW9uYWwpXG4gICAgICAgICAgICAgICAgICAgIDwvbGFiZWw+XG4gICAgICAgICAgICAgICAgICAgIDxJbnB1dFxuICAgICAgICAgICAgICAgICAgICAgIGlkPVwicGFzdGUtdGl0bGVcIlxuICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiZS5nLiwgQ29udHJhY3QgUmV2aWV3IERyYWZ0LCBNZWV0aW5nIE5vdGVzLi4uXCJcbiAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17cGFzdGVkVGl0bGV9XG4gICAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiBzZXRQYXN0ZWRUaXRsZShlLnRhcmdldC52YWx1ZSl9XG4gICAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9e2lzVXBsb2FkaW5nfVxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInctZnVsbFwiXG4gICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1zbGF0ZS01MDAgZGFyazp0ZXh0LXNsYXRlLTQwMFwiPlxuICAgICAgICAgICAgICAgICAgICAgIElmIG5vdCBwcm92aWRlZCwgd2lsbCBkZWZhdWx0IHRvIFwiUGFzdGVkIENvbnRlbnQgLSB7bmV3IERhdGUoKS50b0xvY2FsZURhdGVTdHJpbmcoKX1cIlxuICAgICAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS0yXCI+XG4gICAgICAgICAgICAgICAgICAgIDxsYWJlbCBodG1sRm9yPVwicGFzdGUtdGV4dFwiIGNsYXNzTmFtZT1cInRleHQtc20gZm9udC1tZWRpdW0gdGV4dC1zbGF0ZS03MDAgZGFyazp0ZXh0LXNsYXRlLTMwMFwiPlxuICAgICAgICAgICAgICAgICAgICAgIERvY3VtZW50IENvbnRlbnRcbiAgICAgICAgICAgICAgICAgICAgPC9sYWJlbD5cbiAgICAgICAgICAgICAgICAgICAgPFRleHRhcmVhXG4gICAgICAgICAgICAgICAgICAgICAgaWQ9XCJwYXN0ZS10ZXh0XCJcbiAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj1cIlBhc3RlIHlvdXIgZG9jdW1lbnQgdGV4dCBoZXJlLi4uXCJcbiAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17cGFzdGVkVGV4dH1cbiAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHNldFBhc3RlZFRleHQoZS50YXJnZXQudmFsdWUpfVxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cIm1pbi1oLVszMDBweF0gZm9udC1tb25vIHRleHQtc21cIlxuICAgICAgICAgICAgICAgICAgICAgIGRpc2FibGVkPXtpc1VwbG9hZGluZ31cbiAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gdGV4dC1zbSB0ZXh0LXNsYXRlLTUwMCBkYXJrOnRleHQtc2xhdGUtNDAwXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICB7cGFzdGVkVGV4dC5sZW5ndGgudG9Mb2NhbGVTdHJpbmcoKX0gY2hhcmFjdGVyc1xuICAgICAgICAgICAgICAgICAgICAgICAge3Bhc3RlZFRleHQubGVuZ3RoID4gMCAmJiBgICgkeyhuZXcgQmxvYihbcGFzdGVkVGV4dF0pLnNpemUgLyAxMDI0KS50b0ZpeGVkKDIpfSBLQilgfVxuICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXhzXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICBNYXhpbXVtIHNpemU6IDEwTUJcbiAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgICAgIHsvKiBBcHBlbmRpY2VzIFNlY3Rpb24gKi99XG4gICAgICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBtYi0yXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPGxhYmVsIGNsYXNzTmFtZT1cInRleHQtc20gZm9udC1tZWRpdW0gdGV4dC1zbGF0ZS03MDAgZGFyazp0ZXh0LXNsYXRlLTMwMFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgQXBwZW5kaWNlcyAoT3B0aW9uYWwpXG4gICAgICAgICAgICAgICAgICAgICAgPC9sYWJlbD5cbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtc2xhdGUtNTAwIGRhcms6dGV4dC1zbGF0ZS00MDBcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIFBERiBvbmx5LCBtYXggNU1CIGVhY2hcbiAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgICAgICAgIHthcHBlbmRpeEVycm9yICYmIChcbiAgICAgICAgICAgICAgICAgICAgICA8QWxlcnQgdmFyaWFudD1cImRlc3RydWN0aXZlXCIgY2xhc3NOYW1lPVwibWItM1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPEFsZXJ0RGVzY3JpcHRpb24+e2FwcGVuZGl4RXJyb3J9PC9BbGVydERlc2NyaXB0aW9uPlxuICAgICAgICAgICAgICAgICAgICAgIDwvQWxlcnQ+XG4gICAgICAgICAgICAgICAgICAgICl9XG5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJib3JkZXItMiBib3JkZXItZGFzaGVkIGJvcmRlci1zbGF0ZS0zMDAgZGFyazpib3JkZXItc2xhdGUtNzAwIHJvdW5kZWQtbGcgcC02IHRleHQtY2VudGVyIGhvdmVyOmJvcmRlci1zbGF0ZS00MDAgZGFyazpob3Zlcjpib3JkZXItc2xhdGUtNjAwIHRyYW5zaXRpb24tY29sb3JzXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPGlucHV0XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwiZmlsZVwiXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17aGFuZGxlQXBwZW5kaXhTZWxlY3R9XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJoaWRkZW5cIlxuICAgICAgICAgICAgICAgICAgICAgICAgaWQ9XCJwYXN0ZS1hcHBlbmRpeC11cGxvYWRcIlxuICAgICAgICAgICAgICAgICAgICAgICAgYWNjZXB0PVwiLnBkZlwiXG4gICAgICAgICAgICAgICAgICAgICAgICBtdWx0aXBsZVxuICAgICAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9e2lzVXBsb2FkaW5nfVxuICAgICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgICAgPGxhYmVsIGh0bWxGb3I9XCJwYXN0ZS1hcHBlbmRpeC11cGxvYWRcIiBjbGFzc05hbWU9XCJjdXJzb3ItcG9pbnRlclwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPFBhcGVyY2xpcCBjbGFzc05hbWU9XCJoLTEwIHctMTAgbXgtYXV0byBtYi0zIHRleHQtc2xhdGUtNDAwXCIgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtc20gZm9udC1tZWRpdW0gdGV4dC1zbGF0ZS03MDAgZGFyazp0ZXh0LXNsYXRlLTMwMCBtYi0xXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIEFkZCBQREYgYXBwZW5kaWNlc1xuICAgICAgICAgICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LXNsYXRlLTUwMCBkYXJrOnRleHQtc2xhdGUtNDAwXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGUuZy4sIEdhbnR0IGNoYXJ0cywgYnVkZ2V0cywgc3VwcG9ydGluZyBkb2N1bWVudHNcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgICAgICAgICA8L2xhYmVsPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICAgICAgICB7LyogRGlzcGxheSBzZWxlY3RlZCBhcHBlbmRpY2VzICovfVxuICAgICAgICAgICAgICAgICAgICB7YXBwZW5kaXhGaWxlcy5sZW5ndGggPiAwICYmIChcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm10LTMgc3BhY2UteS0yXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICB7YXBwZW5kaXhGaWxlcy5tYXAoKGZpbGUsIGluZGV4KSA9PiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk9e2luZGV4fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBiZy1zbGF0ZS01MCBkYXJrOmJnLXNsYXRlLTkwMCBwLTMgcm91bmRlZC1sZ1wiXG4gICAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yIGZsZXgtMVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPFBhcGVyY2xpcCBjbGFzc05hbWU9XCJoLTQgdy00IHRleHQtc2xhdGUtNTAwXCIgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtc20gZm9udC1tZWRpdW0gdGV4dC1zbGF0ZS03MDAgZGFyazp0ZXh0LXNsYXRlLTMwMFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7ZmlsZS5uYW1lfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LXNsYXRlLTUwMFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoeyhmaWxlLnNpemUgLyAxMDI0KS50b0ZpeGVkKDApfSBLQilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXJpYW50PVwiZ2hvc3RcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZT1cInNtXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHJlbW92ZUFwcGVuZGl4KGluZGV4KX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpc2FibGVkPXtpc1VwbG9hZGluZ31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8WCBjbGFzc05hbWU9XCJoLTQgdy00XCIgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgICAge3Bhc3RlZFRleHQudHJpbSgpLmxlbmd0aCA+IDAgJiYgKFxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtNFwiPlxuICAgICAgICAgICAgICAgICAgICA8QnV0dG9uIG9uQ2xpY2s9e2hhbmRsZVBhc3RlU3VibWl0fSBkaXNhYmxlZD17aXNVcGxvYWRpbmd9IGNsYXNzTmFtZT1cImZsZXgtMVwiPlxuICAgICAgICAgICAgICAgICAgICAgIHtpc1VwbG9hZGluZyA/IChcbiAgICAgICAgICAgICAgICAgICAgICAgIDw+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxMb2FkZXIyIGNsYXNzTmFtZT1cIm1yLTIgaC00IHctNCBhbmltYXRlLXNwaW5cIiAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICBTdWJtaXR0aW5nLi4uXG4gICAgICAgICAgICAgICAgICAgICAgICA8Lz5cbiAgICAgICAgICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgICAgICAgICAgPD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPFVwbG9hZCBjbGFzc05hbWU9XCJtci0yIGgtNCB3LTRcIiAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICBTdWJtaXQgVGV4dHthcHBlbmRpeEZpbGVzLmxlbmd0aCA+IDAgPyBgICgrJHthcHBlbmRpeEZpbGVzLmxlbmd0aH0gYXBwZW5kaXgke2FwcGVuZGl4RmlsZXMubGVuZ3RoID4gMSA/ICdlcycgOiAnJ30pYCA6ICcnfVxuICAgICAgICAgICAgICAgICAgICAgICAgPC8+XG4gICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgICAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgICAgICAgICB2YXJpYW50PVwib3V0bGluZVwiXG4gICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2V0UGFzdGVkVGV4dChcIlwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldFBhc3RlZFRpdGxlKFwiXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2V0QXBwZW5kaXhGaWxlcyhbXSk7XG4gICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICBkaXNhYmxlZD17aXNVcGxvYWRpbmd9XG4gICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICBDbGVhclxuICAgICAgICAgICAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgIDwvVGFic0NvbnRlbnQ+XG4gICAgICAgICAgICA8L1RhYnM+XG4gICAgICAgICAgPC9DYXJkQ29udGVudD5cbiAgICAgICAgPC9DYXJkPlxuXG4gICAgICAgIHsvKiBTdWNjZXNzIERpYWxvZyAqL31cbiAgICAgICAgPERpYWxvZyBvcGVuPXtzaG93U3VjY2Vzc0RpYWxvZ30gb25PcGVuQ2hhbmdlPXtzZXRTaG93U3VjY2Vzc0RpYWxvZ30+XG4gICAgICAgICAgPERpYWxvZ0NvbnRlbnQgY2xhc3NOYW1lPVwic206bWF4LXctbWRcIj5cbiAgICAgICAgICAgIDxEaWFsb2dIZWFkZXI+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTMgbWItMlwiPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBoLTEwIHctMTAgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQtZnVsbCBiZy1ncmVlbi0xMDAgZGFyazpiZy1ncmVlbi05MDBcIj5cbiAgICAgICAgICAgICAgICAgIDxDaGVja0NpcmNsZSBjbGFzc05hbWU9XCJoLTYgdy02IHRleHQtZ3JlZW4tNjAwIGRhcms6dGV4dC1ncmVlbi00MDBcIiAvPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxEaWFsb2dUaXRsZSBjbGFzc05hbWU9XCJ0ZXh0LXhsXCI+RG9jdW1lbnQgU3VibWl0dGVkIFN1Y2Nlc3NmdWxseSE8L0RpYWxvZ1RpdGxlPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPERpYWxvZ0Rlc2NyaXB0aW9uIGNsYXNzTmFtZT1cInRleHQtYmFzZSBwdC0yXCI+XG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiZm9udC1tZWRpdW0gdGV4dC1zbGF0ZS05MDAgZGFyazp0ZXh0LXNsYXRlLTEwMFwiPlxuICAgICAgICAgICAgICAgICAgXCJ7c3VjY2Vzc0RvY3VtZW50TmFtZX1cIlxuICAgICAgICAgICAgICAgIDwvc3Bhbj57XCIgXCJ9XG4gICAgICAgICAgICAgICAgaGFzIGJlZW4gdXBsb2FkZWQgYW5kIHN1Ym1pdHRlZCBmb3IgYW5hbHlzaXMuXG4gICAgICAgICAgICAgIDwvRGlhbG9nRGVzY3JpcHRpb24+XG4gICAgICAgICAgICA8L0RpYWxvZ0hlYWRlcj5cblxuICAgICAgICAgICAgey8qIEFuYWx5c2lzIGluIFByb2dyZXNzIEluZGljYXRvciAqL31cbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYmctYmx1ZS01MCBkYXJrOmJnLWJsdWUtOTAwLzIwIGJvcmRlciBib3JkZXItYmx1ZS0yMDAgZGFyazpib3JkZXItYmx1ZS04MDAgcm91bmRlZC1sZyBwLTQgbXQtNFwiPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtc3RhcnQgZ2FwLTNcIj5cbiAgICAgICAgICAgICAgICA8TG9hZGVyMiBjbGFzc05hbWU9XCJoLTUgdy01IHRleHQtYmx1ZS02MDAgZGFyazp0ZXh0LWJsdWUtNDAwIGFuaW1hdGUtc3BpbiBtdC0wLjUgZmxleC1zaHJpbmstMFwiIC8+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4LTFcIj5cbiAgICAgICAgICAgICAgICAgIDxoNCBjbGFzc05hbWU9XCJ0ZXh0LXNtIGZvbnQtc2VtaWJvbGQgdGV4dC1ibHVlLTkwMCBkYXJrOnRleHQtYmx1ZS0xMDAgbWItMVwiPlxuICAgICAgICAgICAgICAgICAgICBBSSBBbmFseXNpcyBJbiBQcm9ncmVzc1xuICAgICAgICAgICAgICAgICAgPC9oND5cbiAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtc20gdGV4dC1ibHVlLTcwMCBkYXJrOnRleHQtYmx1ZS0zMDBcIj5cbiAgICAgICAgICAgICAgICAgICAgT3VyIDYgQUkgYWdlbnRzIGFyZSBhbmFseXppbmcgeW91ciBkb2N1bWVudC4gVGhpcyB0eXBpY2FsbHkgdGFrZXMgPHN0cm9uZz4xLTIgbWludXRlczwvc3Ryb25nPi5cbiAgICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1ibHVlLTYwMCBkYXJrOnRleHQtYmx1ZS00MDAgbXQtMlwiPlxuICAgICAgICAgICAgICAgICAgICBZb3UgY2FuIHZpZXcgcmVhbC10aW1lIHByb2dyZXNzIG9uIHRoZSBhbmFseXNpcyBwYWdlLlxuICAgICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0zIG10LTQgcHQtNCBib3JkZXItdFwiPlxuICAgICAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICAgICAgdmFyaWFudD1cIm91dGxpbmVcIlxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFNob3dTdWNjZXNzRGlhbG9nKGZhbHNlKX1cbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJmbGV4LTFcIlxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgU3RheSBIZXJlXG4gICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4ge1xuICAgICAgICAgICAgICAgICAgc2V0U2hvd1N1Y2Nlc3NEaWFsb2coZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgaWYgKHN1Y2Nlc3NTdWJtaXNzaW9uSWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcm91dGVyLnB1c2goYC9zdWJtaXNzaW9uLyR7c3VjY2Vzc1N1Ym1pc3Npb25JZH1gKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImZsZXgtMVwiXG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICA8RmlsZVRleHQgY2xhc3NOYW1lPVwibXItMiBoLTQgdy00XCIgLz5cbiAgICAgICAgICAgICAgICBWaWV3IFByb2dyZXNzXG4gICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9EaWFsb2dDb250ZW50PlxuICAgICAgICA8L0RpYWxvZz5cblxuICAgICAgICB7LyogU3VibWlzc2lvbnMgTGlzdCAqL31cbiAgICAgICAgPENhcmQ+XG4gICAgICAgICAgPENhcmRIZWFkZXI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlblwiPlxuICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgIDxDYXJkVGl0bGUgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIj5cbiAgICAgICAgICAgICAgICAgIDxGaWxlVGV4dCBjbGFzc05hbWU9XCJoLTUgdy01XCIgLz5cbiAgICAgICAgICAgICAgICAgIEFuYWx5c2VzICh7c3VibWlzc2lvbnMubGVuZ3RofSlcbiAgICAgICAgICAgICAgICA8L0NhcmRUaXRsZT5cbiAgICAgICAgICAgICAgICA8Q2FyZERlc2NyaXB0aW9uPkRvY3VtZW50cyBzdWJtaXR0ZWQgdG8gdGhpcyBhbmFseXNpcyBzZXNzaW9uPC9DYXJkRGVzY3JpcHRpb24+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8QnV0dG9uIG9uQ2xpY2s9e2xvYWRTZXNzaW9uRGF0YX0gdmFyaWFudD1cIm91dGxpbmVcIiBzaXplPVwic21cIj5cbiAgICAgICAgICAgICAgICBSZWZyZXNoXG4gICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9DYXJkSGVhZGVyPlxuICAgICAgICAgIDxDYXJkQ29udGVudD5cbiAgICAgICAgICAgIHtzdWJtaXNzaW9ucy5sZW5ndGggPT09IDAgPyAoXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1jZW50ZXIgcHktOFwiPlxuICAgICAgICAgICAgICAgIDxGaWxlVGV4dCBjbGFzc05hbWU9XCJoLTEyIHctMTIgbXgtYXV0byBtYi00IHRleHQtc2xhdGUtNDAwXCIgLz5cbiAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNsYXRlLTYwMCBkYXJrOnRleHQtc2xhdGUtNDAwIG1iLTJcIj5ObyBhbmFseXNlcyB5ZXQ8L3A+XG4gICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbSB0ZXh0LXNsYXRlLTUwMCBkYXJrOnRleHQtc2xhdGUtNTAwXCI+XG4gICAgICAgICAgICAgICAgICBVcGxvYWQgYSBkb2N1bWVudCB0byBnZXQgc3RhcnRlZFxuICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktNFwiPlxuICAgICAgICAgICAgICAgIHtzdWJtaXNzaW9ucy5tYXAoKHN1Ym1pc3Npb24pID0+IChcbiAgICAgICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICAgICAga2V5PXtzdWJtaXNzaW9uLnN1Ym1pc3Npb25faWR9XG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJvcmRlciBib3JkZXItc2xhdGUtMjAwIGRhcms6Ym9yZGVyLXNsYXRlLTcwMCByb3VuZGVkLWxnIHAtNCBob3Zlcjpib3JkZXItYmx1ZS01MDAgdHJhbnNpdGlvbi1jb2xvcnMgY3Vyc29yLXBvaW50ZXJcIlxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBoYW5kbGVTdWJtaXNzaW9uQ2xpY2soc3VibWlzc2lvbi5zdWJtaXNzaW9uX2lkKX1cbiAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLXN0YXJ0IGp1c3RpZnktYmV0d2VlblwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleC0xXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yIG1iLTJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGg0IGNsYXNzTmFtZT1cImZvbnQtc2VtaWJvbGQgdGV4dC1sZ1wiPntzdWJtaXNzaW9uLmRvY3VtZW50X25hbWV9PC9oND5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPEJhZGdlIHZhcmlhbnQ9e2dldFN0YXR1c0NvbG9yKHN1Ym1pc3Npb24uYWlfYW5hbHlzaXNfc3RhdHVzKX0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge3N1Ym1pc3Npb24uYWlfYW5hbHlzaXNfc3RhdHVzfVxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L0JhZGdlPlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNtIHRleHQtc2xhdGUtNjAwIGRhcms6dGV4dC1zbGF0ZS00MDAgbWItMlwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICBTdWJtaXR0ZWQgYnkge3N1Ym1pc3Npb24uc3VibWl0dGVkX2J5X25hbWV9IG9ue1wiIFwifVxuICAgICAgICAgICAgICAgICAgICAgICAgICB7bmV3IERhdGUoc3VibWlzc2lvbi5zdWJtaXR0ZWRfYXQpLnRvTG9jYWxlU3RyaW5nKCl9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC00IHRleHQtc21cIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtnZXRTdGF0dXNJY29uKHN1Ym1pc3Npb24uYWlfYW5hbHlzaXNfc3RhdHVzKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXNsYXRlLTYwMCBkYXJrOnRleHQtc2xhdGUtNDAwXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBTdGF0dXM6IHtzdWJtaXNzaW9uLnN0YXR1c31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICB7c3VibWlzc2lvbi5vdmVyYWxsX3Njb3JlICE9PSBudWxsICYmIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJmb250LXNlbWlib2xkIHRleHQtc2xhdGUtOTAwIGRhcms6dGV4dC1zbGF0ZS0xMDBcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgU2NvcmU6IHtzdWJtaXNzaW9uLm92ZXJhbGxfc2NvcmV9LzEwMFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgKX1cbiAgICAgICAgICA8L0NhcmRDb250ZW50PlxuICAgICAgICA8L0NhcmQ+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn1cbiJdfQ==
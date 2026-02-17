"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, FileText, Plus, Edit, ArrowLeft, Trash2, Upload } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { getCurrentUser } from "@/lib/auth";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ImportOverlayDialog } from "@/components/overlays/ImportOverlayDialog";

interface Overlay {
  overlay_id: string;
  name: string;
  description: string;
  document_type: string;
  created_at: string;
  criteria_count?: string;
  is_active: boolean;
}

export default function OverlaysPage() {
  const router = useRouter();
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [overlayToDelete, setOverlayToDelete] = useState<{ id: string; name: string } | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);

  useEffect(() => {
    // Check authentication
    const currentUser = getCurrentUser();
    if (!currentUser) {
      router.push("/login");
      return;
    }
    setUser(currentUser);

    // Load overlays
    loadOverlays();
  }, [router]);

  const loadOverlays = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await apiClient.getOverlays();

      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setOverlays(result.data.overlays || []);
      }
    } catch (err) {
      setError("Failed to load overlays");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOverlayClick = (overlayId: string) => {
    router.push(`/overlays/${overlayId}`);
  };

  const handleCreateNew = () => {
    router.push("/overlays/new");
  };

  const handleDeleteOverlay = (overlayId: string, overlayName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOverlayToDelete({ id: overlayId, name: overlayName });
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!overlayToDelete) return;

    setShowDeleteDialog(false);
    setIsDeleting(overlayToDelete.id);
    setError(null);

    try {
      const result = await apiClient.deleteOverlay(overlayToDelete.id);

      if (result.error) {
        setError(result.error);
      } else {
        // Remove from list
        setOverlays(overlays.filter(o => o.overlay_id !== overlayToDelete.id));
      }
    } catch (err) {
      setError("Failed to delete overlay. It may be in use by active sessions.");
      console.error(err);
    } finally {
      setIsDeleting(null);
      setOverlayToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-slate-600" />
          <p className="text-slate-600 dark:text-slate-400">Loading intelligence templates...</p>
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

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-50 mb-2">
                Intelligence Setup
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Manage document evaluation intelligence templates and criteria
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Import from DOCX
              </Button>
              <Button onClick={handleCreateNew}>
                <Plus className="mr-2 h-4 w-4" />
                Create Intelligence Template
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Overlays Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {overlays.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <FileText className="h-16 w-16 mx-auto mb-4 text-slate-400" />
              <p className="text-slate-600 dark:text-slate-400 mb-2">No intelligence templates yet</p>
              <p className="text-sm text-slate-500 dark:text-slate-500 mb-4">
                Create your first intelligence template to get started
              </p>
              <Button onClick={handleCreateNew}>
                <Plus className="mr-2 h-4 w-4" />
                Create Intelligence Template
              </Button>
            </div>
          ) : (
            overlays.map((overlay) => (
              <Card
                key={overlay.overlay_id}
                className="cursor-pointer hover:border-blue-500 transition-colors"
                onClick={() => handleOverlayClick(overlay.overlay_id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2">{overlay.name}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {overlay.description || "No description"}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={overlay.is_active ? "default" : "secondary"}>
                        {overlay.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDeleteOverlay(overlay.overlay_id, overlay.name, e)}
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
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Document Type:</span>
                      <Badge variant="outline">{overlay.document_type || "Any"}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Criteria:</span>
                      <span className="font-semibold">{overlay.criteria_count || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Created:</span>
                      <span className="text-slate-600 dark:text-slate-400">
                        {new Date(overlay.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-4"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOverlayClick(overlay.overlay_id);
                    }}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Criteria
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title={`Delete "${overlayToDelete?.name}"?`}
          description="This will permanently delete the overlay template and all its evaluation criteria. This action cannot be undone."
          confirmText="Delete Overlay"
          cancelText="Cancel"
          onConfirm={handleDeleteConfirm}
          variant="destructive"
          isLoading={false}
        />

        {/* Import Overlay Dialog */}
        <ImportOverlayDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          onSuccess={loadOverlays}
        />
      </div>
    </div>
  );
}

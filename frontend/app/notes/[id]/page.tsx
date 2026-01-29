"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Download, Edit, Trash2, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { EditNoteDialog } from "@/components/notes/EditNoteDialog";
import { exportNoteToWord } from "@/lib/docx-export";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface Note {
  note_id: string;
  title: string;
  content: string;
  ai_summary?: string;
  created_at: string;
  updated_at: string;
  session_id?: string;
}

export default function NoteDetailPage() {
  const router = useRouter();
  const params = useParams();
  const noteId = params.id as string;

  const [note, setNote] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (noteId) {
      loadNote();
    }
  }, [noteId]);

  const loadNote = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.getNote(noteId);

      if (response.error) {
        setError(response.error);
      } else if (response.data) {
        setNote(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load note");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    if (!note) return;

    try {
      await exportNoteToWord(note.title, note.content, note.ai_summary);
      toast.success("Note exported to Word successfully!");
    } catch (err) {
      toast.error("Failed to export note", {
        description: err instanceof Error ? err.message : "An error occurred",
      });
    }
  };

  const handleUpdate = async (title: string, content: string) => {
    try {
      const response = await apiClient.updateNote(noteId, { title, content });

      if (response.error) {
        toast.error("Failed to update note", {
          description: response.error,
        });
        throw new Error(response.error);
      }

      toast.success("Note updated successfully!");
      await loadNote(); // Reload to get updated data
    } catch (err) {
      throw err;
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!note) return;

    setIsDeleting(true);
    setShowDeleteDialog(false);

    try {
      const response = await apiClient.deleteNote(noteId);

      if (response.error) {
        toast.error("Failed to delete note", {
          description: response.error,
        });
        setIsDeleting(false);
        return;
      }

      // Success - show toast and redirect to dashboard
      toast.success("Note deleted successfully!");

      // Redirect to dashboard (SavedNotesPanel will auto-refresh due to pathname change)
      router.push("/dashboard");
    } catch (err) {
      toast.error("Failed to delete note", {
        description: err instanceof Error ? err.message : "An error occurred",
      });
      setIsDeleting(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading note...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !note) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-center mb-2">Failed to Load Note</h2>
          <p className="text-sm text-slate-500 text-center mb-6">
            {error || "Note not found"}
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => router.push("/dashboard")} variant="outline">
              Back to Dashboard
            </Button>
            <Button onClick={loadNote}>Try Again</Button>
          </div>
        </Card>
      </div>
    );
  }

  // Note display
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          onClick={() => router.back()}
          variant="ghost"
          size="sm"
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              {note.title}
            </h1>
            <div className="flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
              <span>
                Created: {format(new Date(note.created_at), "PPp")}
              </span>
              {note.created_at !== note.updated_at && (
                <span>
                  Updated: {format(new Date(note.updated_at), "PPp")}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleExport} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export to Word
            </Button>
            <Button
              onClick={() => setShowEditDialog(true)}
              variant="outline"
              size="sm"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              onClick={handleDeleteClick}
              variant="outline"
              size="sm"
              disabled={isDeleting}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* AI Summary (if exists) */}
      {note.ai_summary && (
        <Card className="p-6 mb-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
            AI Summary
          </h2>
          <div className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
            {note.ai_summary}
          </div>
        </Card>
      )}

      {/* Content */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
          {note.ai_summary ? "Detailed Notes" : "Content"}
        </h2>
        <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
          {note.content}
        </div>
      </Card>

      {/* Edit Dialog */}
      <EditNoteDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        note={note}
        onSave={handleUpdate}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={`Delete "${note.title}"?`}
        description="This will permanently remove the note from the database. This action cannot be undone."
        confirmText="Delete Note"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        variant="destructive"
        isLoading={isDeleting}
      />
    </div>
  );
}

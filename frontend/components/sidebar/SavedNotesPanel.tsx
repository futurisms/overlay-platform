"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Bookmark, Loader2, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface SavedNote {
  note_id: string;
  title: string;
  content_preview: string;
  created_at: string;
  session_id?: string;
}

export function SavedNotesPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const [notes, setNotes] = useState<SavedNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reload notes on mount and whenever pathname changes (e.g., after delete redirect)
  useEffect(() => {
    loadNotes();
  }, [pathname]);

  const loadNotes = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.getNotes();

      if (response.error) {
        setError(response.error);
      } else if (response.data) {
        setNotes(response.data.notes);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notes");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNoteClick = (noteId: string) => {
    router.push(`/notes/${noteId}`);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400 mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading notes...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <AlertCircle className="h-8 w-8 text-red-500 dark:text-red-400 mb-3" />
        <p className="text-sm text-red-600 dark:text-red-400 text-center mb-4">
          {error}
        </p>
        <Button onClick={loadNotes} size="sm" variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  // Empty state
  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Bookmark className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
          No saved notes yet
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-2">
          Save notes from the Notes tab to see them here
        </p>
      </div>
    );
  }

  // Notes list
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Saved Notes ({notes.length})
          </h3>
          <Button onClick={loadNotes} size="sm" variant="ghost" className="h-6 px-2">
            <span className="text-xs">Refresh</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {notes.map((note) => (
          <button
            key={note.note_id}
            onClick={() => handleNoteClick(note.note_id)}
            className="w-full text-left p-4 border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1 line-clamp-1">
              {note.title}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 line-clamp-2">
              {note.content_preview.substring(0, 50)}
              {note.content_preview.length > 50 ? "..." : ""}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

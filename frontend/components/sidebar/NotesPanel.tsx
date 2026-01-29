"use client";

import { useState } from "react";
import { useNotes } from "@/hooks/useNotes";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SaveNoteDialog } from "./SaveNoteDialog";

export function NotesPanel() {
  const { content, setContent, saveNote, clearNotes, characterCount } = useNotes();
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const handleSaveClick = () => {
    if (content.trim().length === 0) {
      toast.error("Cannot save empty note");
      return;
    }
    setShowSaveDialog(true);
  };

  const handleSaveNote = async (title: string) => {
    const result = await saveNote(title);

    if (result.success) {
      toast.success("Note saved successfully!", {
        description: `"${title}" has been saved to the database.`,
      });
    } else {
      toast.error("Failed to save note", {
        description: result.error || "An unknown error occurred",
      });
      throw new Error(result.error || "Failed to save note");
    }
  };

  const handleClearClick = () => {
    if (content.trim().length === 0) {
      return;
    }

    const confirmed = window.confirm(
      "Clear all notes? This will remove the content from the notepad.\n\nNote: This does NOT delete saved notes from the database."
    );

    if (confirmed) {
      clearNotes();
      toast.success("Notepad cleared");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type your notes here or right-click selected text to add it. Notes persist across all pages."
          className="h-full min-h-[300px] resize-none focus-visible:ring-1"
        />
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 space-y-2">
        <div className="flex gap-2">
          <Button
            onClick={handleSaveClick}
            disabled={content.trim().length === 0}
            size="sm"
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Save className="h-4 w-4 mr-1" />
            Save Note
          </Button>
          <Button
            onClick={handleClearClick}
            disabled={content.trim().length === 0}
            size="sm"
            variant="outline"
            className="px-3"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          {characterCount} character{characterCount !== 1 ? 's' : ''}
        </p>
      </div>

      <SaveNoteDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        content={content}
        onSave={handleSaveNote}
      />
    </div>
  );
}

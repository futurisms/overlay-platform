"use client";

import { ReactNode, useEffect, useState } from "react";
import { useTextSelection } from "@/hooks/useTextSelection";
import { useNotes } from "@/hooks/useNotes";
import { StickyNote } from "lucide-react";
import { toast } from "sonner";

interface TextSelectionHandlerProps {
  children: ReactNode;
}

export function TextSelectionHandler({ children }: TextSelectionHandlerProps) {
  const { getSelectedText, clearSelection } = useTextSelection();
  const { addToNotes } = useNotes();
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

  const handleAddToNotes = () => {
    const selectedText = getSelectedText();
    if (selectedText) {
      addToNotes(selectedText);
      toast.success("Added to notes!", {
        description: `"${selectedText.substring(0, 50)}${selectedText.length > 50 ? "..." : ""}"`,
        duration: 2000,
      });
      clearSelection();
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    const selectedText = getSelectedText();

    if (selectedText.length > 0) {
      e.preventDefault();
      setContextMenuPosition({ x: e.clientX, y: e.clientY });
      setShowContextMenu(true);
    }
  };

  useEffect(() => {
    const handleClickOutside = () => {
      setShowContextMenu(false);
    };

    if (showContextMenu) {
      document.addEventListener("click", handleClickOutside);
      document.addEventListener("contextmenu", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("contextmenu", handleClickOutside);
    };
  }, [showContextMenu]);

  return (
    <div onContextMenu={handleContextMenu}>
      {children}

      {/* Context Menu */}
      {showContextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg py-1 animate-in fade-in zoom-in-95 duration-100"
          style={{
            left: `${contextMenuPosition.x}px`,
            top: `${contextMenuPosition.y}px`,
          }}
        >
          <button
            onClick={() => {
              handleAddToNotes();
              setShowContextMenu(false);
            }}
            className="w-full px-4 py-2 text-sm text-left hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
          >
            <StickyNote className="h-4 w-4" />
            Add to Notes
          </button>
        </div>
      )}
    </div>
  );
}

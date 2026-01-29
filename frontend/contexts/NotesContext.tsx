"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

interface NotesContextType {
  content: string;
  setContent: (content: string) => void;
  addToNotes: (text: string) => void;
  saveNote: (title: string, sessionId?: string) => Promise<{ success: boolean; noteId?: string; error?: string }>;
  clearNotes: () => void;
  characterCount: number;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

const STORAGE_KEY = "overlay-notes-content";

export function NotesProvider({ children }: { children: ReactNode }) {
  const [content, setContentState] = useState<string>("");
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setContentState(saved);
    }
    setIsHydrated(true);
  }, []);

  // Save to localStorage whenever content changes
  const setContent = (newContent: string) => {
    setContentState(newContent);
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY, newContent);
    }
  };

  // Append selected text to notes
  const addToNotes = (text: string) => {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    const newContent = content
      ? `${content}\n\n• ${trimmedText}`
      : `• ${trimmedText}`;

    setContent(newContent);
  };

  // Save note to database
  const saveNote = async (title: string, sessionId?: string): Promise<{ success: boolean; noteId?: string; error?: string }> => {
    if (!content.trim()) {
      return { success: false, error: "Cannot save empty note" };
    }

    if (!title.trim()) {
      return { success: false, error: "Title is required" };
    }

    try {
      const response = await apiClient.createNote(title.trim(), content, sessionId);

      if (response.error) {
        return { success: false, error: response.error };
      }

      if (response.data) {
        return { success: true, noteId: response.data.note_id };
      }

      return { success: false, error: "Unknown error occurred" };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to save note" };
    }
  };

  // Clear notes
  const clearNotes = () => {
    setContent("");
  };

  const characterCount = content.length;

  return (
    <NotesContext.Provider value={{ content, setContent, addToNotes, saveNote, clearNotes, characterCount }}>
      {children}
    </NotesContext.Provider>
  );
}

export function useNotesContext() {
  const context = useContext(NotesContext);
  if (context === undefined) {
    throw new Error("useNotesContext must be used within a NotesProvider");
  }
  return context;
}

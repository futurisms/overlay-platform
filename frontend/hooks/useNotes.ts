import { useNotesContext } from "@/contexts/NotesContext";

export function useNotes() {
  return useNotesContext();
}

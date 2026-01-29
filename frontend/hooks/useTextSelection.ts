"use client";

import { useCallback } from "react";

export function useTextSelection() {
  const getSelectedText = useCallback(() => {
    const selection = window.getSelection();
    return selection?.toString().trim() || "";
  }, []);

  const clearSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges();
  }, []);

  return {
    getSelectedText,
    clearSelection,
  };
}

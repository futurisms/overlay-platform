"use client";

import { useState } from "react";
import { ChevronRight, ChevronLeft, StickyNote, Bookmark, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NotesPanel } from "./NotesPanel";
import { SavedNotesPanel } from "./SavedNotesPanel";

type TabType = "notes" | "saved" | "tools";

export function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("notes");

  const tabs = [
    { id: "notes" as TabType, label: "Notes", icon: StickyNote, enabled: true },
    { id: "saved" as TabType, label: "Saved", icon: Bookmark, enabled: true },
    { id: "tools" as TabType, label: "Tools", icon: Wrench, enabled: false },
  ];

  return (
    <div
      className={`fixed right-0 top-0 h-screen transition-all duration-300 z-40 ${
        isExpanded ? "w-[300px]" : "w-12"
      }`}
    >
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full rounded-r-none bg-white dark:bg-slate-900 border border-r-0 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        {isExpanded ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>

      {/* Sidebar Content */}
      {isExpanded && (
        <Card className="h-full rounded-none border-l border-t-0 border-b-0 border-r-0 flex flex-col">
          {/* Tab Headers */}
          <div className="border-b border-slate-200 dark:border-slate-700 flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => tab.enabled && setActiveTab(tab.id)}
                  disabled={!tab.enabled}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                    activeTab === tab.id
                      ? "text-blue-600 dark:text-blue-400"
                      : tab.enabled
                      ? "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                      : "text-slate-400 dark:text-slate-600 cursor-not-allowed"
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <Icon className="h-4 w-4" />
                    <span className="text-xs">{tab.label}</span>
                  </div>
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === "notes" && <NotesPanel />}
            {activeTab === "saved" && <SavedNotesPanel />}
            {activeTab === "tools" && (
              <div className="p-4 text-center text-slate-500 dark:text-slate-400">
                <Wrench className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Coming in Phase 3</p>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

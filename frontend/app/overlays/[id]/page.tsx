"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, Plus, Edit, Trash2, Save } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { getCurrentUser } from "@/lib/auth";

interface Criterion {
  criteria_id: string;
  name: string;
  description: string;
  weight: number;
  max_score: number;
  category: string;
  is_active: boolean;
}

interface Overlay {
  overlay_id: string;
  name: string;
  description: string;
  document_type: string;
  document_purpose?: string;
  when_used?: string;
  process_context?: string;
  target_audience?: string;
  is_active: boolean;
  created_at: string;
  criteria?: Criterion[];
}

export default function EditOverlayPage() {
  const router = useRouter();
  const params = useParams();
  const overlayId = params.id as string;

  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  // New criterion form state
  const [showNewForm, setShowNewForm] = useState(false);
  const [newCriterion, setNewCriterion] = useState({
    name: "",
    description: "",
    weight: 0.0,
    max_score: 100,
    category: "",
  });

  // Edit criterion state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      router.push("/login");
      return;
    }
    setUser(currentUser);
    loadOverlayData();
  }, [router, overlayId]);

  const loadOverlayData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await apiClient.getOverlay(overlayId);
      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setOverlay(result.data);
        setCriteria(result.data.criteria || []);
      }
    } catch (err) {
      setError("Failed to load intelligence template");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCriterion = async () => {
    setError(null);
    setSuccess(null);

    // Validation
    if (!newCriterion.name.trim()) {
      setError("Criterion name is required");
      return;
    }
    if (newCriterion.weight < 0 || newCriterion.weight > 1) {
      setError("Weight must be between 0.0 and 1.0");
      return;
    }

    try {
      // The API expects criteria to be added via PUT to the overlay
      const updatedCriteria = [
        ...criteria,
        {
          ...newCriterion,
          criteria_id: `temp-${Date.now()}`, // Temporary ID, backend will assign real one
          is_active: true,
        },
      ];

      const result = await apiClient.updateOverlay(overlayId, {
        criteria: updatedCriteria,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess("Criterion added successfully");
        setShowNewForm(false);
        setNewCriterion({
          name: "",
          description: "",
          weight: 0.0,
          max_score: 100,
          category: "",
        });
        await loadOverlayData();
      }
    } catch (err) {
      setError("Failed to add criterion");
      console.error(err);
    }
  };

  const handleStartEdit = (criterion: Criterion) => {
    setEditingId(criterion.criteria_id);
    setEditForm({ ...criterion });
    setError(null);
    setSuccess(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
    setError(null);
  };

  const handleSaveEdit = async (criterionId: string) => {
    setError(null);
    setSuccess(null);

    // Validation
    if (editForm.weight < 0 || editForm.weight > 1) {
      setError("Weight must be between 0.0 and 1.0");
      return;
    }

    try {
      const updatedCriteria = criteria.map((c) =>
        c.criteria_id === criterionId ? { ...c, ...editForm } : c
      );

      const result = await apiClient.updateOverlay(overlayId, {
        criteria: updatedCriteria,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess("Criterion updated successfully");
        setEditingId(null);
        setEditForm({});
        await loadOverlayData();
      }
    } catch (err) {
      setError("Failed to update criterion");
      console.error(err);
    }
  };

  const handleDeleteCriterion = async (criterionId: string) => {
    if (!confirm("Are you sure you want to delete this criterion?")) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      const updatedCriteria = criteria.filter((c) => c.criteria_id !== criterionId);

      const result = await apiClient.updateOverlay(overlayId, {
        criteria: updatedCriteria,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess("Criterion deleted successfully");
        await loadOverlayData();
      }
    } catch (err) {
      setError("Failed to delete criterion");
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-slate-600" />
          <p className="text-slate-600 dark:text-slate-400">Loading intelligence template...</p>
        </div>
      </div>
    );
  }

  if (!overlay) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <Alert variant="destructive">
          <AlertDescription>Intelligence template not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto p-6 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" onClick={() => router.push("/overlays")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Intelligence Setup
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-50 mb-2">
                {overlay.name}
              </h1>
              <p className="text-slate-600 dark:text-slate-400">{overlay.description}</p>
              <div className="flex items-center gap-4 mt-2">
                <Badge variant={overlay.is_active ? "default" : "secondary"}>
                  {overlay.is_active ? "Active" : "Inactive"}
                </Badge>
                <span className="text-sm text-slate-500">
                  Document Type: {overlay.document_type || "Any"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Document Context Card */}
        {(overlay.document_purpose || overlay.when_used || overlay.process_context || overlay.target_audience) && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Document Context</CardTitle>
              <CardDescription>Context provided for AI analysis</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {overlay.document_purpose && (
                <div>
                  <h4 className="font-semibold text-sm mb-1">Purpose</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{overlay.document_purpose}</p>
                </div>
              )}
              {overlay.when_used && (
                <div>
                  <h4 className="font-semibold text-sm mb-1">When Used</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{overlay.when_used}</p>
                </div>
              )}
              {overlay.process_context && (
                <div>
                  <h4 className="font-semibold text-sm mb-1">Process Context</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{overlay.process_context}</p>
                </div>
              )}
              {overlay.target_audience && (
                <div>
                  <h4 className="font-semibold text-sm mb-1">Target Audience</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{overlay.target_audience}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6 border-green-500 bg-green-50 text-green-900">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Evaluation Criteria Section */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Evaluation Criteria</CardTitle>
                <CardDescription>
                  Manage the criteria used to evaluate documents ({criteria.length} criteria)
                </CardDescription>
              </div>
              <Button onClick={() => setShowNewForm(!showNewForm)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Criterion
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* New Criterion Form */}
            {showNewForm && (
              <Card className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-950">
                <CardHeader>
                  <CardTitle className="text-lg">New Criterion</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="new-name">Criterion Name *</Label>
                    <Input
                      id="new-name"
                      value={newCriterion.name}
                      onChange={(e) =>
                        setNewCriterion({ ...newCriterion, name: e.target.value })
                      }
                      placeholder="e.g., Party Identification"
                    />
                  </div>

                  <div>
                    <Label htmlFor="new-description">Description</Label>
                    <Textarea
                      id="new-description"
                      value={newCriterion.description}
                      onChange={(e) =>
                        setNewCriterion({ ...newCriterion, description: e.target.value })
                      }
                      placeholder="What this criterion evaluates..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="new-weight">Weight (0.0 - 1.0) *</Label>
                      <Input
                        id="new-weight"
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={newCriterion.weight}
                        onChange={(e) =>
                          setNewCriterion({
                            ...newCriterion,
                            weight: parseFloat(e.target.value),
                          })
                        }
                      />
                    </div>

                    <div>
                      <Label htmlFor="new-max-score">Max Score</Label>
                      <Input
                        id="new-max-score"
                        type="number"
                        value={newCriterion.max_score}
                        onChange={(e) =>
                          setNewCriterion({
                            ...newCriterion,
                            max_score: parseInt(e.target.value),
                          })
                        }
                      />
                    </div>

                    <div>
                      <Label htmlFor="new-category">Category</Label>
                      <Input
                        id="new-category"
                        value={newCriterion.category}
                        onChange={(e) =>
                          setNewCriterion({ ...newCriterion, category: e.target.value })
                        }
                        placeholder="e.g., compliance"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleAddCriterion}>
                      <Save className="mr-2 h-4 w-4" />
                      Save Criterion
                    </Button>
                    <Button variant="outline" onClick={() => setShowNewForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Existing Criteria List */}
            {criteria.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                No criteria yet. Add your first criterion to get started.
              </div>
            ) : (
              <div className="space-y-4">
                {criteria.map((criterion) => (
                  <Card key={criterion.criteria_id} className="border-slate-200">
                    {editingId === criterion.criteria_id ? (
                      // Edit Mode
                      <CardContent className="pt-6 space-y-4">
                        <div>
                          <Label>Criterion Name</Label>
                          <Input
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          />
                        </div>

                        <div>
                          <Label>Description</Label>
                          <Textarea
                            value={editForm.description}
                            onChange={(e) =>
                              setEditForm({ ...editForm, description: e.target.value })
                            }
                            rows={3}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label>Weight (0.0 - 1.0)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="1"
                              value={editForm.weight}
                              onChange={(e) =>
                                setEditForm({ ...editForm, weight: parseFloat(e.target.value) })
                              }
                            />
                          </div>

                          <div>
                            <Label>Max Score</Label>
                            <Input
                              type="number"
                              value={editForm.max_score}
                              onChange={(e) =>
                                setEditForm({ ...editForm, max_score: parseInt(e.target.value) })
                              }
                            />
                          </div>

                          <div>
                            <Label>Category</Label>
                            <Input
                              value={editForm.category}
                              onChange={(e) =>
                                setEditForm({ ...editForm, category: e.target.value })
                              }
                            />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button onClick={() => handleSaveEdit(criterion.criteria_id)}>
                            <Save className="mr-2 h-4 w-4" />
                            Save Changes
                          </Button>
                          <Button variant="outline" onClick={handleCancelEdit}>
                            Cancel
                          </Button>
                        </div>
                      </CardContent>
                    ) : (
                      // View Mode
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-lg font-semibold">{criterion.name}</h3>
                              {criterion.category && (
                                <Badge variant="outline">{criterion.category}</Badge>
                              )}
                              {!criterion.is_active && (
                                <Badge variant="secondary">Inactive</Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                              {criterion.description || "No description"}
                            </p>
                            <div className="flex gap-4 text-sm">
                              <span>
                                <strong>Weight:</strong> {criterion.weight} (
                                {(criterion.weight * 100).toFixed(0)}%)
                              </span>
                              <span>
                                <strong>Max Score:</strong> {criterion.max_score}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStartEdit(criterion)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteCriterion(criterion.criteria_id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

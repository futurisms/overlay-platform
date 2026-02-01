"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ArrowLeft, Save, CheckCircle2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface Criterion {
  criteria_id: string;
  name: string;
  description: string;
  criteria_text: string | null;
  max_score: number | null;
  weight: number;
  display_order: number;
}

interface Overlay {
  overlay_id: string;
  name: string;
  description: string;
  criteria: Criterion[];
}

export default function EditCriteriaPage() {
  const router = useRouter();
  const params = useParams();
  const overlayId = params?.id as string;

  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchOverlay();
  }, [overlayId]);

  const fetchOverlay = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await apiClient.getOverlay(overlayId);

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.data) {
        setOverlay(result.data);
        // Sort criteria by display_order
        const sortedCriteria = [...(result.data.criteria || [])].sort(
          (a, b) => a.display_order - b.display_order
        );
        setCriteria(sortedCriteria);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load overlay");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCriteriaChange = (criteriaId: string, field: string, value: any) => {
    setCriteria(prev =>
      prev.map(c =>
        c.criteria_id === criteriaId
          ? { ...c, [field]: value }
          : c
      )
    );
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      // Prepare update data
      const updateData = {
        criteria: criteria.map(c => ({
          criteria_id: c.criteria_id,
          criteria_text: c.criteria_text || null,
          max_score: c.max_score || null,
        })),
      };

      const result = await apiClient.updateOverlay(overlayId, updateData);

      if (result.error) {
        setError(result.error);
        return;
      }

      setSuccessMessage("Criteria updated successfully!");

      // Auto-dismiss success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save criteria");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading criteria...</p>
        </div>
      </div>
    );
  }

  if (error && !overlay) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button
              onClick={() => router.back()}
              className="mt-4 w-full"
              variant="outline"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <Button
            onClick={() => router.back()}
            variant="ghost"
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Edit Evaluation Criteria</CardTitle>
              <CardDescription>
                {overlay?.name && (
                  <div className="mt-2">
                    <span className="font-semibold">Overlay:</span> {overlay.name}
                  </div>
                )}
                {overlay?.description && (
                  <div className="text-sm text-gray-600 mt-1">
                    {overlay.description}
                  </div>
                )}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Success Message */}
        {successMessage && (
          <Alert className="mb-6 bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              {successMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* Error Message */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Criteria Forms */}
        <div className="space-y-6 mb-6">
          {criteria.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                No criteria found for this overlay.
              </CardContent>
            </Card>
          ) : (
            criteria.map((criterion, index) => (
              <Card key={criterion.criteria_id}>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {index + 1}. {criterion.name}
                  </CardTitle>
                  {criterion.description && (
                    <CardDescription>{criterion.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Criteria Text (Rubric) */}
                  <div>
                    <Label htmlFor={`criteria-text-${criterion.criteria_id}`}>
                      Detailed Rubric Text
                      <span className="text-sm font-normal text-gray-500 ml-2">
                        (Used by AI agents for evaluation)
                      </span>
                    </Label>
                    <Textarea
                      id={`criteria-text-${criterion.criteria_id}`}
                      value={criterion.criteria_text || ""}
                      onChange={(e) =>
                        handleCriteriaChange(
                          criterion.criteria_id,
                          "criteria_text",
                          e.target.value
                        )
                      }
                      placeholder="Enter detailed evaluation rubric and guidance for this criterion..."
                      className="mt-2 min-h-[120px]"
                      disabled={isSaving}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Provide specific guidance on what constitutes excellent, good, and poor
                      performance for this criterion.
                    </p>
                  </div>

                  {/* Max Score */}
                  <div>
                    <Label htmlFor={`max-score-${criterion.criteria_id}`}>
                      Maximum Score
                      <span className="text-sm font-normal text-gray-500 ml-2">
                        (Default: {criterion.weight})
                      </span>
                    </Label>
                    <Input
                      id={`max-score-${criterion.criteria_id}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={criterion.max_score ?? criterion.weight}
                      onChange={(e) =>
                        handleCriteriaChange(
                          criterion.criteria_id,
                          "max_score",
                          e.target.value ? parseFloat(e.target.value) : null
                        )
                      }
                      className="mt-2 max-w-xs"
                      disabled={isSaving}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Override the default weight if needed. Leave empty to use weight value.
                    </p>
                  </div>

                  {/* Read-only fields for reference */}
                  <div className="pt-2 border-t text-sm text-gray-600">
                    <div className="flex gap-6">
                      <div>
                        <span className="font-medium">Weight:</span> {criterion.weight}
                      </div>
                      <div>
                        <span className="font-medium">Display Order:</span>{" "}
                        {criterion.display_order}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Save Button */}
        {criteria.length > 0 && (
          <Card>
            <CardContent className="py-6">
              <div className="flex justify-end gap-4">
                <Button
                  onClick={() => router.back()}
                  variant="outline"
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="min-w-[120px]"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

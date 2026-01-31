"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useEffect } from "react";
import { getCurrentUser } from "@/lib/auth";

export default function NewOverlayPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    document_type: "",
    document_purpose: "",
    when_used: "",
    process_context: "",
    target_audience: "",
  });

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      router.push("/login");
      return;
    }
    setUser(currentUser);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name.trim()) {
      setError("Overlay name is required");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await apiClient.createOverlay({
        name: formData.name,
        description: formData.description,
        document_type: formData.document_type || null,
        document_purpose: formData.document_purpose || null,
        when_used: formData.when_used || null,
        process_context: formData.process_context || null,
        target_audience: formData.target_audience || null,
        is_active: true,
        criteria: [], // Start with empty criteria, can be added on edit page
      });

      if (result.error) {
        setError(result.error);
        setIsSubmitting(false);
      } else if (result.data) {
        // Redirect to edit page to add criteria
        router.push(`/overlays/${result.data.overlay_id}`);
      }
    } catch (err) {
      setError("Failed to create overlay");
      console.error(err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto p-6 max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" onClick={() => router.push("/overlays")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Overlays
          </Button>

          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-50 mb-2">
              Create New Intelligence Template
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Define a new evaluation template for document analysis
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Intelligence Template Details</CardTitle>
            <CardDescription>
              Create the intelligence template first, then add evaluation criteria on the next page
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="name">
                  Overlay Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Contract Review Template"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Give your evaluation template a descriptive name
                </p>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what this overlay evaluates and when to use it..."
                  rows={4}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Help users understand when to use this evaluation template
                </p>
              </div>

              <div>
                <Label htmlFor="document_type">Document Type</Label>
                <Input
                  id="document_type"
                  value={formData.document_type}
                  onChange={(e) => setFormData({ ...formData, document_type: e.target.value })}
                  placeholder="e.g., contract, proposal, report (optional)"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Specify the type of documents this overlay is designed for (optional)
                </p>
              </div>

              <div className="border-t pt-6 space-y-4">
                <h3 className="font-semibold text-lg">Document Context (for AI Analysis)</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Provide context to help AI agents better understand and evaluate documents
                </p>

                <div>
                  <Label htmlFor="document_purpose">Document Purpose</Label>
                  <Textarea
                    id="document_purpose"
                    value={formData.document_purpose}
                    onChange={(e) => setFormData({ ...formData, document_purpose: e.target.value })}
                    placeholder="e.g., Legal agreement to establish terms between parties"
                    rows={2}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    What is the document meant to achieve?
                  </p>
                </div>

                <div>
                  <Label htmlFor="when_used">When Used</Label>
                  <Textarea
                    id="when_used"
                    value={formData.when_used}
                    onChange={(e) => setFormData({ ...formData, when_used: e.target.value })}
                    placeholder="e.g., Pre-signature review and compliance verification"
                    rows={2}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    When should this evaluation template be used?
                  </p>
                </div>

                <div>
                  <Label htmlFor="process_context">Process Context</Label>
                  <Textarea
                    id="process_context"
                    value={formData.process_context}
                    onChange={(e) => setFormData({ ...formData, process_context: e.target.value })}
                    placeholder="e.g., Legal review and approval workflow"
                    rows={2}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    What process is this document part of?
                  </p>
                </div>

                <div>
                  <Label htmlFor="target_audience">Target Audience</Label>
                  <Input
                    id="target_audience"
                    value={formData.target_audience}
                    onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                    placeholder="e.g., Legal team, executives, compliance officers"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Who is the intended audience?
                  </p>
                </div>
              </div>

              <div className="border-t pt-6">
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <strong>Next Step:</strong> After creating the intelligence template, you'll be able to add
                    evaluation criteria with specific weights, descriptions, and categories.
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button type="submit" disabled={isSubmitting}>
                    <Plus className="mr-2 h-4 w-4" />
                    {isSubmitting ? "Creating..." : "Create Intelligence Template"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/overlays")}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mt-6 border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg">What are Intelligence Templates?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
            <p>
              Intelligence templates define how documents should be analyzed and
              scored. Each template contains:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Evaluation Criteria</strong> - Specific aspects to evaluate (e.g., "Party
                Identification", "Contract Value")
              </li>
              <li>
                <strong>Weights</strong> - How important each criterion is (0.0 to 1.0)
              </li>
              <li>
                <strong>Categories</strong> - Grouping criteria by type (e.g., compliance,
                quality, legal)
              </li>
              <li>
                <strong>Max Scores</strong> - The maximum points achievable for each criterion
              </li>
            </ul>
            <p>
              Once created, overlays can be assigned to review sessions so that all documents in
              that session are evaluated consistently using the same criteria.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

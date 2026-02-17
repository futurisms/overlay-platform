"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, CheckCircle2, AlertCircle, Loader2, FileText } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { parseOverlayDocx, validateParsedData, type ParsedOverlayData } from "@/lib/docx-parser";

interface ImportOverlayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ImportOverlayDialog({
  open,
  onOpenChange,
  onSuccess,
}: ImportOverlayDialogProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedOverlayData | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Edit state for preview
  const [editedOverlay, setEditedOverlay] = useState<any>({});

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Check file type
    if (!selectedFile.name.endsWith('.docx')) {
      setError('Please select a .docx file');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setIsParsing(true);
    setParsedData(null);
    setValidationErrors([]);

    try {
      const data = await parseOverlayDocx(selectedFile);
      setParsedData(data);

      // Initialize edited data with parsed data
      setEditedOverlay({
        name: data.overlay.name,
        description: data.overlay.description,
        document_type: data.overlay.document_type,
        document_purpose: data.overlay.document_purpose || '',
        when_used: data.overlay.when_used || '',
        process_context: data.overlay.process_context || '',
        target_audience: data.overlay.target_audience || '',
        criteria: data.criteria.map(c => ({
          name: c.name,
          criterion_type: c.criterion_type,
          description: c.description,
          weight: c.weight,
          max_score: c.max_score,
        })),
      });

      // Validate
      const errors = validateParsedData(data);
      setValidationErrors(errors);

      if (errors.length === 0) {
        console.log('✅ Successfully parsed overlay from DOCX');
      }
    } catch (err) {
      console.error('Error parsing DOCX:', err);
      setError(`Failed to parse DOCX file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handleCreate = async () => {
    if (!parsedData || validationErrors.length > 0) return;

    setIsCreating(true);
    setError(null);

    try {
      // Create overlay with criteria
      const result = await apiClient.createOverlay({
        name: editedOverlay.name,
        description: editedOverlay.description,
        document_type: editedOverlay.document_type,
        document_purpose: editedOverlay.document_purpose || null,
        when_used: editedOverlay.when_used || null,
        process_context: editedOverlay.process_context || null,
        target_audience: editedOverlay.target_audience || null,
        is_active: true,
        criteria: editedOverlay.criteria.map((c: any, index: number) => ({
          name: c.name,
          description: c.description,
          criterion_type: c.criterion_type,
          weight: c.weight * 100, // Convert to percentage (backend expects 0-100)
          max_score: c.max_score,
          is_required: true,
          display_order: index,
        })),
      });

      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        // Success!
        console.log('✅ Overlay created successfully:', result.data.overlay_id);
        onOpenChange(false);

        // Call success callback if provided
        if (onSuccess) {
          onSuccess();
        }

        // Navigate to the new overlay detail page
        router.push(`/overlays/${result.data.overlay_id}`);
      }
    } catch (err) {
      console.error('Error creating overlay:', err);
      setError('Failed to create overlay. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedData(null);
    setError(null);
    setValidationErrors([]);
    setEditedOverlay({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Overlay from DOCX</DialogTitle>
          <DialogDescription>
            Upload a structured DOCX file containing overlay criteria and evaluation rubric
          </DialogDescription>
        </DialogHeader>

        {/* File Upload */}
        {!parsedData && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-8 text-center">
              <input
                type="file"
                id="docx-upload"
                accept=".docx"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="docx-upload"
                className="cursor-pointer flex flex-col items-center gap-4"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Parsing DOCX file...
                    </p>
                  </>
                ) : (
                  <>
                    <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <Upload className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        Click to upload DOCX file
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Structured overlay criteria document (.docx only)
                      </p>
                    </div>
                  </>
                )}
              </label>
            </div>

            {file && !isParsing && !parsedData && (
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <FileText className="h-4 w-4" />
                <span>{file.name}</span>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-semibold mb-2">Validation Errors:</div>
              <ul className="list-disc list-inside space-y-1">
                {validationErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Preview / Edit Form */}
        {parsedData && validationErrors.length === 0 && (
          <div className="space-y-6">
            {/* Success Message */}
            <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                Successfully parsed: <strong>{parsedData.overlay.name}</strong>
              </AlertDescription>
            </Alert>

            {/* Overlay Details */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Overlay Details</h3>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="edit-name">Overlay Name *</Label>
                  <Input
                    id="edit-name"
                    value={editedOverlay.name || ''}
                    onChange={(e) => setEditedOverlay({ ...editedOverlay, name: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={editedOverlay.description || ''}
                    onChange={(e) => setEditedOverlay({ ...editedOverlay, description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-doc-type">Document Type *</Label>
                    <Input
                      id="edit-doc-type"
                      value={editedOverlay.document_type || ''}
                      onChange={(e) => setEditedOverlay({ ...editedOverlay, document_type: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-target-audience">Target Audience</Label>
                    <Input
                      id="edit-target-audience"
                      value={editedOverlay.target_audience || ''}
                      onChange={(e) => setEditedOverlay({ ...editedOverlay, target_audience: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="edit-doc-purpose">Document Purpose</Label>
                  <Textarea
                    id="edit-doc-purpose"
                    value={editedOverlay.document_purpose || ''}
                    onChange={(e) => setEditedOverlay({ ...editedOverlay, document_purpose: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Criteria Preview */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">
                Evaluation Criteria ({parsedData.criteria.length} found)
              </h3>

              {editedOverlay.criteria?.map((criterion: any, index: number) => (
                <div key={index} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`crit-name-${index}`}>Criterion Name *</Label>
                      <Input
                        id={`crit-name-${index}`}
                        value={criterion.name}
                        onChange={(e) => {
                          const updated = [...editedOverlay.criteria];
                          updated[index].name = e.target.value;
                          setEditedOverlay({ ...editedOverlay, criteria: updated });
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label htmlFor={`crit-type-${index}`}>Type</Label>
                        <Input
                          id={`crit-type-${index}`}
                          value={criterion.criterion_type}
                          onChange={(e) => {
                            const updated = [...editedOverlay.criteria];
                            updated[index].criterion_type = e.target.value;
                            setEditedOverlay({ ...editedOverlay, criteria: updated });
                          }}
                        />
                      </div>

                      <div>
                        <Label htmlFor={`crit-weight-${index}`}>Weight</Label>
                        <Input
                          id={`crit-weight-${index}`}
                          type="number"
                          step="0.1"
                          value={criterion.weight}
                          onChange={(e) => {
                            const updated = [...editedOverlay.criteria];
                            updated[index].weight = parseFloat(e.target.value) || 0;
                            setEditedOverlay({ ...editedOverlay, criteria: updated });
                          }}
                        />
                      </div>

                      <div>
                        <Label htmlFor={`crit-max-${index}`}>Max Score</Label>
                        <Input
                          id={`crit-max-${index}`}
                          type="number"
                          step="0.1"
                          value={criterion.max_score}
                          onChange={(e) => {
                            const updated = [...editedOverlay.criteria];
                            updated[index].max_score = parseFloat(e.target.value) || 0;
                            setEditedOverlay({ ...editedOverlay, criteria: updated });
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor={`crit-desc-${index}`}>
                      Description (Includes Scoring Rubric)
                    </Label>
                    <Textarea
                      id={`crit-desc-${index}`}
                      value={criterion.description}
                      onChange={(e) => {
                        const updated = [...editedOverlay.criteria];
                        updated[index].description = e.target.value;
                        setEditedOverlay({ ...editedOverlay, criteria: updated });
                      }}
                      rows={6}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          {parsedData && validationErrors.length === 0 && (
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Overlay'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

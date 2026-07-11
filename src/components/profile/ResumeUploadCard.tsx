import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Upload, Loader2, ExternalLink, X } from "lucide-react";

const DEFAULT_ACCEPT = ".pdf,.doc,.docx";
const ACCEPT_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

interface ResumeUploadCardProps {
  /** Whether a resume is already saved and available to view. */
  hasResume: boolean;
  /** Direct href for viewing a public resume. If omitted and `onView` is set, View is a button. */
  viewHref?: string | null;
  /** Resolve + open a private (signed-url) resume. */
  onView?: () => void;
  /** Spinner while resolving a signed view URL. */
  viewing?: boolean;
  /** Name of a file selected but not yet uploaded (save-on-submit flow). */
  pendingFileName?: string | null;
  /** Clear the pending (not-yet-uploaded) file. */
  onClearPending?: () => void;
  /** Spinner while an immediate upload is in progress. */
  uploading?: boolean;
  /** Called with a validated file when the user picks one. */
  onSelectFile: (file: File) => void;
  /** Remove the saved resume. */
  onRemove?: () => void;
  accept?: string;
  maxSizeMb?: number;
}

/**
 * Resume upload card shared by the mentee and mentor profile pages.
 * Visual style adapted from mentorle's mentee profile, themed to Edubrige.
 */
const ResumeUploadCard = ({
  hasResume,
  viewHref,
  onView,
  viewing = false,
  pendingFileName = null,
  onClearPending,
  uploading = false,
  onSelectFile,
  onRemove,
  accept = DEFAULT_ACCEPT,
  maxSizeMb = 10,
}: ResumeUploadCardProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`File must be under ${maxSizeMb} MB`);
      return;
    }
    if (file.type && !ACCEPT_MIME.includes(file.type)) {
      setError("Please select a PDF or Word document");
      return;
    }
    setError(null);
    onSelectFile(file);
  };

  const renderView = () => {
    if (onView) {
      return (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto p-0 text-primary hover:bg-transparent hover:underline"
          onClick={onView}
          disabled={viewing}
        >
          {viewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "View resume"}
        </Button>
      );
    }
    if (viewHref) {
      return (
        <a
          href={viewHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          View resume <ExternalLink className="h-3 w-3" />
        </a>
      );
    }
    return null;
  };

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <FileText className="h-4 w-4 text-primary" />
        <h2 className="text-[15px] font-semibold">Resume</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        PDF or Word document. Max {maxSizeMb} MB
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {pendingFileName ? (
          <div className="flex flex-1 items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 min-w-0">
            <FileText className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{pendingFileName}</p>
              <p className="text-xs text-muted-foreground">Will upload on save</p>
            </div>
            {onClearPending && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={onClearPending}
                aria-label="Clear selected file"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : hasResume ? (
          <div className="flex flex-1 items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 min-w-0">
            <FileText className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Resume uploaded</p>
              {renderView()}
            </div>
            {onRemove && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive shrink-0"
                onClick={onRemove}
              >
                Remove
              </Button>
            )}
          </div>
        ) : (
          <p className="flex-1 text-sm text-muted-foreground">No resume uploaded</p>
        )}

        {!pendingFileName && (
          <Button
            type="button"
            className="gap-2 shrink-0"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                {hasResume ? "Replace resume" : "Upload resume"}
              </>
            )}
          </Button>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handlePick}
        disabled={uploading}
      />
    </div>
  );
};

export default ResumeUploadCard;

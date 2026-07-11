import { useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, Loader2 } from "lucide-react";

interface Props {
  url: string | null;
  fallback: string;
  uploading?: boolean;
  onSelect: (file: File) => void;
}

const AvatarUploader = ({ url, fallback, uploading, onSelect }: Props) => {
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = (f: File | null | undefined) => {
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) return setError("Image must be under 2MB");
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type))
      return setError("Use JPG, PNG, or WebP");
    setError(null);
    onSelect(f);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative group">
        <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
          <AvatarImage src={url ?? undefined} alt="Profile" />
          <AvatarFallback className="text-2xl font-semibold bg-primary/10 text-primary">
            {fallback}
          </AvatarFallback>
        </Avatar>
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={uploading}
          className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Change avatar"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          ) : (
            <Camera className="h-5 w-5 text-white" />
          )}
        </button>
        <input
          ref={ref}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={() => ref.current?.click()} disabled={uploading}>
        {uploading ? "Uploading…" : "Change photo"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};

export default AvatarUploader;

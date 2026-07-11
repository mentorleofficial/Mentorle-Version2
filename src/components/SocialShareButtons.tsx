import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Linkedin, Twitter, Copy, Check } from "lucide-react";
import { toast } from "sonner";

type Props = {
  url: string;
  text: string;
  label?: string;
};

const SocialShareButtons = ({ url, text, label = "Share" }: Props) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 1500);
  };

  const liUrl = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(`${text}\n\n${url}`)}`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground mr-1">{label}:</span>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => window.open(liUrl, "_blank", "noopener,noreferrer")}
        aria-label="Share on LinkedIn"
      >
        <Linkedin className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => window.open(xUrl, "_blank", "noopener,noreferrer")}
        aria-label="Share on X"
      >
        <Twitter className="h-3.5 w-3.5" />
      </Button>
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={copy} aria-label="Copy link">
        {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
};

export default SocialShareButtons;

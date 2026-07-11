import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Linkedin, Copy, ExternalLink, PartyPopper, Check } from "lucide-react";
import { toast } from "sonner";
import { useBranding } from "@/contexts/BrandingContext";
import { useApprovalCelebration } from "./useApprovalCelebration";

const fireConfetti = () => {
  const end = Date.now() + 800;
  const colors = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899"];
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
};

const ApprovalCelebrationModal = () => {
  const { show, profileUrl, expertise, fullName, acknowledge } = useApprovalCelebration();
  const branding = useBranding();
  const [copied, setCopied] = useState(false);
  const fired = useRef(false);

  const firstName = fullName.split(" ")[0] || "there";
  const topExpertise = expertise.slice(0, 3).join(", ") || "career growth";
  const appNameHashtag = branding.app_name.replace(/\s+/g, "");
  const defaultCaption = `I look forward to guiding learners, sharing practical industry insights, and supporting young talent as they prepare for their academic and career journeys.\n\nIf you are looking for guidance in ${topExpertise}, feel free to connect with me.\n\nCheck out my mentor profile here: ${profileUrl}\n\n#Mentorship #${appNameHashtag} #CareerGuidance #LearningAndDevelopment #GivingBack`;
  const [caption, setCaption] = useState(defaultCaption);

  useEffect(() => {
    setCaption(defaultCaption);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileUrl, expertise.join(","), branding.app_name, appNameHashtag]);

  useEffect(() => {
    if (show && !fired.current) {
      fired.current = true;
      setTimeout(fireConfetti, 200);
    }
  }, [show]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    toast.success("Profile link copied");
    setTimeout(() => setCopied(false), 1500);
  };

  const shareOnLinkedIn = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      toast.success("Caption copied! Paste it on LinkedIn if it doesn't appear.");
    } catch {
      /* clipboard may be blocked */
    }
    // LinkedIn composer accepts a `text` param that prefills the post body
    const url = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(caption)}`;
    window.open(url, "_blank", "noopener,noreferrer,width=720,height=720");
  };

  const viewProfile = () => {
    window.open(profileUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={show} onOpenChange={(o) => { if (!o) acknowledge(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="items-center text-center">
          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-2">
            <PartyPopper className="h-7 w-7 text-primary-foreground" />
          </div>
          <DialogTitle className="text-2xl">Congratulations, {firstName}! 🎉</DialogTitle>
          <DialogDescription className="text-base">
            Your mentor profile has been approved. It's time to share this milestone with your professional network and let others know that you are mentoring learners through {branding.app_name}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Your public profile</Label>
            <div className="flex gap-2">
              <Input value={profileUrl} readOnly className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
              <Button type="button" variant="outline" size="icon" onClick={copyLink} aria-label="Copy link">
                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="caption" className="text-xs uppercase tracking-wide text-muted-foreground">
              Suggested LinkedIn caption (editable)
            </Label>
            <Textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={5}
              className="text-sm"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
            <Button type="button" variant="ghost" onClick={() => acknowledge()}>
              Maybe later
            </Button>
            <Button type="button" variant="outline" onClick={viewProfile}>
              <ExternalLink className="h-4 w-4" /> View my profile
            </Button>
            <Button type="button" onClick={shareOnLinkedIn} className="bg-[#0A66C2] hover:bg-[#0A66C2]/90 text-white">
              <Linkedin className="h-4 w-4" /> Share on LinkedIn
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ApprovalCelebrationModal;

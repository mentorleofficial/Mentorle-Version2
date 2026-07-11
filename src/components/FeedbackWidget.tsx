import { useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle, AlertCircle, Lightbulb, Star, Send, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Category = "feedback" | "concern" | "suggestion" | "review";

const CATEGORIES: { value: Category; label: string; icon: typeof MessageCircle }[] = [
  { value: "feedback", label: "Feedback", icon: MessageCircle },
  { value: "concern", label: "Concern", icon: AlertCircle },
  { value: "suggestion", label: "Suggestion", icon: Lightbulb },
  { value: "review", label: "Review", icon: Star },
];

const MAX_LEN = 1000;

const FeedbackWidget = () => {
  const { user, role } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>("feedback");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!user || role === "admin" || location.pathname.startsWith("/admin")) return null;

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_LEN) {
      toast.error(`Please keep your message under ${MAX_LEN} characters.`);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("general_feedback").insert({
      user_id: user.id,
      category,
      message: trimmed,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Thanks! Your feedback has been submitted.");
    setMessage("");
    setCategory("feedback");
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Share feedback"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-primary/20 pl-5 pr-6 py-3 transition-all hover:scale-105 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="font-medium text-sm">Feedback</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0">
          <DialogHeader className="bg-foreground text-background p-6 space-y-1">
            <DialogTitle className="flex items-center gap-2 text-background">
              <MessageCircle className="h-5 w-5" /> Share Your Feedback
            </DialogTitle>
            <DialogDescription className="text-background/70">
              Help us improve the platform
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-medium">What would you like to share?</p>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((c) => {
                  const Icon = c.icon;
                  const active = category === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCategory(c.value)}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-md border px-3 py-3 text-sm font-medium transition-colors",
                        active
                          ? "bg-foreground text-background border-foreground"
                          : "bg-background hover:bg-muted border-input"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="feedback-message">Your Message</label>
              <Textarea
                id="feedback-message"
                rows={5}
                maxLength={MAX_LEN}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us your feedback... Your input helps us improve the platform for everyone!"
              />
              <p className="text-xs text-muted-foreground">{message.length}/{MAX_LEN} characters</p>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting || !message.trim()}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              {submitting ? "Submitting…" : "Submit Feedback"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FeedbackWidget;

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option {
  label: string;
  value: number;
}

interface Question {
  id: string;
  title: string;
  question: string;
  type: "options" | "stars";
  options?: Option[];
}

const QUESTIONS: Question[] = [
  {
    id: "expectation",
    title: "Expectation Fulfillment",
    question: "Did the mentorship program help you achieve what you expected?",
    type: "options",
    options: [
      { label: "Fully achieved", value: 5 },
      { label: "Mostly achieved", value: 4 },
      { label: "Partially achieved", value: 3 },
      { label: "Not achieved", value: 1 },
    ],
  },
  {
    id: "guidance",
    title: "Guidance Quality",
    question: "How would you rate the quality of guidance provided by your mentor?",
    type: "stars",
  },
  {
    id: "engagement",
    title: "Engagement",
    question: "How would you rate your mentor's engagement and responsiveness?",
    type: "stars",
  },
  {
    id: "insights",
    title: "Practical Insights",
    question: "How would you rate the practical insights and real-world advice shared?",
    type: "stars",
  },
  {
    id: "value",
    title: "Overall Value",
    question: "How would you rate the overall value of this mentorship session?",
    type: "stars",
  },
];

interface MenteeFeedbackSurveyProps {
  sessionId: string;
  userId: string;
  onComplete: () => void;
}

export default function MenteeFeedbackSurvey({
  sessionId,
  userId,
  onComplete,
}: MenteeFeedbackSurveyProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [hoverRating, setHoverRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const answeredCount = Object.keys(answers).length;
    if (answeredCount < QUESTIONS.length) {
      toast({
        variant: "destructive",
        title: "Incomplete",
        description: "Please answer all survey questions.",
      });
      return;
    }
    setSubmitting(true);

    const sum = Object.values(answers).reduce((a, b) => a + b, 0);
    const averageRating = sum / QUESTIONS.length;
    const finalRating = Math.round(averageRating);

    // Format survey responses cleanly in comments
    const surveyText = [
      `Did the mentorship program help you achieve what you expected?: ${
        QUESTIONS[0].options?.find((o) => o.value === answers.expectation)?.label || ""
      }`,
      `Guidance quality: ${answers.guidance} / 5 stars`,
      `Engagement: ${answers.engagement} / 5 stars`,
      `Practical insights: ${answers.insights} / 5 stars`,
      `Overall mentorship value: ${answers.value} / 5 stars`,
    ].join("\n");

    const finalComment = comment.trim()
      ? `${comment.trim()}\n\n---\nSurvey Responses:\n${surveyText}`
      : `Survey Responses:\n${surveyText}`;

    try {
      const { error } = await supabase.from("feedback").insert([
        {
          session_id: sessionId,
          submitted_by: userId,
          rating: finalRating,
          comment: finalComment || null,
          audience: "mentor",
        },
      ]);

      if (error) throw error;

      toast({
        title: "Thank you!",
        description: "Your feedback has been submitted.",
      });
      onComplete();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (currentStep < QUESTIONS.length) {
    const q = QUESTIONS[currentStep];
    return (
      <div className="space-y-5">
        {/* Progress Indicator */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground font-medium">
            <span>
              Question {currentStep + 1} of {QUESTIONS.length + 1}
            </span>
            <span>{Math.round((currentStep / (QUESTIONS.length + 1)) * 100)}% Complete</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(currentStep / (QUESTIONS.length + 1)) * 100}%` }}
            />
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-xs font-bold text-primary tracking-wider uppercase">
            {q.title}
          </span>
          <h3 className="text-base font-semibold text-foreground leading-snug">
            {q.question}
          </h3>
        </div>

        {q.type === "options" ? (
          <div className="grid gap-3 pt-2">
            {q.options?.map((opt) => {
              const isSelected = answers[q.id] === opt.value;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    setAnswers((prev) => ({
                      ...prev,
                      [q.id]: opt.value,
                    }));
                  }}
                  className={cn(
                    "flex flex-col items-start p-3.5 rounded-xl border text-left transition-all duration-200 hover:bg-muted/30 hover:-translate-y-[1px]",
                    isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card/50"
                  )}
                >
                  <span className="font-medium text-sm text-foreground">{opt.label}</span>
                  <div className="flex gap-0.5 mt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={cn(
                          "h-3.5 w-3.5",
                          star <= opt.value ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/30"
                        )}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center py-6">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => {
                    setAnswers((prev) => ({
                      ...prev,
                      [q.id]: star,
                    }));
                  }}
                  className="transition-transform hover:scale-110 focus:outline-none"
                >
                  <Star
                    className={cn(
                      "h-10 w-10 transition-colors",
                      star <= (hoverRating || answers[q.id] || 0)
                        ? "fill-yellow-500 text-yellow-500"
                        : "text-border"
                    )}
                  />
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground mt-3 font-medium">
              {answers[q.id] ? `${answers[q.id]} out of 5 stars` : "Select rating"}
            </span>
          </div>
        )}

        <div className="flex justify-between items-center pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (currentStep > 0) {
                setCurrentStep(currentStep - 1);
              }
            }}
            disabled={currentStep === 0}
          >
            Back
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (currentStep < QUESTIONS.length) {
                setCurrentStep(currentStep + 1);
              }
            }}
            disabled={!answers[q.id]}
          >
            Next
          </Button>
        </div>
      </div>
    );
  }

  const avg = Object.values(answers).reduce((a, b) => a + b, 0) / QUESTIONS.length;

  return (
    <div className="space-y-5">
      {/* Progress Indicator */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground font-medium">
          <span>
            Step {QUESTIONS.length + 1} of {QUESTIONS.length + 1}
          </span>
          <span>100% Complete</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary w-full" />
        </div>
      </div>

      <div className="space-y-1">
        <span className="text-xs font-bold text-primary tracking-wider uppercase">
          Final Review
        </span>
        <h3 className="text-base font-semibold text-foreground leading-snug">
          Tell us more about your experience
        </h3>
      </div>

      <div className="rounded-xl border bg-muted/20 p-4 space-y-2">
        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
          Calculated Overall Rating
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={cn(
                  "h-7 w-7",
                  star <= Math.round(avg) ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/25"
                )}
              />
            ))}
          </div>
          <span className="text-lg font-bold text-foreground mt-0.5">{avg.toFixed(1)} / 5.0</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="feedback-comment" className="text-sm font-semibold">
          Comment (optional)
        </Label>
        <Textarea
          id="feedback-comment"
          rows={4}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
          placeholder="Share your experience (what went well, topics discussed...)"
          className="rounded-xl"
        />
      </div>

      <div className="flex justify-between items-center pt-4 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setCurrentStep(QUESTIONS.length - 1);
          }}
          disabled={submitting}
        >
          Back
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={submitting} className="w-32">
          {submitting ? "Submitting…" : "Submit"}
        </Button>
      </div>
    </div>
  );
}

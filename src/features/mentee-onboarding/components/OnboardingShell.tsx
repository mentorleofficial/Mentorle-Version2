import { ReactNode } from "react";
import { useBranding } from "@/contexts/BrandingContext";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

interface Props {
  step: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
  onSaveExit?: () => void;
}

const OnboardingShell = ({
  step,
  totalSteps,
  title,
  subtitle,
  children,
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled,
  loading,
  onSaveExit,
}: Props) => {
  const branding = useBranding();
  const pct = Math.round(((step + 1) / totalSteps) * 100);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            {branding.logo_url ? (
              <img src={branding.logo_url} alt="" className="h-8 w-8 rounded-md" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
                {branding.app_name.charAt(0)}
              </div>
            )}
            <span className="font-medium text-sm text-muted-foreground">
              Welcome to {branding.app_name}
            </span>
          </div>
          {onSaveExit && (
            <button
              onClick={onSaveExit}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Save & exit
            </button>
          )}
        </div>
        <div className="mx-auto max-w-3xl px-6 pb-3">
          <div className="flex items-center justify-between mb-1.5 text-xs text-muted-foreground">
            <span>Step {step + 1} of {totalSteps}</span>
            <span>{pct}%</span>
          </div>
          <Progress value={pct} className="h-1.5" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="space-y-2 mb-8">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">{children}</div>

        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={onBack}
            disabled={!onBack || loading}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          <Button onClick={onNext} disabled={nextDisabled || loading} className="gap-1 min-w-[140px]">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <>
                {nextLabel} <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default OnboardingShell;

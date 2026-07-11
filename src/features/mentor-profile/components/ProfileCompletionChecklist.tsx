import { CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { calculateCompleteness, type CompletenessData } from "../utils/completeness";

interface Props {
  profileData: CompletenessData;
}

const ProfileCompletionChecklist = ({ profileData }: Props) => {
  const { percentage, checklist } = calculateCompleteness(profileData);

  if (percentage === 100) return null;

  return (
    <Card className="border-amber-500/20 bg-amber-500/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          Required for 100% Completion
        </CardTitle>
        <CardDescription>
          Complete these steps to unlock availability setting, program joining, booking slots, and active features.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2.5 sm:grid-cols-2 text-sm">
          {checklist.map((item) => {
            // Ignore optional fields for the visual checklist
            if (item.optional) return null;
            return (
              <li
                key={item.key}
                className="flex items-center gap-2.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.check ? (
                  <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
                ) : (
                  <Circle className="h-4.5 w-4.5 text-muted-foreground/40 shrink-0" />
                )}
                <span className={item.check ? "line-through opacity-70 text-foreground/75" : "font-medium text-foreground/90"}>
                  {item.label}
                  {item.key === "has_offerings" && !item.check && (
                    <Link
                      to="/mentor/offerings"
                      className="ml-1.5 text-primary hover:underline font-bold text-xs inline-flex items-center gap-0.5"
                    >
                      (Manage Offerings)
                    </Link>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
};


export default ProfileCompletionChecklist;

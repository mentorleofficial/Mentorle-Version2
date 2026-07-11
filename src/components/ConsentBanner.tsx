import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentPolicy, useMyLatestConsent, useAcceptPolicy } from "@/features/privacy/api";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const ConsentBanner = () => {
  const { user } = useAuth();
  const { data: policy } = useCurrentPolicy();
  const { data: consent } = useMyLatestConsent(user?.id);
  const accept = useAcceptPolicy();

  if (!user || !policy) return null;
  const needsAccept = !consent || consent.withdrawn_at || consent.policy_version !== policy.version;
  if (!needsAccept) return null;

  const onAccept = async () => {
    await accept.mutateAsync({ userId: user.id, version: policy.version });
    toast({ title: "Thanks!", description: "Privacy policy accepted." });
  };

  const isUpdate = !!consent && consent.policy_version !== policy.version;

  return (
    <div className="border-b bg-amber-50 dark:bg-amber-950/30">
      <div className="flex flex-wrap items-center gap-3 px-6 py-3 text-sm">
        <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
        <div className="flex-1 min-w-[200px]">
          <span className="font-medium">
            {isUpdate
              ? `Our privacy policy was updated (v${policy.version}).`
              : "Please review our privacy policy."}
          </span>{" "}
          <span className="text-muted-foreground">{policy.summary}</span>{" "}
          <Link to="/privacy-policy" className="underline font-semibold">
            Read full policy
          </Link>
        </div>
        <Link to="/account/privacy" className="text-xs underline text-muted-foreground">
          Manage
        </Link>
        <Button size="sm" onClick={onAccept} disabled={accept.isPending}>
          {accept.isPending ? "Saving…" : "Accept"}
        </Button>
      </div>
    </div>
  );
};

export default ConsentBanner;

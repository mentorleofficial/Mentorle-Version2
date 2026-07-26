import { useEffect, useState } from "react";
import { format } from "date-fns";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  useActivePlans,
  useMyMembership,
  useCreateSubscription,
  useCancelSubscription,
  useUpgradeToYearly,
  usePlusQuota,
} from "@/features/plus/usePlus";
import { getCashfree } from "@/features/payments/cashfree";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Check, Sparkles, Loader2 } from "lucide-react";

const GoPlus = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: plans = [], isLoading } = useActivePlans();
  const [activating, setActivating] = useState(false);
  const { data: membership } = useMyMembership(user?.id, activating);
  const { data: quota } = usePlusQuota(!!user);
  const subscribe = useCreateSubscription();
  const upgrade = useUpgradeToYearly();
  const cancel = useCancelSubscription();
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);

  const isMember = membership?.status === "active" || membership?.status === "past_due";
  const isActive = membership?.status === "active";
  const planInterval = membership?.plan?.interval;
  const isMonthlyMember = isMember && planInterval === "month";
  const yearlyPlan = plans.find((p) => p.interval === "year");
  const memberBenefits =
    membership?.plan?.benefits?.length
      ? membership.plan.benefits
      : yearlyPlan?.benefits ?? plans[0]?.benefits ?? [];

  useEffect(() => {
    if (activating && membership?.status === "active") {
      setActivating(false);
      toast({ title: "You're on Plus! 🎉", description: "Your membership is now active." });
    }
  }, [activating, membership?.status, toast]);

  const startCheckout = async (
    planId: string,
    start: (args: { planId: string }) => Promise<{ subscription_session_id: string; cashfree_mode: "sandbox" | "production" }>,
  ) => {
    setPendingPlanId(planId);
    try {
      const res = await start({ planId });
      const cashfree = await getCashfree(res.cashfree_mode);
      if (!cashfree?.subscriptionsCheckout) {
        toast({ variant: "destructive", title: "Payment unavailable", description: "Please try again shortly." });
        return;
      }
      const result = await cashfree.subscriptionsCheckout({
        subsSessionId: res.subscription_session_id,
        redirectTarget: "_self",
      });
      if (result?.error) {
        toast({
          variant: "destructive",
          title: "Mandate not completed",
          description: result.error.message ?? "Please try again.",
        });
        return;
      }
      setActivating(true);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Couldn't start subscription",
        description: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setPendingPlanId(null);
    }
  };

  const handleSubscribe = (planId: string) => startCheckout(planId, (a) => subscribe.mutateAsync(a));
  const handleUpgrade = (planId: string) => startCheckout(planId, (a) => upgrade.mutateAsync(a));

  const doCancel = async (atPeriodEnd: boolean) => {
    try {
      await cancel.mutateAsync({ atPeriodEnd });
      toast({
        title: atPeriodEnd ? "Cancelled — won't renew" : "Membership ended",
        description: atPeriodEnd
          ? "You'll keep Plus until your renewal date."
          : "Your Plus benefits have ended.",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Couldn't cancel",
        description: e instanceof Error ? e.message : "Please try again.",
      });
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-2 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Mentorle Plus
          </div>
          {isMember ? (
            <>
              <h1 className="text-3xl font-semibold tracking-tight">You're on Mentorle Plus</h1>
              <p className="text-muted-foreground">
                Enjoy your benefits — free sessions, discounts, and more.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-semibold tracking-tight">Unlock more with Plus</h1>
              <p className="text-muted-foreground">
                2 free expert sessions every month, better discounts, premium resources, and more.
              </p>
            </>
          )}
        </div>

        {membership && (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="flex items-center gap-2 font-medium">
                  Your membership
                  <Badge variant={isActive ? "default" : "secondary"} className="capitalize">
                    {membership.status}
                  </Badge>
                  {membership.plan?.interval && (
                    <Badge variant="outline" className="capitalize text-xs">
                      {membership.plan.interval === "year" ? "Yearly" : "Monthly"}
                    </Badge>
                  )}
                </p>
                {membership.current_period_end && (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {isActive && !membership.cancel_at_period_end ? "Renews" : "Ends"} on{" "}
                    {format(new Date(membership.current_period_end), "d MMM yyyy")}
                  </p>
                )}
                {quota?.has_membership && (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {quota.quota_remaining} of {quota.quota_total}
                    </span>{" "}
                    free sessions left this month
                  </p>
                )}
              </div>
              {membership.cancel_at_period_end ? (
                <Badge variant="outline" className="text-xs">Won't renew</Badge>
              ) : membership.status === "active" || membership.status === "past_due" ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={cancel.isPending}>
                      {cancel.isPending ? "Cancelling…" : "Cancel membership"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel Mentorle Plus?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {membership.current_period_end ? (
                          <>
                            <strong>Cancel at renewal</strong> keeps your Plus benefits until{" "}
                            {format(new Date(membership.current_period_end), "d MMM yyyy")}, then stops — no further
                            charges. <strong>End now</strong> ends Plus immediately.
                          </>
                        ) : (
                          "Choose how to cancel your Plus membership."
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                      <AlertDialogCancel className="mt-0">Keep Plus</AlertDialogCancel>
                      <AlertDialogAction onClick={() => doCancel(true)}>Cancel at renewal</AlertDialogAction>
                      <AlertDialogAction
                        onClick={() => doCancel(false)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        End now
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </CardContent>
          </Card>
        )}

        {(activating || membership?.status === "pending") && (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Activating your membership…
          </p>
        )}

        {isMember ? (
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Plus benefits</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {memberBenefits.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {isMonthlyMember && yearlyPlan && (
              <Card className="border-primary/30">
                <CardHeader>
                  <CardTitle className="text-lg">Upgrade to yearly</CardTitle>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-semibold">₹{yearlyPlan.price}</span>
                    <span className="text-sm text-muted-foreground">/ year</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Switch to yearly billing. Your monthly plan will be cancelled and you'll set up a new yearly mandate.
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <ul className="space-y-2">
                    {yearlyPlan.benefits.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    disabled={pendingPlanId === yearlyPlan.id}
                    onClick={() => handleUpgrade(yearlyPlan.id)}
                  >
                    {pendingPlanId === yearlyPlan.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting…
                      </>
                    ) : (
                      "Upgrade to yearly"
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        ) : isLoading ? (
          <p className="py-8 text-center text-muted-foreground">Loading plans…</p>
        ) : plans.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">No plans are available right now.</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {plans.map((plan) => (
              <Card key={plan.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-semibold">₹{plan.price}</span>
                    <span className="text-sm text-muted-foreground">/ {plan.interval}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <ul className="flex-1 space-y-2">
                    {plan.benefits.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    disabled={pendingPlanId === plan.id}
                    onClick={() => handleSubscribe(plan.id)}
                  >
                    {pendingPlanId === plan.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting…
                      </>
                    ) : (
                      `Subscribe ${plan.interval === "year" ? "yearly" : "monthly"}`
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default GoPlus;

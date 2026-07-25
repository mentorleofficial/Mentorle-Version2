import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";
import { getCashfree, openHostedCheckout, type CashfreeMode } from "./cashfree";

interface CashfreeCheckoutProps {
  paymentSessionId: string;
  mode: CashfreeMode;
  amountLabel: string;
  onPaid: () => void;
  onError: (message: string) => void;
}

// Cashfree Drop-in: opens Cashfree's hosted widget (all methods enabled on the account —
// card, UPI, net banking, wallets) in a modal over the page. The webhook stays the source
// of truth; onPaid only starts our confirmation poll.
export default function CashfreeCheckout({
  paymentSessionId,
  mode,
  amountLabel,
  onPaid,
  onError,
}: CashfreeCheckoutProps) {
  const [launching, setLaunching] = useState(false);
  const started = useRef(false);

  const launch = async () => {
    setLaunching(true);
    try {
      const cashfree = await getCashfree(mode);
      if (!cashfree?.checkout) {
        onError("Payment is unavailable right now.");
        return;
      }
      const result = await cashfree.checkout({ paymentSessionId, redirectTarget: "_modal" });
      if (result?.error) {
        onError(result.error.message ?? "Payment was not completed.");
        return;
      }
      onPaid();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setLaunching(false);
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void launch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        Secured by Cashfree
        {mode === "sandbox" && (
          <span className="ml-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
            Test mode
          </span>
        )}
      </div>

      <Button className="w-full" onClick={() => void launch()} disabled={launching}>
        {launching ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening secure checkout…
          </>
        ) : (
          `Pay ${amountLabel}`
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        A secure Cashfree window opens to pay by card, UPI, net banking, or wallet.
      </p>

      <p className="text-center text-xs text-muted-foreground">
        Bank page blocked by your browser?{" "}
        <button
          type="button"
          onClick={() => void openHostedCheckout(mode, paymentSessionId)}
          className="underline underline-offset-2 hover:text-foreground"
        >
          Open the payment page instead
        </button>
      </p>
    </div>
  );
}

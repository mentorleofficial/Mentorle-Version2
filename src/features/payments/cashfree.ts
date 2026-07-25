import { load } from "@cashfreepayments/cashfree-js";

export type CashfreeMode = "sandbox" | "production";

export type BrowsingContext = "_self" | "_blank" | "_parent" | "_top";

export interface CashfreeComponent {
  mount: (selectorOrEl: string | HTMLElement) => void;
  unmount?: () => void;
  on?: (event: string, handler: (data: unknown) => void) => void;
}

export interface CashfreePayResult {
  error?: { message?: string };
  paymentDetails?: { paymentMessage?: string };
  redirect?: boolean;
}

export interface CashfreeInstance {
  create: (component: string, options?: Record<string, unknown>) => CashfreeComponent;
  pay: (options: {
    paymentMethod?: CashfreeComponent;
    paymentSessionId: string;
    returnUrl?: string;
  }) => Promise<CashfreePayResult>;
  checkout?: (options: {
    paymentSessionId: string;
    redirectTarget?: BrowsingContext | "_modal" | HTMLElement;
  }) => Promise<{
    error?: { message?: string };
    paymentDetails?: { paymentMessage?: string };
    redirect?: boolean;
  }>;
  // Redirect-only: no "_modal" and no HTMLElement, and it resolves { redirect: true } as soon
  // as the form is submitted — never with a payment result. Completion arrives via return_url.
  subscriptionsCheckout?: (options: {
    subsSessionId: string;
    redirectTarget?: BrowsingContext;
  }) => Promise<{
    error?: { message?: string };
    subscriptionDetails?: unknown;
    redirect?: boolean;
  }>;
}

const cache: Partial<Record<CashfreeMode, Promise<CashfreeInstance | null>>> = {};

export function getCashfree(mode: CashfreeMode): Promise<CashfreeInstance | null> {
  if (!cache[mode]) {
    cache[mode] = load({ mode }).then((cf) => (cf as CashfreeInstance | null) ?? null);
  }
  return cache[mode]!;
}

// Popup-blocker escape hatch. Banks refuse to be framed, so from inside the modal Cashfree opens
// the 3DS/UPI step in a popup; when that is blocked it renders a dead "Go to payment page" link
// we cannot reach (cross-origin iframe). This sends the top-level window to the same hosted
// checkout with the same session, which needs no popup at all.
export async function openHostedCheckout(mode: CashfreeMode, paymentSessionId: string): Promise<void> {
  const cashfree = await getCashfree(mode);
  await cashfree?.checkout?.({ paymentSessionId, redirectTarget: "_self" });
}

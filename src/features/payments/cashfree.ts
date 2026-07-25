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

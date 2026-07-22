import { load } from "@cashfreepayments/cashfree-js";

export type CashfreeMode = "sandbox" | "production";

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
  checkout?: (options: { paymentSessionId: string; redirectTarget?: string }) => Promise<{
    error?: { message?: string };
    paymentDetails?: { paymentMessage?: string };
    redirect?: boolean;
  }>;
  subscriptionsCheckout?: (options: { subsSessionId: string; redirectTarget?: string }) => Promise<{
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

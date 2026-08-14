import { describe, it, expect, beforeAll } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React, { useState } from "react";
import {
  StickyActionBarProvider,
  useStickyActionBar,
  useStickyActionBarHeight,
} from "@/contexts/StickyActionBarContext";

const BAR_HEIGHT = 64;

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get() {
      return this.dataset.testid === "bar" ? BAR_HEIGHT : 0;
    },
  });
});

const FloatingButton = () => {
  const height = useStickyActionBarHeight();
  return <button data-testid="fab" style={{ bottom: height + 24 }} />;
};

// Mirrors AppLayout: owns the floating button, receives the page as children.
const Layout = ({ children }: { children: React.ReactNode }) => (
  <div>
    {children}
    <FloatingButton />
  </div>
);

// Mirrors a profile page: calls the hook in its own body, renders the bar
// inside the layout. The provider must sit ABOVE this component for the
// registration to reach the floating button.
const ProfilePage = ({ showBar = true }: { showBar?: boolean }) => {
  const registerBar = useStickyActionBar();
  return <Layout>{showBar && <div data-testid="bar" ref={registerBar} />}</Layout>;
};

const TogglingPage = () => {
  const registerBar = useStickyActionBar();
  const [dirty, setDirty] = useState(true);
  return (
    <Layout>
      {dirty && <div data-testid="bar" ref={registerBar} />}
      <button data-testid="clean" onClick={() => setDirty(false)} />
    </Layout>
  );
};

describe("StickyActionBar", () => {
  it("lifts the floating button above a registered bar", () => {
    render(
      <StickyActionBarProvider>
        <ProfilePage />
      </StickyActionBarProvider>
    );
    expect(screen.getByTestId("fab").style.bottom).toBe(`${BAR_HEIGHT + 24}px`);
  });

  it("keeps the default offset when no bar is registered", () => {
    render(
      <StickyActionBarProvider>
        <ProfilePage showBar={false} />
      </StickyActionBarProvider>
    );
    expect(screen.getByTestId("fab").style.bottom).toBe("24px");
  });

  it("restores the default offset when the bar unmounts", () => {
    render(
      <StickyActionBarProvider>
        <TogglingPage />
      </StickyActionBarProvider>
    );
    expect(screen.getByTestId("fab").style.bottom).toBe(`${BAR_HEIGHT + 24}px`);

    act(() => {
      screen.getByTestId("clean").click();
    });

    expect(screen.getByTestId("fab").style.bottom).toBe("24px");
  });

  it("does not register when the provider sits below the page in the tree", () => {
    const BadLayout = ({ children }: { children: React.ReactNode }) => (
      <StickyActionBarProvider>
        {children}
        <FloatingButton />
      </StickyActionBarProvider>
    );
    const BadPage = () => {
      const registerBar = useStickyActionBar();
      return <BadLayout>{<div data-testid="bar" ref={registerBar} />}</BadLayout>;
    };

    render(<BadPage />);

    expect(screen.getByTestId("fab").style.bottom).toBe("24px");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import MenteeProfile from "@/pages/MenteeProfile";
import { upsertMenteeProfile } from "@/features/mentee-onboarding/api";

const mockToast = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/components/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "mentee-1", email: "mentee@example.com" },
    profile: { id: "mentee-1", full_name: "Ritik Sharma", email: "mentee@example.com" },
    refreshProfile: vi.fn(),
  }),
}));

vi.mock("@/contexts/BrandingContext", () => ({
  useBranding: () => ({ app_name: "Mentorship Platform" }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) },
}));

vi.mock("@/features/mentee-onboarding/hooks/useMenteeProfileStatus", () => ({
  useMenteeProfile: () => ({
    data: { id: "mentee-1", full_name: "Ritik Sharma", headline: "Aspiring PM" },
    isLoading: false,
  }),
  useInvalidateMenteeProfile: () => vi.fn(),
}));

vi.mock("@/features/mentee-onboarding/api", () => ({
  upsertMenteeProfile: vi.fn(async () => ({})),
  uploadMenteeAvatar: vi.fn(),
  uploadMenteeResume: vi.fn(),
}));

const nameInput = () => screen.getByLabelText(/full name/i);
const saveButton = () => screen.getByRole("button", { name: /save changes/i });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MenteeProfile name validation", () => {
  it("blocks saving when the name is cleared", async () => {
    render(<MenteeProfile />);

    fireEvent.change(nameInput(), { target: { value: "" } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(screen.getByText("Name is required")).toBeInTheDocument());
    expect(upsertMenteeProfile).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive", title: "Name is required" })
    );
  });

  it("treats a whitespace-only name as missing", async () => {
    render(<MenteeProfile />);

    fireEvent.change(nameInput(), { target: { value: "   " } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(screen.getByText("Name is required")).toBeInTheDocument());
    expect(upsertMenteeProfile).not.toHaveBeenCalled();
  });

  it("marks the field invalid for assistive tech", async () => {
    render(<MenteeProfile />);

    fireEvent.change(nameInput(), { target: { value: "" } });
    fireEvent.blur(nameInput());

    await waitFor(() => expect(nameInput()).toHaveAttribute("aria-invalid", "true"));
  });

  it("clears the error once a name is typed again", async () => {
    render(<MenteeProfile />);

    fireEvent.change(nameInput(), { target: { value: "" } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(screen.getByText("Name is required")).toBeInTheDocument());

    fireEvent.change(nameInput(), { target: { value: "Ritik" } });

    await waitFor(() => expect(screen.queryByText("Name is required")).not.toBeInTheDocument());
  });

  it("saves when a name is present", async () => {
    render(<MenteeProfile />);

    fireEvent.change(nameInput(), { target: { value: "Ritik Sharma Jr" } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(upsertMenteeProfile).toHaveBeenCalled());
    expect(screen.queryByText("Name is required")).not.toBeInTheDocument();
    const [, payload] = vi.mocked(upsertMenteeProfile).mock.calls[0];
    expect(payload).toEqual(expect.objectContaining({ full_name: "Ritik Sharma Jr" }));
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import SessionFeedback from "@/pages/SessionFeedback";
import { supabase } from "@/integrations/supabase/client";

// Mock Navigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ id: "test-session-id" }),
    useNavigate: () => mockNavigate,
  };
});

// Mock Auth
const testUser = { id: "test-mentee-id", email: "mentee@example.com" };
const testProfile = { id: "test-mentee-id", role: "mentee", full_name: "Test Mentee" };

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: testUser,
    profile: testProfile,
    role: "mentee",
  }),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

// Mock AppLayout to prevent rendering sidebar queries
vi.mock("@/components/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => {
  const mockMaybeSingle = vi.fn();
  const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
  const mockInsert = vi.fn();

  const mockFrom = vi.fn().mockImplementation((table) => {
    if (table === "sessions") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: "test-session-id",
                scheduled_at: "2026-06-16T12:00:00Z",
                mentor_id: "test-mentor-id",
                mentee_id: "test-mentee-id",
                mentor: { full_name: "Test Mentor" },
                mentee: { full_name: "Test Mentee" },
              },
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === "feedback") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        }),
        insert: mockInsert,
      };
    }
    return { select: mockSelect, insert: mockInsert };
  });

  return {
    supabase: {
      from: mockFrom,
    },
  };
});

describe("SessionFeedback - Mentee survey flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render step 1 and allow progressing through all 5 survey steps", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "sessions") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => {
                return {
                  data: {
                    id: "test-session-id",
                    scheduled_at: "2026-06-16T12:00:00Z",
                    mentor_id: "test-mentor-id",
                    mentee_id: "test-mentee-id",
                    mentor: { full_name: "Test Mentor" },
                    mentee: { full_name: "Test Mentee" },
                  },
                  error: null,
                };
              },
            }),
          }),
        } as any;
      }
      if (table === "feedback") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => {
                    return { data: null, error: null };
                  },
                }),
              }),
            }),
          }),
          insert: mockInsert,
        } as any;
      }
      return {} as any;
    });

    const { container } = render(
      <MemoryRouter>
        <SessionFeedback />
      </MemoryRouter>
    );

    // Wait for the loader to finish and component to load
    await waitFor(() => {
      expect(screen.getByText("Expectation Fulfillment")).toBeInTheDocument();
    });

    // Check Question 1 question text
    expect(screen.getByText("Did the mentorship program help you achieve what you expected?")).toBeInTheDocument();

    // Verify option button
    const fullyAchievedBtn = screen.getByText("Fully achieved");
    expect(fullyAchievedBtn).toBeInTheDocument();

    // The Next button should be disabled initially on step 1
    const nextBtn = screen.getByText("Next");
    expect(nextBtn).toBeDisabled();

    // Click "Fully achieved" (maps to 5 stars)
    fireEvent.click(fullyAchievedBtn);
    expect(nextBtn).not.toBeDisabled();

    // Advance to step 2: Guidance Quality
    fireEvent.click(nextBtn);
    await waitFor(() => {
      expect(screen.getByText("Guidance Quality")).toBeInTheDocument();
    });

    // Rating stars are rendered as buttons (there are 5 stars)
    const starButtons = screen.getAllByRole("button").filter(b => b.querySelector("svg"));
    // Click on the 4th star (index 3)
    fireEvent.click(starButtons[3]);

    // Go to step 3: Engagement
    const nextBtn2 = screen.getByText("Next");
    fireEvent.click(nextBtn2);
    await waitFor(() => {
      expect(screen.getByText("Engagement")).toBeInTheDocument();
    });

    // Click on the 5th star (index 4)
    const starButtonsStep3 = screen.getAllByRole("button").filter(b => b.querySelector("svg"));
    fireEvent.click(starButtonsStep3[4]);

    // Go to step 4: Practical Insights
    const nextBtn3 = screen.getByText("Next");
    fireEvent.click(nextBtn3);
    await waitFor(() => {
      expect(screen.getByText("Practical Insights")).toBeInTheDocument();
    });

    // Click on the 3rd star (index 2)
    const starButtonsStep4 = screen.getAllByRole("button").filter(b => b.querySelector("svg"));
    fireEvent.click(starButtonsStep4[2]);

    // Go to step 5: Overall Value
    const nextBtn4 = screen.getByText("Next");
    fireEvent.click(nextBtn4);
    await waitFor(() => {
      expect(screen.getByText("Overall Value")).toBeInTheDocument();
    });

    // Click on the 5th star (index 4)
    const starButtonsStep5 = screen.getAllByRole("button").filter(b => b.querySelector("svg"));
    fireEvent.click(starButtonsStep5[4]);

    // Go to step 6: Final Review
    const nextBtn5 = screen.getByText("Next");
    fireEvent.click(nextBtn5);
    await waitFor(() => {
      expect(screen.getByText("Final Review")).toBeInTheDocument();
    });

    // We gave:
    // expectation: 5 (Fully achieved)
    // guidance: 4
    // engagement: 5
    // insights: 3
    // value: 5
    // Sum = 22, Average = 22 / 5 = 4.4. Rounded average should be 4.
    // Displayed average should be 4.4 / 5.0
    expect(screen.getByText("4.4 / 5.0")).toBeInTheDocument();

    // Type comment
    const commentArea = screen.getByPlaceholderText(/Share your experience/i);
    fireEvent.change(commentArea, { target: { value: "A wonderful session!" } });

    // Submit survey
    const submitBtn = screen.getByText("Submit");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    // Verify insert payload
    const payload = mockInsert.mock.calls[0][0];
    expect(payload).toHaveLength(1);
    expect(payload[0].rating).toBe(4); // rounded average of 4.4 is 4
    expect(payload[0].comment).toContain("A wonderful session!");
    expect(payload[0].comment).toContain("Did the mentorship program help you achieve what you expected?: Fully achieved");
    expect(payload[0].comment).toContain("Guidance quality: 4 / 5 stars");
    expect(payload[0].comment).toContain("Engagement: 5 / 5 stars");
    expect(payload[0].comment).toContain("Practical insights: 3 / 5 stars");
    expect(payload[0].comment).toContain("Overall mentorship value: 5 / 5 stars");
    expect(payload[0].audience).toBe("mentor");
  });
});

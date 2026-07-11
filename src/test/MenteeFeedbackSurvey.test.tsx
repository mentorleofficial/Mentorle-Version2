import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import MenteeFeedbackSurvey from "@/components/feedback/MenteeFeedbackSurvey";
import { supabase } from "@/integrations/supabase/client";

// Mock toast
const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

describe("MenteeFeedbackSurvey Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should go through all steps and submit correctly", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "feedback") {
        return {
          insert: mockInsert,
        } as any;
      }
      return {} as any;
    });

    const mockOnComplete = vi.fn();

    render(
      <MenteeFeedbackSurvey
        sessionId="test-session-id"
        userId="test-user-id"
        onComplete={mockOnComplete}
      />
    );

    // Step 1: Expectation Fulfillment
    expect(screen.getByText("Expectation Fulfillment")).toBeInTheDocument();
    const mostlyBtn = screen.getByText("Mostly achieved");
    fireEvent.click(mostlyBtn);
    fireEvent.click(screen.getByText("Next"));

    // Step 2: Guidance Quality
    await waitFor(() => {
      expect(screen.getByText("Guidance Quality")).toBeInTheDocument();
    });
    const starButtons2 = screen.getAllByRole("button").filter(b => b.querySelector("svg"));
    fireEvent.click(starButtons2[4]); // 5 stars
    fireEvent.click(screen.getByText("Next"));

    // Step 3: Engagement
    await waitFor(() => {
      expect(screen.getByText("Engagement")).toBeInTheDocument();
    });
    const starButtons3 = screen.getAllByRole("button").filter(b => b.querySelector("svg"));
    fireEvent.click(starButtons3[3]); // 4 stars
    fireEvent.click(screen.getByText("Next"));

    // Step 4: Practical Insights
    await waitFor(() => {
      expect(screen.getByText("Practical Insights")).toBeInTheDocument();
    });
    const starButtons4 = screen.getAllByRole("button").filter(b => b.querySelector("svg"));
    fireEvent.click(starButtons4[2]); // 3 stars
    fireEvent.click(screen.getByText("Next"));

    // Step 5: Overall Value
    await waitFor(() => {
      expect(screen.getByText("Overall Value")).toBeInTheDocument();
    });
    const starButtons5 = screen.getAllByRole("button").filter(b => b.querySelector("svg"));
    fireEvent.click(starButtons5[4]); // 5 stars
    fireEvent.click(screen.getByText("Next"));

    // Final Review Step
    await waitFor(() => {
      expect(screen.getByText("Final Review")).toBeInTheDocument();
    });

    // Score calculations:
    // expectation: 4 (Mostly achieved)
    // guidance: 5
    // engagement: 4
    // insights: 3
    // value: 5
    // Sum = 21, Avg = 21 / 5 = 4.2. Displayed: 4.2 / 5.0
    expect(screen.getByText("4.2 / 5.0")).toBeInTheDocument();

    const commentInput = screen.getByPlaceholderText(/Share your experience/i);
    fireEvent.change(commentInput, { target: { value: "Nice session!" } });

    // Submit
    fireEvent.click(screen.getByText("Submit"));

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    const payload = mockInsert.mock.calls[0][0];
    expect(payload).toHaveLength(1);
    expect(payload[0].rating).toBe(4); // rounded average of 4.2 is 4
    expect(payload[0].comment).toContain("Nice session!");
    expect(payload[0].comment).toContain("Did the mentorship program help you achieve what you expected?: Mostly achieved");
    expect(payload[0].comment).toContain("Guidance quality: 5 / 5 stars");
    expect(payload[0].comment).toContain("Engagement: 4 / 5 stars");
    expect(payload[0].comment).toContain("Practical insights: 3 / 5 stars");
    expect(payload[0].comment).toContain("Overall mentorship value: 5 / 5 stars");
    expect(payload[0].session_id).toBe("test-session-id");
    expect(payload[0].submitted_by).toBe("test-user-id");

    expect(mockOnComplete).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// Mock Auth
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    profile: { id: "test-mentor-id", role: "mentor", full_name: "Test Mentor" },
  }),
}));

// Mock AppLayout
vi.mock("@/components/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));

// Mock Dialog to render inline and bypass portals
vi.mock("@/components/ui/dialog", () => {
  return {
    Dialog: ({ children, open }: any) => {
      console.log("Mock Dialog rendered. Open prop is:", open);
      return open ? React.createElement("div", { "data-testid": "mock-dialog" }, children) : null;
    },
    DialogContent: ({ children }: any) => {
      console.log("Mock DialogContent rendered.");
      return React.createElement("div", { "data-testid": "dialog-content" }, children);
    },
    DialogHeader: ({ children }: any) => React.createElement("div", null, children),
    DialogTitle: ({ children }: any) => React.createElement("h2", null, children),
    DialogDescription: ({ children }: any) => React.createElement("p", null, children),
    DialogFooter: ({ children }: any) => React.createElement("div", null, children),
  };
});

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

import FeedbackInbox from "@/pages/FeedbackInbox";
import { supabase } from "@/integrations/supabase/client";

describe("FeedbackInbox Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should parse feedback comment, hide survey text from inbox, and show View Survey details popup on click", async () => {
    const mockFeedbackData = [
      {
        id: "fb-1",
        rating: 4,
        comment: "Nice session!\n\n---\nSurvey Responses:\nDid the mentorship program help you achieve what you expected?: Mostly achieved\nGuidance quality: 5 / 5 stars\nEngagement: 4 / 5 stars\nPractical insights: 3 / 5 stars\nOverall mentorship value: 5 / 5 stars",
        audience: "mentor",
        created_at: "2026-06-16T12:00:00Z",
        response: null,
        responded_at: null,
        session: {
          id: "session-1",
          scheduled_at: "2026-06-16T12:00:00Z",
          title: "Session Title",
          mentor_id: "test-mentor-id",
          mentee_id: "test-mentee-id",
        },
        submitter: {
          id: "mentee-1",
          full_name: "John Doe",
          avatar_url: null,
        },
      },
    ];

    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "feedback") {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
                data: mockFeedbackData,
                error: null,
              }),
            }),
          }),
        } as any;
      }
      return {} as any;
    });

    render(<FeedbackInbox />);

    // Wait for data load
    await waitFor(() => {
      expect(screen.getByText("Feedback Inbox")).toBeInTheDocument();
    });

    // Check that we see the submitter name
    expect(screen.getByText("John Doe")).toBeInTheDocument();

    // Check that the parsed text comment is visible
    expect(screen.getByText("Nice session!")).toBeInTheDocument();

    // Check that the raw survey responses string is NOT visible inline in the card
    expect(screen.queryByText(/Did the mentorship program help/)).not.toBeInTheDocument();

    // Verify "View Survey" action button is rendered
    const viewSurveyBtn = screen.getByText("View Survey");
    expect(viewSurveyBtn).toBeInTheDocument();

    // Click "View Survey" button to open Dialog
    fireEvent.click(viewSurveyBtn);

    // Verify the survey questions and answers are displayed in the dialog popup
    await waitFor(() => {
      expect(screen.getByText("Survey Details")).toBeInTheDocument();
      expect(screen.getByText("Did the mentorship program help you achieve what you expected?")).toBeInTheDocument();
      expect(screen.getByText("Mostly achieved")).toBeInTheDocument();
      expect(screen.getByText("Guidance quality")).toBeInTheDocument();
      expect(screen.getAllByText("5 / 5").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Engagement")).toBeInTheDocument();
      expect(screen.getByText("4 / 5")).toBeInTheDocument();
      expect(screen.getByText("Practical insights")).toBeInTheDocument();
      expect(screen.getByText("3 / 5")).toBeInTheDocument();
      expect(screen.getByText("Overall mentorship value")).toBeInTheDocument();
    });

    // Click close button
    fireEvent.click(screen.getByText("Close"));

    // Verify Dialog is closed
    await waitFor(() => {
      expect(screen.queryByText("Survey Details")).not.toBeInTheDocument();
    });
  });
});

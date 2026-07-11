import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import MenteeSessions from "@/pages/MenteeSessions";

// Mock Auth
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "test-mentee-id", email: "mentee@example.com" },
    profile: { id: "test-mentee-id", role: "mentee", full_name: "Test Mentee" },
  }),
}));

// Mock AppLayout
vi.mock("@/components/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}));

// Mock hooks
const mockUseMenteeSessions = vi.fn();
vi.mock("@/features/mentee-sessions/useMenteeSessions", () => ({
  useMenteeSessions: () => mockUseMenteeSessions(),
  useMenteeRatedSessions: () => ({ data: new Set(["session-completed-rated"]) }),
  useMenteeMentorPrograms: () => ({ data: [] }),
  useCancelMenteeSession: () => ({ isPending: false, mutate: vi.fn() }),
}));

vi.mock("@/features/programs/hooks/useMyPrograms", () => ({
  useMyPrograms: () => ({ data: [] }),
}));

vi.mock("@/features/action-items/useActionItems", () => ({
  useMenteeActionItemSessionIds: () => ({ data: new Set() }),
}));

describe("MenteeSessions Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show past sessions and display the mentee's feedback and the mentor's response", async () => {
    const mockSessions = [
      {
        id: "session-completed-rated",
        scheduled_at: "2026-06-15T12:00:00Z",
        duration_minutes: 60,
        status: "completed",
        mentor_id: "test-mentor-id",
        title: "Introduction to React",
        topic: "React Basics",
        mentee_notes: "Want to learn JSX.",
        notes: "Mentee understood components well.",
        meeting_url: "https://meet.google.com/abc-defg-hij",
        cancellation_reason: "",
        cancelled_at: null,
        rescheduled_from_id: null,
        mentor: { full_name: "Super Mentor", avatar_url: null },
        feedback: [
          {
            rating: 5,
            comment: "Amazing session! Thanks for explaining React.\n\n---\nSurvey Responses:\nGuidance quality: 5 / 5 stars",
            audience: "mentor",
            response: "You are welcome! Keep practicing.",
            responded_at: "2026-06-16T10:00:00Z",
          },
        ],
        program_id: null,
        program: null,
      },
    ];

    mockUseMenteeSessions.mockReturnValue({
      data: mockSessions,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <MenteeSessions />
      </MemoryRouter>
    );

    // Switch to Past tab
    const pastTab = screen.getByRole("tab", { name: /Past/i });
    pastTab.focus();
    fireEvent.click(pastTab);

    // Verify past session details are rendered
    const titleEl = await screen.findByText("Introduction to React");
    expect(titleEl).toBeInTheDocument();
    expect(screen.getByText(/Super Mentor/)).toBeInTheDocument();

    // Click "Details" button to expand card
    const detailsBtn = screen.getByRole("button", { name: /Details/i });
    fireEvent.click(detailsBtn);

    // Verify Cleaned comment is shown
    await waitFor(() => {
      expect(screen.getByText('"Amazing session! Thanks for explaining React."')).toBeInTheDocument();
      expect(screen.getByText("(5/5)")).toBeInTheDocument();
      expect(screen.getByText("Mentor's response")).toBeInTheDocument();
      expect(screen.getByText("You are welcome! Keep practicing.")).toBeInTheDocument();
    });
  });
});

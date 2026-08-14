import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import AdminPrograms from "@/pages/AdminPrograms";
import { supabase } from "@/integrations/supabase/client";

const insertMock = vi.fn(async (_payload: Record<string, unknown>) => ({ error: null }));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

vi.mock("@/components/AppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "admin-1" } }),
}));

vi.mock("react-router-dom", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: () => ({ order: async () => ({ data: [] }) }),
      insert: (payload: Record<string, unknown>) => insertMock(payload),
    })),
    rpc: async () => ({ data: [] }),
  },
}));

const openDialog = async () => {
  fireEvent.click(screen.getByRole("button", { name: /new program/i }));
  await screen.findByLabelText(/^name/i);
};

const fill = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const submit = () => fireEvent.click(screen.getByRole("button", { name: /^create$/i }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AdminPrograms create validation", () => {
  it("blocks creation and explains why when the name is punctuation only", async () => {
    render(<AdminPrograms />);
    await openDialog();

    fill(/^name/i, ",");
    submit();

    await waitFor(() =>
      expect(
        screen.getByText("Program name must start with a letter or number")
      ).toBeInTheDocument()
    );
    expect(insertMock).not.toHaveBeenCalled();
  });

  it.each(['Spring "2026" Cohort', "Cohort #1", "Full-Stack Track", "C++ Bootcamp"])(
    "creates the program when the name contains special characters: %j",
    async (name) => {
      render(<AdminPrograms />);
      await openDialog();

      fill(/^name/i, name);
      submit();

      await waitFor(() => expect(insertMock).toHaveBeenCalled());
      expect(insertMock.mock.calls[0][0]).toEqual(expect.objectContaining({ name }));
    }
  );

  it("blocks creation for a numeric-only name", async () => {
    render(<AdminPrograms />);
    await openDialog();

    fill(/^name/i, "1");
    submit();

    await waitFor(() => expect(screen.getByText(/at least 2 characters/i)).toBeInTheDocument());
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("blocks creation for a multi-digit numeric name", async () => {
    render(<AdminPrograms />);
    await openDialog();

    fill(/^name/i, "2026");
    submit();

    await waitFor(() =>
      expect(screen.getByText("Program name must include at least two letters")).toBeInTheDocument()
    );
    expect(insertMock).not.toHaveBeenCalled();
  });

  it.each([",a", "1a", "!!a", ",Spring"])(
    "blocks creation for junk name %j",
    async (name) => {
      render(<AdminPrograms />);
      await openDialog();

      fill(/^name/i, name);
      submit();

      await waitFor(() =>
        expect(screen.getByText(/Program name (must|can only)/i)).toBeInTheDocument()
      );
      expect(insertMock).not.toHaveBeenCalled();
    }
  );

  it.each(["0", "-1"])("blocks creation for capacity %j", async (capacity) => {
    render(<AdminPrograms />);
    await openDialog();

    fill(/^name/i, "Spring Cohort");
    fill(/capacity/i, capacity);
    submit();

    await waitFor(() =>
      expect(screen.getByText("Capacity must be at least 1")).toBeInTheDocument()
    );
    expect(insertMock).not.toHaveBeenCalled();
  });

  it.each(["abc", "twenty", "1e5"])(
    "blocks creation when %j is pasted into capacity",
    async (capacity) => {
      render(<AdminPrograms />);
      await openDialog();

      fill(/^name/i, "Spring Cohort");
      fill(/capacity/i, capacity);
      submit();

      await waitFor(() =>
        expect(screen.getByText("Capacity must be a whole number")).toBeInTheDocument()
      );
      expect(insertMock).not.toHaveBeenCalled();
    }
  );

  it("keeps pasted capacity text in the field so it can be validated", async () => {
    render(<AdminPrograms />);
    await openDialog();

    fill(/capacity/i, "abc");

    expect(screen.getByLabelText(/capacity/i)).toHaveValue("abc");
  });

  it("blocks creation when the end date precedes the start date", async () => {
    render(<AdminPrograms />);
    await openDialog();

    fill(/^name/i, "Spring Cohort");
    fill(/starts on/i, "2026-03-01");
    fill(/ends on/i, "2026-02-01");
    submit();

    await waitFor(() =>
      expect(screen.getByText("End date must be after the start date")).toBeInTheDocument()
    );
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("clears the error once the field is corrected", async () => {
    render(<AdminPrograms />);
    await openDialog();

    fill(/^name/i, "1");
    submit();
    await waitFor(() => expect(screen.getByText(/at least 2 characters/i)).toBeInTheDocument());

    fill(/^name/i, "Spring Cohort");

    await waitFor(() =>
      expect(screen.queryByText(/at least 2 characters/i)).not.toBeInTheDocument()
    );
  });

  it("creates the program when every field is valid", async () => {
    render(<AdminPrograms />);
    await openDialog();

    fill(/^name/i, "Spring 2026 Cohort");
    fill(/capacity/i, "25");
    fill(/starts on/i, "2026-03-01");
    fill(/ends on/i, "2026-06-01");
    submit();

    await waitFor(() => expect(insertMock).toHaveBeenCalled());
    expect(insertMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        name: "Spring 2026 Cohort",
        capacity: 25,
        starts_on: "2026-03-01",
        ends_on: "2026-06-01",
      })
    );
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useMentorMentees,
  selectMenteeProgramMap,
  type MentorMenteeRow,
} from "@/features/mentor-mentees/useMentorMentees";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

const MENTOR = "mentor-1";
const BOOKER = "mentee-booked";
const ENROLLED = "mentee-enrolled";

type Row = Record<string, unknown>;

let tables: Record<string, Row[]>;

const makeChain = (rows: Row[]) => {
  const ops: { op: string; col: string; val: unknown }[] = [];
  const chain: Record<string, unknown> = {};
  for (const op of ["select", "order", "limit"]) {
    chain[op] = () => chain;
  }
  for (const op of ["eq", "neq", "in"]) {
    chain[op] = (col: string, val: unknown) => {
      ops.push({ op, col, val });
      return chain;
    };
  }
  chain.then = (resolve: (r: { data: Row[]; error: null }) => unknown) => {
    const data = rows.filter((r) =>
      ops.every(({ op, col, val }) => {
        if (op === "eq") return r[col] === val;
        if (op === "neq") return r[col] !== val;
        return (val as unknown[]).includes(r[col]);
      })
    );
    return Promise.resolve(resolve({ data, error: null }));
  };
  return chain;
};

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

const renderMentees = async () => {
  const { result } = renderHook(() => useMentorMentees(MENTOR), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  return result.current.data as MentorMenteeRow[];
};

beforeEach(() => {
  tables = {
    program_mentors: [],
    programs: [],
    program_mentees: [],
    mentor_mentee_assignments: [],
    sessions: [],
    users: [
      { id: BOOKER, full_name: "Booked Mentee", email: "booked@x.com", avatar_url: null, is_disabled: false },
      { id: ENROLLED, full_name: "Enrolled Mentee", email: "enrolled@x.com", avatar_url: null, is_disabled: false },
    ],
  };
  vi.mocked(supabase.from).mockImplementation(
    ((table: string) => makeChain(tables[table] ?? [])) as never
  );
});

describe("useMentorMentees", () => {
  it("includes a mentee who booked a session when the mentor has no programs", async () => {
    tables.sessions = [{ mentee_id: BOOKER, mentor_id: MENTOR, status: "booked" }];

    const rows = await renderMentees();

    expect(rows).toHaveLength(1);
    expect(rows[0].mentee.id).toBe(BOOKER);
    expect(rows[0].program).toBeNull();
  });

  it("excludes a mentee whose only session was cancelled", async () => {
    tables.sessions = [{ mentee_id: BOOKER, mentor_id: MENTOR, status: "cancelled" }];

    expect(await renderMentees()).toHaveLength(0);
  });

  it("ignores sessions belonging to a different mentor", async () => {
    tables.sessions = [{ mentee_id: BOOKER, mentor_id: "someone-else", status: "booked" }];

    expect(await renderMentees()).toHaveLength(0);
  });

  it("keeps completed and no-show sessions", async () => {
    tables.sessions = [
      { mentee_id: BOOKER, mentor_id: MENTOR, status: "completed" },
      { mentee_id: ENROLLED, mentor_id: MENTOR, status: "no_show" },
    ];

    const rows = await renderMentees();

    expect(rows.map((r) => r.mentee.id).sort()).toEqual([BOOKER, ENROLLED].sort());
  });

  it("lists a mentee once under their program when they also booked a session", async () => {
    tables.program_mentors = [{ program_id: "p1", mentor_id: MENTOR }];
    tables.programs = [{ id: "p1", name: "Program One", status: "active", slug: "p1", color: "#000" }];
    tables.program_mentees = [{ program_id: "p1", mentee_id: ENROLLED }];
    tables.sessions = [{ mentee_id: ENROLLED, mentor_id: MENTOR, status: "booked" }];

    const rows = await renderMentees();

    expect(rows).toHaveLength(1);
    expect(rows[0].program?.id).toBe("p1");
  });

  it("returns program mentees and direct bookings together", async () => {
    tables.program_mentors = [{ program_id: "p1", mentor_id: MENTOR }];
    tables.programs = [{ id: "p1", name: "Program One", status: "active", slug: "p1", color: "#000" }];
    tables.program_mentees = [{ program_id: "p1", mentee_id: ENROLLED }];
    tables.sessions = [{ mentee_id: BOOKER, mentor_id: MENTOR, status: "booked" }];

    const rows = await renderMentees();

    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.mentee.id === ENROLLED)?.program?.id).toBe("p1");
    expect(rows.find((r) => r.mentee.id === BOOKER)?.program).toBeNull();
  });

  it("omits disabled mentee accounts", async () => {
    tables.users = [
      { id: BOOKER, full_name: "Booked Mentee", email: "booked@x.com", avatar_url: null, is_disabled: true },
    ];
    tables.sessions = [{ mentee_id: BOOKER, mentor_id: MENTOR, status: "booked" }];

    expect(await renderMentees()).toHaveLength(0);
  });
});

describe("selectMenteeProgramMap", () => {
  it("skips direct-booking rows that have no program", () => {
    const rows = [
      {
        key: "direct:m1",
        program: null,
        mentee: { id: "m1", full_name: "A", email: "a@x.com" },
        assigned: false,
      },
      {
        key: "p1:m2",
        program: { id: "p1", name: "P1", status: "active", slug: "p1", color: "#000" },
        mentee: { id: "m2", full_name: "B", email: "b@x.com" },
        assigned: false,
      },
    ] as MentorMenteeRow[];

    const map = selectMenteeProgramMap(rows);

    expect(map.m1).toBeUndefined();
    expect(map.m2).toEqual([{ name: "P1", color: "#000", slug: "p1" }]);
  });
});

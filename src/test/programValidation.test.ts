import { describe, it, expect } from "vitest";
import { validateProgramForm, hasProgramFormErrors } from "@/features/programs/validation";

const base = { name: "Spring 2026 Cohort", starts_on: "", ends_on: "", capacity: "" };
const check = (over: Partial<typeof base>) => validateProgramForm({ ...base, ...over });

describe("program name validation", () => {
  it("rejects an empty or whitespace-only name", () => {
    expect(check({ name: "" }).name).toBe("Program name is required");
    expect(check({ name: "   " }).name).toBe("Program name is required");
  });

  it.each([",", '"', "!", "-", ",,", '""', "...", "!!!", "-–—", "()", "@#$"])(
    "rejects punctuation-only name %j",
    (name) => {
      expect(check({ name }).name).toBeDefined();
    }
  );

  it.each(["1", "123", "2026", "0", "42", "1 2 3"])("rejects numeric-only name %j", (name) => {
    expect(check({ name }).name).toBeDefined();
  });

  it.each([",a", "a,", ",,,a", "!!a", '"a"', "-a", "  ,a  "])(
    "rejects junk padded with a single letter %j",
    (name) => {
      expect(check({ name }).name).toBeDefined();
    }
  );

  it.each(["1a", "a1", "9z"])("rejects a single letter beside digits %j", (name) => {
    expect(check({ name }).name).toBe("Program name must include at least two letters");
  });

  it.each([
    "Cohort #1",
    "C++ Bootcamp",
    "Q1: Leadership",
    "Full-Stack Cohort",
    "Founder's Track",
    "Spring & Summer",
    "Cohort (2026)",
    "Spring, Cohort",
    'Spring "2026"',
    "Spring_2026",
    "Data/ML Track",
  ])("accepts special characters inside a meaningful name %j", (name) => {
    expect(check({ name }).name).toBeUndefined();
  });

  it("rejects a name starting with punctuation", () => {
    expect(check({ name: ",Spring Cohort" }).name).toBe(
      "Program name must start with a letter or number"
    );
  });

  it("rejects a single character", () => {
    expect(check({ name: "a" }).name).toBe("Program name must be at least 2 characters");
  });

  it("rejects a name longer than 100 characters", () => {
    expect(check({ name: "a".repeat(101) }).name).toBe(
      "Program name must be 100 characters or fewer"
    );
  });

  it.each([
    "AI",
    "Spring 2026 Engineering Cohort",
    "Programa Español",
    "2026 Mentorship Track",
    "Q1 Leadership",
    "Cohort 1",
    "日本語コホート",
    "Spring 2026 Cohort — Track A",
  ])("accepts meaningful name %j", (name) => {
    expect(check({ name }).name).toBeUndefined();
  });
});

describe("capacity validation", () => {
  it("allows an empty capacity", () => {
    expect(check({ capacity: "" }).capacity).toBeUndefined();
  });

  it.each(["0", "-1", "-100"])("rejects non-positive capacity %j", (capacity) => {
    expect(check({ capacity }).capacity).toBe("Capacity must be at least 1");
  });

  it.each(["abc", "1abc", "abc1", "twenty", "1e5", "+5", "1,000", "٣"])(
    "rejects pasted non-numeric capacity %j",
    (capacity) => {
      expect(check({ capacity }).capacity).toBe("Capacity must be a whole number");
    }
  );

  it("rejects a fractional capacity", () => {
    expect(check({ capacity: "1.5" }).capacity).toBe("Capacity must be a whole number");
  });

  it.each(["1", "25", "500"])("accepts positive whole number %j", (capacity) => {
    expect(check({ capacity }).capacity).toBeUndefined();
  });
});

describe("date validation", () => {
  it("rejects an end date before the start date", () => {
    expect(check({ starts_on: "2026-03-01", ends_on: "2026-02-01" }).ends_on).toBe(
      "End date must be after the start date"
    );
  });

  it("rejects an end date equal to the start date", () => {
    expect(check({ starts_on: "2026-03-01", ends_on: "2026-03-01" }).ends_on).toBeDefined();
  });

  it("accepts an end date after the start date", () => {
    expect(check({ starts_on: "2026-03-01", ends_on: "2026-03-02" }).ends_on).toBeUndefined();
  });

  it("accepts either date on its own", () => {
    expect(check({ starts_on: "2026-03-01" }).ends_on).toBeUndefined();
    expect(check({ ends_on: "2026-03-01" }).ends_on).toBeUndefined();
  });
});

describe("hasProgramFormErrors", () => {
  it("is false for a valid form", () => {
    expect(hasProgramFormErrors(check({}))).toBe(false);
  });

  it("reports every invalid field at once", () => {
    const errors = check({ name: "1", capacity: "0", starts_on: "2026-03-01", ends_on: "2026-01-01" });
    expect(Object.keys(errors).sort()).toEqual(["capacity", "ends_on", "name"]);
    expect(hasProgramFormErrors(errors)).toBe(true);
  });
});

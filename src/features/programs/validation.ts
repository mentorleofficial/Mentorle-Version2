export interface ProgramFormValues {
  name: string;
  starts_on: string;
  ends_on: string;
  capacity: string;
}

export type ProgramFormField = "name" | "capacity" | "ends_on";

export type ProgramFormErrors = Partial<Record<ProgramFormField, string>>;

export const PROGRAM_NAME_MIN = 2;
export const PROGRAM_NAME_MAX = 100;
export const PROGRAM_NAME_MIN_LETTERS = 2;

const LETTER = /\p{L}/gu;
const STARTS_ALPHANUMERIC = /^[\p{L}\p{N}]/u;
const WHOLE_NUMBER = /^-?\d+$/;

const letterCount = (value: string) => (value.match(LETTER) ?? []).length;

export function validateProgramForm(values: ProgramFormValues): ProgramFormErrors {
  const errors: ProgramFormErrors = {};

  const name = values.name.trim();
  if (!name) {
    errors.name = "Program name is required";
  } else if (!STARTS_ALPHANUMERIC.test(name)) {
    errors.name = "Program name must start with a letter or number";
  } else if (name.length < PROGRAM_NAME_MIN) {
    errors.name = `Program name must be at least ${PROGRAM_NAME_MIN} characters`;
  } else if (name.length > PROGRAM_NAME_MAX) {
    errors.name = `Program name must be ${PROGRAM_NAME_MAX} characters or fewer`;
  } else if (letterCount(name) < PROGRAM_NAME_MIN_LETTERS) {
    errors.name = "Program name must include at least two letters";
  }

  const capacity = values.capacity.trim();
  if (capacity) {
    if (!WHOLE_NUMBER.test(capacity)) {
      errors.capacity = "Capacity must be a whole number";
    } else if (Number(capacity) < 1) {
      errors.capacity = "Capacity must be at least 1";
    }
  }

  if (values.starts_on && values.ends_on && values.ends_on <= values.starts_on) {
    errors.ends_on = "End date must be after the start date";
  }

  return errors;
}

export const hasProgramFormErrors = (errors: ProgramFormErrors) =>
  Object.keys(errors).length > 0;

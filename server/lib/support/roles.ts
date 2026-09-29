export const hasGlobalRole = (role: string | null | undefined, expected: string) =>
  (role ?? "")
    .split(",")
    .map((r) => r.trim())
    .includes(expected);

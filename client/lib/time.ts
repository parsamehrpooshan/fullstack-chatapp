// The server stores and sends timestamps as UTC "YYYY-MM-DD HH:MM:SS". We keep
// everything UTC end to end and only format to the viewer's local time here, at
// render (rule 12).

export function parseServerTime(s: string): Date {
  return new Date(s.replace(" ", "T") + "Z");
}

// Local clock time (e.g. "14:32") for an individual message.
export function formatClockTime(s: string): string {
  return parseServerTime(s).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Compact stamp for the conversation list: clock time if today, else a short
// date. Year is shown only when it isn't the current year.
export function formatListTime(s: string): string {
  const d = parseServerTime(s);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString(
    [],
    d.getFullYear() === now.getFullYear()
      ? { month: "short", day: "numeric" }
      : { year: "2-digit", month: "numeric", day: "numeric" },
  );
}

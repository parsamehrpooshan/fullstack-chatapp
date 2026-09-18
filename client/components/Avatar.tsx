import { avatarColor, initials, displayName, type DisplayUser } from "@/lib/user";

// Initials avatar on a deterministic per-username color. No image is ever
// stored or uploaded (architecture.md decision log).
export function Avatar({
  user,
  size = 40,
}: {
  user: DisplayUser;
  size?: number;
}) {
  return (
    <span
      className="inline-flex shrink-0 select-none items-center justify-center rounded-full font-medium leading-none text-white ring-1 ring-black/5"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        backgroundColor: avatarColor(user),
      }}
      title={displayName(user)}
      aria-hidden="true"
    >
      {initials(user)}
    </span>
  );
}

// The signature mark: two nodes joined by a line — a 1:1 channel — with the far
// node lit emerald ("live"). Used on the auth screens and the chat header.
export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <line
            x1="7"
            y1="12"
            x2="17"
            y2="12"
            stroke="#fff"
            strokeWidth="1.5"
            strokeOpacity="0.45"
          />
          <circle cx="7" cy="12" r="2.6" fill="#fff" />
          <circle cx="17" cy="12" r="2.6" fill="var(--color-signal)" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-display text-lg font-semibold tracking-tight text-ink">
          DM<span className="text-muted"> Messenger</span>
        </span>
        <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
          one&#8209;to&#8209;one, in real time
        </span>
      </span>
    </div>
  );
}

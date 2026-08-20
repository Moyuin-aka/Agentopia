import type { TextTheme } from "@/lib/postCover";

export type { TextTheme } from "@/lib/postCover";

interface TextCoverProps {
  title: string;
  theme: TextTheme;
  tag?: string | null;
  date?: string | null;
  compact?: boolean;
}

function coverDate(value?: string | null) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return { weekday: "NOTE", date: "AGENTOPIA" };
  }

  const weekdays = ["SUN.", "MON.", "TUE.", "WED.", "THU.", "FRI.", "SAT."];
  return {
    weekday: weekdays[date.getUTCDay()],
    date: `${String(date.getUTCMonth() + 1).padStart(2, "0")} / ${String(date.getUTCDate()).padStart(2, "0")}`,
  };
}

function PaperTexture() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 opacity-55 mix-blend-multiply pointer-events-none"
      style={{
        backgroundImage:
          "radial-gradient(circle at 18% 20%, rgba(120,85,45,.08) 0 0.6px, transparent 0.8px), radial-gradient(circle at 75% 62%, rgba(90,70,50,.06) 0 0.7px, transparent 0.9px), linear-gradient(115deg, rgba(255,255,255,.45), transparent 42%, rgba(120,90,55,.035))",
        backgroundSize: "13px 17px, 19px 23px, 100% 100%",
      }}
    />
  );
}

function LeafDoodle() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 180 92"
      className="absolute bottom-[5%] right-[7%] w-[34%] min-w-20 max-w-56 text-[#f06b24]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 79c20-7 32 7 51 0 12-5 16-17 24-28" />
      <path d="M79 52c-4-20 8-39 28-45 7 20 2 39-18 52-5 3-9 1-10-7Z" />
      <path d="M82 53c8-12 15-23 25-36M89 42l-1-17M95 34l10-7M84 49l-7-10" />
      <path d="M91 62c23 7 35 21 51 14 13-6 21-4 34 3" />
    </svg>
  );
}

export default function TextCover({
  title,
  theme,
  tag,
  date,
  compact = false,
}: TextCoverProps) {
  const meta = coverDate(date);
  const baseContainer =
    "w-full h-full relative overflow-hidden shrink-0 [container-type:size] select-none";
  const titleClass = compact
    ? "relative z-10 line-clamp-3 text-[9px] leading-[1.25] font-semibold"
    : "relative z-10 line-clamp-5 text-[clamp(1.25rem,6cqw,4.25rem)] leading-[1.22] tracking-[-0.035em]";

  switch (theme) {
    case "notebook":
      return (
        <div className={`${baseContainer} bg-[#fbfaf5] text-[#24130f]`}>
          <PaperTexture />
          {!compact && (
            <div className="absolute top-[7%] left-[7%] z-10 flex items-center gap-[0.55em] font-serif text-[clamp(.55rem,2.2cqw,1rem)] font-bold tracking-[0.04em] text-[#ee661f] uppercase">
              <span className="block size-[0.55em] rounded-full bg-current" />
              {tag ? `# ${tag}` : "TEXT NOTE"}
            </div>
          )}
          <div className={compact ? "absolute inset-2 flex items-center" : "absolute inset-x-[9%] top-[38%]"}>
            <h2 className={`${titleClass} font-serif`}>{title}</h2>
          </div>
          {!compact && <LeafDoodle />}
        </div>
      );

    case "quote":
      return (
        <div className={`${baseContainer} bg-[#f6f5f1] text-[#0d0c0b]`}>
          <PaperTexture />
          {!compact && (
            <div className="absolute inset-x-[5%] top-[4%] z-10 flex items-center justify-between font-serif text-[clamp(.6rem,2.4cqw,1.1rem)] font-semibold tracking-[0.02em]">
              <span>({meta.weekday})</span>
              <span>{meta.date}</span>
            </div>
          )}
          <div className={compact ? "absolute inset-2 flex items-center" : "absolute inset-x-[10%] top-[39%]"}>
            <h2 className={`${titleClass} font-serif font-medium`}>{title}</h2>
          </div>
          {!compact && (
            <div className="absolute bottom-[5%] left-[6%] z-10 font-serif text-[clamp(.5rem,1.7cqw,.8rem)] tracking-[0.12em] text-black/45 uppercase">
              Agentopia · field note
            </div>
          )}
        </div>
      );

    case "gradient":
      return (
        <div className={`${baseContainer} bg-gradient-to-br from-purple-900 to-rose-900`}>
          <div className="absolute inset-[10%] flex items-center justify-center">
            <h2 className={`${titleClass} text-white text-center font-bold drop-shadow-md`}>{title}</h2>
          </div>
        </div>
      );

    case "terminal":
      return (
        <div className={`${baseContainer} bg-[#0A0A0A] border border-white/5 text-left`}>
          {/* Faux window controls */}
          <div className="absolute top-4 left-4 flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
          </div>
          <h2 className="absolute inset-x-[9%] top-[24%] text-[clamp(.85rem,4.5cqw,2.75rem)] leading-snug font-mono line-clamp-6 text-green-400">
            <span className="text-green-500 mr-2 animate-pulse">{'>'}</span>
            {title}
          </h2>
        </div>
      );

    default:
      return null;
  }
}

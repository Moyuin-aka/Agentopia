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

function coverCode(seed: string) {
  let hash = 0;
  for (const character of seed) {
    hash = (hash * 33 + (character.codePointAt(0) ?? 0)) >>> 0;
  }
  return String(hash % 1000).padStart(3, "0");
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
  const code = coverCode(title);
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
              {tag ? `# ${tag}` : "AGENT LOG"}
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
              <span>(NODE / {code})</span>
              <span>UTC {meta.date}</span>
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

    case "signal":
      return (
        <div className={`${baseContainer} bg-[#18130f] text-[#f6ead8]`}>
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle, #f16a31 0 1px, transparent 1.2px)",
              backgroundSize: "12px 12px",
              maskImage: "linear-gradient(135deg, black, transparent 62%)",
            }}
          />
          <div aria-hidden="true" className="absolute -right-[18%] top-[10%] aspect-square w-[72%] rounded-full border border-[#f16a31]/50" />
          <div aria-hidden="true" className="absolute -right-[8%] top-[20%] aspect-square w-[48%] rounded-full border border-[#f16a31]/35" />
          {!compact && (
            <>
              <div className="absolute left-[7%] top-[7%] font-mono text-[clamp(.5rem,1.7cqw,.8rem)] uppercase tracking-[0.2em] text-[#f16a31]">
                Signal / {code}
              </div>
              <div className="absolute right-[6%] top-[5%] font-mono text-[clamp(2rem,12cqw,7rem)] font-bold leading-none text-[#f16a31]/18">
                {code.slice(-2)}
              </div>
            </>
          )}
          <div className={compact ? "absolute inset-2 flex items-center" : "absolute inset-x-[8%] top-[34%]"}>
            <h2 className={`${titleClass} font-sans font-bold uppercase`}>{title}</h2>
          </div>
          {!compact && (
            <div className="absolute inset-x-[7%] bottom-[7%] flex items-center gap-3 font-mono text-[clamp(.45rem,1.5cqw,.72rem)] uppercase tracking-[0.16em] text-[#f6ead8]/55">
              <span className="h-px flex-1 bg-[#f16a31]/60" />
              Community transmission
            </div>
          )}
        </div>
      );

    case "blueprint":
      return (
        <div className={`${baseContainer} bg-[#dbeaec] text-[#123f4b]`}>
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-35"
            style={{
              backgroundImage:
                "linear-gradient(#25728733 1px, transparent 1px), linear-gradient(90deg, #25728733 1px, transparent 1px)",
              backgroundSize: "8% 8%",
            }}
          />
          <div aria-hidden="true" className="absolute -right-[15%] bottom-[3%] aspect-square w-[65%] rounded-full border border-[#216c80]/45" />
          <div aria-hidden="true" className="absolute right-[9%] bottom-[18%] aspect-square w-[24%] rotate-45 border border-[#216c80]/45" />
          {!compact && (
            <div className="absolute inset-x-[6%] top-[6%] flex items-start justify-between font-mono text-[clamp(.45rem,1.5cqw,.72rem)] uppercase tracking-[0.15em] text-[#216c80]">
              <span>Field schematic</span>
              <span>{meta.weekday} · {code}</span>
            </div>
          )}
          <div className={compact ? "absolute inset-2 flex items-center" : "absolute inset-x-[8%] top-[36%]"}>
            <h2 className={`${titleClass} font-mono font-semibold`}>{title}</h2>
          </div>
          {!compact && (
            <div className="absolute bottom-[7%] left-[7%] flex items-center gap-2 font-mono text-[clamp(.42rem,1.4cqw,.68rem)] uppercase tracking-[0.13em] text-[#216c80]/75">
              <span className="size-2 rotate-45 border border-current" />
              Agentopia research node
            </div>
          )}
        </div>
      );

    case "receipt":
      return (
        <div className={`${baseContainer} bg-[#ece6d7] text-[#24231f]`}>
          <PaperTexture />
          <div aria-hidden="true" className="absolute inset-x-[5%] top-[4%] border-t-2 border-dashed border-black/25" />
          <div aria-hidden="true" className="absolute inset-x-[5%] bottom-[4%] border-t-2 border-dashed border-black/25" />
          {!compact && (
            <div className="absolute inset-x-[8%] top-[8%] flex items-start justify-between font-mono text-[clamp(.45rem,1.5cqw,.72rem)] uppercase tracking-[0.08em] text-black/60">
              <span>Agentopia receipt</span>
              <span>#{code}</span>
            </div>
          )}
          <div className={compact ? "absolute inset-2 flex items-center" : "absolute inset-x-[9%] top-[34%]"}>
            <h2 className={`${titleClass} font-mono font-bold`}>{title}</h2>
          </div>
          {!compact && (
            <svg
              aria-hidden="true"
              viewBox="0 0 160 28"
              preserveAspectRatio="none"
              className="absolute bottom-[9%] left-[9%] h-[7%] w-[52%] text-black/65"
              fill="currentColor"
            >
              {[0, 5, 9, 16, 20, 28, 31, 38, 44, 48, 55, 63, 67, 74, 78, 86, 93, 97, 104, 111, 115, 123, 130, 136, 142, 150, 155].map((x, index) => (
                <rect key={x} x={x} y="0" width={index % 3 === 0 ? 3 : 1.5} height="28" />
              ))}
            </svg>
          )}
        </div>
      );

    case "orbit":
      return (
        <div className={`${baseContainer} bg-[#142033] text-[#fff2dc]`}>
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-35"
            style={{
              backgroundImage: "radial-gradient(circle at 20% 25%, #ffffff22 0 1px, transparent 1.2px)",
              backgroundSize: "18px 18px",
            }}
          />
          <div aria-hidden="true" className="absolute -left-[28%] -top-[8%] aspect-square w-[94%] rounded-full border border-[#ff7a59]/45" />
          <div aria-hidden="true" className="absolute -left-[11%] top-[9%] aspect-square w-[60%] rounded-full border border-[#ff7a59]/30" />
          <span aria-hidden="true" className="absolute left-[42%] top-[19%] size-[clamp(.45rem,2cqw,.9rem)] rounded-full bg-[#ff7a59] shadow-[0_0_18px_#ff7a59]" />
          {!compact && (
            <div className="absolute inset-x-[7%] top-[6%] flex justify-between font-mono text-[clamp(.45rem,1.5cqw,.72rem)] uppercase tracking-[0.16em] text-[#ffb196]">
              <span>Night orbit</span>
              <span>{meta.date}</span>
            </div>
          )}
          <div className={compact ? "absolute inset-2 flex items-center" : "absolute inset-x-[9%] top-[39%]"}>
            <h2 className={`${titleClass} font-serif font-medium`}>{title}</h2>
          </div>
          {!compact && (
            <div className="absolute bottom-[6%] right-[7%] font-mono text-[clamp(.45rem,1.5cqw,.72rem)] uppercase tracking-[0.16em] text-[#ffb196]/75">
              Node {code} · online
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

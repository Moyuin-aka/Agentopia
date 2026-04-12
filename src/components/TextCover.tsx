import { Quote } from "lucide-react";

export type TextTheme = "notebook" | "quote" | "gradient" | "terminal";

interface TextCoverProps {
  title: string;
  theme: TextTheme;
}

export default function TextCover({ title, theme }: TextCoverProps) {
  // Common container styling
  const baseContainer = "w-full h-full relative overflow-hidden flex items-center justify-center p-6 sm:p-8 shrink-0";
  const textClass = "text-lg md:text-xl font-bold line-clamp-5 text-center relative z-10 leading-snug";

  switch (theme) {
    case "notebook":
      return (
        <div className={`${baseContainer} bg-yellow-50/95`}>
          {/* Ruled lines pattern */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, #94a3b8 31px, #94a3b8 32px)',
              backgroundSize: '100% 32px'
            }}
          />
          <h2 className={`${textClass} text-neutral-800`}>{title}</h2>
        </div>
      );

    case "quote":
      return (
        <div className={`${baseContainer} bg-teal-50/95`}>
          <Quote className="absolute top-4 left-4 w-20 h-20 text-teal-600/10 -rotate-6" />
          <h2 className={`${textClass} text-neutral-800 tracking-tight`}>{title}</h2>
        </div>
      );

    case "gradient":
      return (
        <div className={`${baseContainer} bg-gradient-to-br from-purple-900 to-rose-900`}>
          <h2 className={`${textClass} text-white drop-shadow-md`}>{title}</h2>
        </div>
      );

    case "terminal":
      return (
        <div className={`${baseContainer} bg-[#0A0A0A] border border-white/5 items-start justify-start text-left pt-12`}>
          {/* Faux window controls */}
          <div className="absolute top-4 left-4 flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
          </div>
          <h2 className={`text-base md:text-lg font-mono line-clamp-6 text-green-400`}>
            <span className="text-green-500 mr-2 animate-pulse">{'>'}</span>
            {title}
          </h2>
        </div>
      );

    default:
      return null;
  }
}

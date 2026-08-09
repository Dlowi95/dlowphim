interface MovieLanguageBadgesProps {
  lang?: string;
  className?: string;
  badgeClassName?: string;
}

const LANGUAGE_BADGE_RULES = [
  {
    pattern: /vietsub|phụ đề|phu de/,
    label: "P.Đề",
    className: "bg-zinc-600/90",
  },
  {
    pattern: /thuyết minh|thuyet minh/,
    label: "T.Minh",
    className: "bg-emerald-500/90",
  },
  {
    pattern: /lồng tiếng|long tieng/,
    label: "L.Tiếng",
    className: "bg-blue-500/90",
  },
] as const;

export function getMovieLanguageBadges(lang?: string) {
  const normalizedLanguage = (lang || "Vietsub").toLocaleLowerCase("vi");
  const badges = LANGUAGE_BADGE_RULES.filter(({ pattern }) =>
    pattern.test(normalizedLanguage),
  ).map(({ label, className }) => ({ label, className }));

  return badges.length > 0
    ? badges
    : [{ label: "P.Đề", className: "bg-zinc-600/90" }];
}

export default function MovieLanguageBadges({
  lang,
  className = "",
  badgeClassName = "",
}: MovieLanguageBadgesProps) {
  const badges = getMovieLanguageBadges(lang);

  return (
    <div className={className} aria-label={`Bản chiếu: ${badges.map((badge) => badge.label).join(", ")}`}>
      {badges.map((badge) => (
        <span
          key={badge.label}
          className={`whitespace-nowrap rounded-md px-1.5 py-0.5 text-[9px] font-black leading-tight text-white shadow-sm backdrop-blur-md ${badge.className} ${badgeClassName}`}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}

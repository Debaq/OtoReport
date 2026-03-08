import { useState } from "react";
import { useTranslation } from "react-i18next";

interface Structure {
  id: string;
  labelKey: string;
  descKey: string;
  color: string;
  hoverColor: string;
}

const STRUCTURES: Structure[] = [
  { id: "pinna", labelKey: "education.anatomy.pinna", descKey: "education.anatomy.pinnaDesc", color: "#e8b896", hoverColor: "#f0a070" },
  { id: "ear_canal", labelKey: "education.anatomy.earCanal", descKey: "education.anatomy.earCanalDesc", color: "#d4967a", hoverColor: "#e07848" },
  { id: "tympanic_membrane", labelKey: "education.anatomy.tympanicMembrane", descKey: "education.anatomy.tympanicMembraneDesc", color: "#c8a878", hoverColor: "#e89030" },
  { id: "middle_ear", labelKey: "education.anatomy.middleEar", descKey: "education.anatomy.middleEarDesc", color: "#f5e6c8", hoverColor: "#f0d898" },
  { id: "ossicles", labelKey: "education.anatomy.ossicles", descKey: "education.anatomy.ossiclesDesc", color: "#f0ead6", hoverColor: "#f5e0a0" },
  { id: "eustachian_tube", labelKey: "education.anatomy.eustachianTube", descKey: "education.anatomy.eustachianTubeDesc", color: "#e8a0a0", hoverColor: "#d06060" },
  { id: "cochlea", labelKey: "education.anatomy.cochlea", descKey: "education.anatomy.cochleaDesc", color: "#b0a0e0", hoverColor: "#8060d0" },
  { id: "semicircular_canals", labelKey: "education.anatomy.semicircularCanals", descKey: "education.anatomy.semicircularCanalsDesc", color: "#80c0f0", hoverColor: "#4090d0" },
  { id: "auditory_nerve", labelKey: "education.anatomy.auditoryNerve", descKey: "education.anatomy.auditoryNerveDesc", color: "#70d8a8", hoverColor: "#30b878" },
];

function getStroke(id: string, active: string | null) {
  if (active === id) return "#fff";
  return "rgba(0,0,0,0.25)";
}

function getSW(id: string, active: string | null) {
  return active === id ? 2 : 0.8;
}

export function EarAnatomySvg() {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const active = selected || hovered;
  const activeStructure = STRUCTURES.find((s) => s.id === active);

  const color = (id: string) => {
    const s = STRUCTURES.find((x) => x.id === id)!;
    return active === id ? s.hoverColor : s.color;
  };
  const ev = (id: string) => ({
    onMouseEnter: () => setHovered(id),
    onMouseLeave: () => setHovered(null),
    onClick: () => setSelected(selected === id ? null : id),
    style: { cursor: "pointer" as const, filter: active === id ? "drop-shadow(0 0 6px rgba(255,255,255,0.25))" : "none" },
  });

  return (
    <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start">
      <div className="relative w-full max-w-2xl">
        <svg
          viewBox="0 0 600 400"
          className="w-full rounded-xl border border-border-secondary bg-bg-tertiary"
          style={{ minHeight: 320 }}
        >
          <defs>
            {/* Bone texture pattern */}
            <pattern id="bone-pattern" patternUnits="userSpaceOnUse" width="8" height="8">
              <rect width="8" height="8" fill="#d8c8b0" />
              <circle cx="2" cy="2" r="0.5" fill="#c8b8a0" opacity="0.5" />
              <circle cx="6" cy="6" r="0.5" fill="#c8b8a0" opacity="0.5" />
            </pattern>
            {/* Skin gradient for pinna */}
            <linearGradient id="skin-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f0c8a8" />
              <stop offset="100%" stopColor="#d8a880" />
            </linearGradient>
            {/* Canal gradient */}
            <radialGradient id="canal-grad" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="#2a1a10" />
              <stop offset="100%" stopColor="#5a3a28" />
            </radialGradient>
          </defs>

          {/* === TEMPORAL BONE (background) === */}
          <path
            d="M 160 30 L 560 30 C 575 30 580 40 580 50 L 580 360 C 580 370 575 380 560 380 L 160 380 C 155 380 150 370 148 355 L 130 260 C 125 240 125 200 130 175 L 148 80 C 150 55 155 30 160 30 Z"
            fill="url(#bone-pattern)"
            stroke="#b8a890"
            strokeWidth="1.5"
            opacity="0.35"
          />

          {/* === PINNA (outer ear) === */}
          <g {...ev("pinna")}>
            {/* Helix - outer rim */}
            <path
              d="M 88 70 C 55 75 30 110 25 155 C 20 200 25 245 35 275 C 42 295 52 310 62 320 C 70 328 78 330 82 325 C 78 318 72 308 68 295 C 60 270 55 245 55 220 C 55 195 58 172 65 155 C 70 142 78 132 88 127"
              fill={color("pinna")}
              stroke={getStroke("pinna", active)}
              strokeWidth={getSW("pinna", active)}
            />
            {/* Antihelix */}
            <path
              d="M 88 127 C 82 135 78 148 76 165 C 74 185 76 208 80 228 C 83 242 87 252 92 258 C 96 262 100 260 100 255 C 97 248 93 238 90 225 C 86 208 84 188 85 170 C 86 155 90 142 96 133 L 100 128"
              fill={color("pinna")}
              stroke={getStroke("pinna", active)}
              strokeWidth={getSW("pinna", active)}
              opacity="0.85"
            />
            {/* Concha */}
            <path
              d="M 100 128 C 108 120 118 118 125 122 L 130 155 C 130 175 128 195 125 210 L 100 255 C 95 248 92 235 90 220 C 87 200 86 178 88 158 C 90 140 94 132 100 128 Z"
              fill={color("pinna")}
              stroke={getStroke("pinna", active)}
              strokeWidth={getSW("pinna", active)}
              opacity="0.9"
            />
            {/* Tragus */}
            <path
              d="M 125 145 C 132 140 135 145 133 155 C 131 162 127 168 123 168 C 120 168 118 163 120 158 C 122 152 124 148 125 145 Z"
              fill={color("pinna")}
              stroke={getStroke("pinna", active)}
              strokeWidth={getSW("pinna", active)}
              opacity="0.95"
            />
            {/* Lobule */}
            <path
              d="M 62 320 C 70 328 80 332 88 328 C 95 324 98 315 100 305 L 100 255 C 95 275 85 300 75 315 C 70 322 65 325 62 320 Z"
              fill={color("pinna")}
              stroke={getStroke("pinna", active)}
              strokeWidth={getSW("pinna", active)}
              opacity="0.8"
            />
          </g>

          {/* === EXTERNAL AUDITORY CANAL === */}
          <g {...ev("ear_canal")}>
            {/* Canal walls - upper */}
            <path
              d="M 130 138 C 150 132 180 128 210 128 C 235 128 255 130 270 134"
              fill="none"
              stroke={color("ear_canal")}
              strokeWidth="6"
              strokeLinecap="round"
            />
            {/* Canal walls - lower */}
            <path
              d="M 130 210 C 150 218 180 222 210 220 C 235 218 255 214 270 210"
              fill="none"
              stroke={color("ear_canal")}
              strokeWidth="6"
              strokeLinecap="round"
            />
            {/* Canal lumen (dark interior) */}
            <path
              d="M 132 145 C 152 138 182 134 212 134 C 237 134 257 136 272 140 L 272 205 C 257 210 237 214 212 215 C 182 217 152 213 132 205 Z"
              fill="#3a2218"
              stroke={getStroke("ear_canal", active)}
              strokeWidth={getSW("ear_canal", active)}
              opacity="0.7"
            />
            {/* Skin lining (thin inner wall) */}
            <path
              d="M 135 148 C 155 142 185 138 212 138 C 235 138 255 140 270 143"
              fill="none"
              stroke={color("ear_canal")}
              strokeWidth="2"
              opacity="0.6"
            />
            <path
              d="M 135 200 C 155 208 185 212 212 211 C 235 210 255 207 270 203"
              fill="none"
              stroke={color("ear_canal")}
              strokeWidth="2"
              opacity="0.6"
            />
            {/* Small hairs at entrance */}
            <line x1="138" y1="148" x2="136" y2="142" stroke={color("ear_canal")} strokeWidth="0.8" opacity="0.5" />
            <line x1="145" y1="146" x2="144" y2="140" stroke={color("ear_canal")} strokeWidth="0.8" opacity="0.5" />
            <line x1="152" y1="145" x2="151" y2="139" stroke={color("ear_canal")} strokeWidth="0.8" opacity="0.5" />
          </g>

          {/* === TYMPANIC MEMBRANE === */}
          <g {...ev("tympanic_membrane")}>
            {/* Membrane - angled ellipse */}
            <ellipse
              cx="278"
              cy="175"
              rx="6"
              ry="38"
              fill={color("tympanic_membrane")}
              stroke={getStroke("tympanic_membrane", active)}
              strokeWidth={getSW("tympanic_membrane", active)}
              transform="rotate(-15, 278, 175)"
            />
            {/* Umbo point */}
            <circle cx="276" cy="180" r="2" fill="#8a6a48" />
            {/* Malleus handle visible through membrane */}
            <line
              x1="280" y1="148" x2="276" y2="180"
              stroke="#9a7a58"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.6"
            />
            {/* Light cone hint */}
            <path
              d="M 276 180 L 270 200 L 278 205 Z"
              fill="rgba(255,255,220,0.3)"
              stroke="none"
            />
          </g>

          {/* === MIDDLE EAR CAVITY === */}
          <g {...ev("middle_ear")}>
            <path
              d="M 284 130 C 295 125 320 120 340 125 C 350 128 355 135 355 150 L 355 220 C 355 240 350 250 340 252 C 320 256 295 250 284 240 L 284 130 Z"
              fill={color("middle_ear")}
              stroke={getStroke("middle_ear", active)}
              strokeWidth={getSW("middle_ear", active)}
              opacity="0.5"
            />
          </g>

          {/* === OSSICLES === */}
          <g {...ev("ossicles")}>
            {/* Malleus (hammer) */}
            <g>
              {/* Head */}
              <ellipse cx="295" cy="148" rx="7" ry="9" fill={color("ossicles")} stroke={getStroke("ossicles", active)} strokeWidth={getSW("ossicles", active)} />
              {/* Neck */}
              <line x1="295" y1="157" x2="293" y2="165" stroke={color("ossicles")} strokeWidth="3" strokeLinecap="round" />
              {/* Handle (manubrium) */}
              <line x1="293" y1="165" x2="286" y2="188" stroke={color("ossicles")} strokeWidth="2.5" strokeLinecap="round" />
              {/* Short process */}
              <circle cx="292" cy="162" r="2" fill={color("ossicles")} stroke={getStroke("ossicles", active)} strokeWidth="0.5" />
            </g>

            {/* Incus (anvil) */}
            <g>
              {/* Body */}
              <ellipse cx="310" cy="148" rx="8" ry="7" fill={color("ossicles")} stroke={getStroke("ossicles", active)} strokeWidth={getSW("ossicles", active)} />
              {/* Short process (posterior) */}
              <line x1="316" y1="150" x2="322" y2="155" stroke={color("ossicles")} strokeWidth="2.5" strokeLinecap="round" />
              {/* Long process (descending) */}
              <line x1="308" y1="155" x2="318" y2="185" stroke={color("ossicles")} strokeWidth="2" strokeLinecap="round" />
              {/* Lenticular process (tip) */}
              <circle cx="318" cy="186" r="1.8" fill={color("ossicles")} />
            </g>

            {/* Incudomalleolar joint */}
            <ellipse cx="302" cy="147" rx="3" ry="4" fill="none" stroke={getStroke("ossicles", active)} strokeWidth="0.5" strokeDasharray="2,1" opacity="0.5" />

            {/* Stapes (stirrup) */}
            <g>
              {/* Head */}
              <circle cx="322" cy="188" r="2.5" fill={color("ossicles")} stroke={getStroke("ossicles", active)} strokeWidth={getSW("ossicles", active)} />
              {/* Anterior crus */}
              <path d="M 324 186 C 330 182 338 180 342 184" fill="none" stroke={color("ossicles")} strokeWidth="1.5" />
              {/* Posterior crus */}
              <path d="M 324 190 C 330 194 338 196 342 192" fill="none" stroke={color("ossicles")} strokeWidth="1.5" />
              {/* Footplate */}
              <ellipse cx="344" cy="188" rx="3" ry="7" fill={color("ossicles")} stroke={getStroke("ossicles", active)} strokeWidth={getSW("ossicles", active)} />
            </g>
          </g>

          {/* === EUSTACHIAN TUBE === */}
          <g {...ev("eustachian_tube")}>
            {/* Tube lumen */}
            <path
              d="M 310 252 C 300 268 280 290 255 310 C 235 326 210 340 190 350 C 180 355 172 353 175 345 C 178 338 190 330 210 318 C 235 302 260 280 278 262 C 288 252 298 248 310 252 Z"
              fill={color("eustachian_tube")}
              stroke={getStroke("eustachian_tube", active)}
              strokeWidth={getSW("eustachian_tube", active)}
              opacity="0.8"
            />
            {/* Tube walls */}
            <path
              d="M 305 248 C 295 265 275 285 250 305 C 230 320 208 335 188 345"
              fill="none"
              stroke={color("eustachian_tube")}
              strokeWidth="1"
              opacity="0.4"
            />
          </g>

          {/* === COCHLEA === */}
          <g {...ev("cochlea")}>
            {/* Spiral - outer turn */}
            <path
              d="M 360 185 C 360 160 380 145 405 145 C 430 145 450 165 450 190 C 450 215 435 235 415 240 C 395 245 375 235 368 218"
              fill="none"
              stroke={color("cochlea")}
              strokeWidth="5"
              strokeLinecap="round"
            />
            {/* Spiral - middle turn */}
            <path
              d="M 372 215 C 372 200 382 158 405 158 C 425 158 438 172 438 190 C 438 208 425 222 410 225 C 398 227 385 220 380 210"
              fill="none"
              stroke={color("cochlea")}
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.85"
            />
            {/* Spiral - inner turn */}
            <path
              d="M 383 208 C 385 195 393 175 408 175 C 420 175 428 185 425 198 C 422 208 412 215 403 213"
              fill="none"
              stroke={color("cochlea")}
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.7"
            />
            {/* Apex */}
            <circle cx="403" cy="208" r="3" fill={color("cochlea")} opacity="0.6" />
            {/* Oval window connection */}
            <ellipse cx="358" cy="188" rx="4" ry="8" fill={color("cochlea")} stroke={getStroke("cochlea", active)} strokeWidth={getSW("cochlea", active)} opacity="0.6" />
            {/* Round window */}
            <ellipse cx="360" cy="210" rx="3" ry="5" fill={color("cochlea")} stroke={getStroke("cochlea", active)} strokeWidth={getSW("cochlea", active)} opacity="0.5" />
            {/* Highlight overlay for hover */}
            <path
              d="M 355 180 C 355 150 385 135 415 140 C 445 145 460 175 458 200 C 456 225 440 248 415 250 C 390 252 370 238 363 218 C 358 205 355 195 355 180 Z"
              fill={color("cochlea")}
              stroke={getStroke("cochlea", active)}
              strokeWidth={getSW("cochlea", active)}
              opacity="0.15"
            />
          </g>

          {/* === SEMICIRCULAR CANALS === */}
          <g {...ev("semicircular_canals")}>
            {/* Superior (vertical) canal */}
            <path
              d="M 385 148 C 385 100 400 65 425 60 C 450 55 465 75 465 105 C 465 130 455 148 440 155"
              fill="none"
              stroke={color("semicircular_canals")}
              strokeWidth="5"
              strokeLinecap="round"
            />
            {/* Posterior (vertical) canal */}
            <path
              d="M 440 155 C 455 158 475 140 480 115 C 485 90 478 68 465 60 C 455 55 448 58 445 65"
              fill="none"
              stroke={color("semicircular_canals")}
              strokeWidth="4.5"
              strokeLinecap="round"
              opacity="0.8"
            />
            {/* Lateral (horizontal) canal */}
            <path
              d="M 375 165 C 365 152 370 135 385 128 C 400 121 425 120 445 130 C 458 137 460 150 450 158"
              fill="none"
              stroke={color("semicircular_canals")}
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.7"
            />
            {/* Ampullae (swellings at base) */}
            <ellipse cx="385" cy="150" rx="5" ry="7" fill={color("semicircular_canals")} opacity="0.5" />
            <ellipse cx="442" cy="155" rx="5" ry="6" fill={color("semicircular_canals")} opacity="0.5" />
            {/* Vestibule */}
            <ellipse cx="380" cy="168" rx="12" ry="15" fill={color("semicircular_canals")} stroke={getStroke("semicircular_canals", active)} strokeWidth={getSW("semicircular_canals", active)} opacity="0.3" />
          </g>

          {/* === AUDITORY NERVE (CN VIII) === */}
          <g {...ev("auditory_nerve")}>
            {/* Main nerve trunk */}
            <path
              d="M 420 210 C 435 215 460 218 485 215 C 505 212 525 205 540 195 C 550 188 560 180 565 172"
              fill="none"
              stroke={color("auditory_nerve")}
              strokeWidth="6"
              strokeLinecap="round"
            />
            {/* Vestibular branch */}
            <path
              d="M 400 175 C 410 185 425 195 440 205"
              fill="none"
              stroke={color("auditory_nerve")}
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.6"
            />
            {/* Cochlear branch */}
            <path
              d="M 420 225 C 430 220 440 215 450 215"
              fill="none"
              stroke={color("auditory_nerve")}
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.6"
            />
            {/* Nerve fibers hint */}
            <path
              d="M 540 195 C 548 190 555 183 562 175"
              fill="none"
              stroke={color("auditory_nerve")}
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.5"
            />
            <path
              d="M 540 198 C 548 195 556 190 562 182"
              fill="none"
              stroke={color("auditory_nerve")}
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.3"
            />
          </g>

          {/* === LABELS with leader lines === */}
          <g className="fill-current text-text-tertiary" fontSize="9" opacity="0.65">
            {/* Outer ear label */}
            <text x="50" y="55" textAnchor="middle" fontWeight="600" fontSize="10">{t("education.anatomy.lateral")}</text>
            {/* Inner ear label */}
            <text x="545" y="55" textAnchor="middle" fontWeight="600" fontSize="10">{t("education.anatomy.medial")}</text>

            {/* Divider labels */}
            <line x1="140" y1="42" x2="140" y2="62" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
            <text x="140" y="40" textAnchor="middle" fontSize="7.5" fontStyle="italic" opacity="0.4">
              {t("education.anatomy.crossSection")}
            </text>

            {/* Section labels */}
            <text x="90" y="380" textAnchor="middle" fontSize="8" opacity="0.45">{t("education.anatomy.outerEar")}</text>
            <text x="220" y="380" textAnchor="middle" fontSize="8" opacity="0.45">{t("education.anatomy.middleEarLabel")}</text>
            <text x="420" y="380" textAnchor="middle" fontSize="8" opacity="0.45">{t("education.anatomy.innerEar")}</text>

            {/* Section dividers */}
            <line x1="145" y1="365" x2="145" y2="385" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3,2" opacity="0.25" />
            <line x1="285" y1="365" x2="285" y2="385" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3,2" opacity="0.25" />
            <line x1="355" y1="365" x2="355" y2="385" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3,2" opacity="0.25" />
          </g>
        </svg>
      </div>

      {/* Info panel */}
      <div className="w-full lg:w-72 flex-shrink-0">
        <div className="rounded-xl border border-border-secondary bg-bg-secondary p-4">
          <h4 className="mb-3 text-sm font-semibold text-text-primary">
            {t("education.anatomy.structures")}
          </h4>
          <div className="space-y-0.5">
            {STRUCTURES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                  active === s.id
                    ? "bg-accent-subtle text-accent-text"
                    : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                }`}
                onMouseEnter={() => setHovered(s.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setSelected(selected === s.id ? null : s.id)}
              >
                <div className="h-3 w-3 rounded-full flex-shrink-0 border border-black/10" style={{ backgroundColor: s.color }} />
                {t(s.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {activeStructure && (
          <div className="mt-3 rounded-xl border border-accent bg-accent-subtle p-4">
            <h5 className="text-sm font-semibold text-accent-text">{t(activeStructure.labelKey)}</h5>
            <p className="mt-1.5 text-sm text-text-secondary leading-relaxed">{t(activeStructure.descKey)}</p>
          </div>
        )}

        {!activeStructure && (
          <div className="mt-3 rounded-xl border border-border-secondary bg-bg-secondary p-4">
            <p className="text-sm text-text-tertiary italic">{t("education.anatomy.clickHint")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

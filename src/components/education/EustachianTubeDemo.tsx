import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Play, RotateCcw } from "lucide-react";

type DemoState = "idle" | "swallowing" | "blocked" | "effusion";

export function EustachianTubeDemo() {
  const { t } = useTranslation();
  const [state, setState] = useState<DemoState>("idle");
  const [animating, setAnimating] = useState(false);

  const runDemo = (newState: DemoState) => {
    if (animating) return;
    setAnimating(true);
    setState(newState);
    setTimeout(() => setAnimating(false), 3000);
  };

  const tubeOpen = state === "swallowing";
  const tubeBlocked = state === "blocked" || state === "effusion";
  const hasFluid = state === "effusion";

  return (
    <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start">
      <div className="relative w-full max-w-lg">
        <svg
          viewBox="0 0 300 220"
          className="w-full rounded-xl border border-border-secondary bg-bg-tertiary"
          style={{ minHeight: 280 }}
        >
          {/* Middle ear cavity */}
          <path
            d="M 80 50 L 180 40 C 190 38 195 45 195 55 L 195 130 C 195 140 190 148 180 150 L 80 155 C 70 156 65 150 65 140 L 65 65 C 65 55 70 48 80 50 Z"
            fill="#ffeaa7"
            stroke="#c4a46c"
            strokeWidth="1.5"
            opacity="0.6"
          />
          <text x="130" y="35" textAnchor="middle" fontSize="8" className="fill-text-tertiary">
            {t("education.eustachian.middleEar")}
          </text>

          {/* Tympanic membrane (left wall) */}
          <line x1="65" y1="55" x2="65" y2="145" stroke="#c4a46c" strokeWidth="3" />
          <text x="50" y="100" textAnchor="middle" fontSize="6" className="fill-text-tertiary" transform="rotate(-90, 50, 100)">
            {t("education.eustachian.tympanum")}
          </text>

          {/* Ossicles simplified */}
          <g>
            <circle cx="80" cy="80" r="3" fill="#8b7355" />
            <line x1="80" y1="80" x2="95" y2="75" stroke="#8b7355" strokeWidth="2" strokeLinecap="round" />
            <circle cx="95" cy="75" r="2.5" fill="#8b7355" />
            <line x1="95" y1="75" x2="105" y2="78" stroke="#8b7355" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="105" cy="78" r="2" fill="#8b7355" />
          </g>
          <text x="93" y="67" textAnchor="middle" fontSize="5" className="fill-text-tertiary">
            {t("education.eustachian.ossicles")}
          </text>

          {/* Cochlea */}
          <ellipse cx="115" cy="80" rx="6" ry="8" fill="none" stroke="#a29bfe" strokeWidth="1.5" />
          <ellipse cx="115" cy="80" rx="3" ry="4" fill="none" stroke="#a29bfe" strokeWidth="1" />

          {/* Eustachian tube */}
          <path
            d={tubeOpen
              ? "M 140 150 Q 160 165 190 180 Q 210 190 240 195 Q 255 198 265 195"
              : "M 140 150 Q 160 168 190 182 Q 210 190 240 194 Q 255 196 265 194"
            }
            fill="none"
            stroke="#e17055"
            strokeWidth={tubeBlocked ? "6" : "4"}
            strokeLinecap="round"
            opacity={tubeBlocked ? 0.5 : 0.8}
          >
            {state === "swallowing" && (
              <animate attributeName="stroke-width" values="4;8;4" dur="1.5s" repeatCount="2" />
            )}
          </path>
          {/* Tube walls */}
          <path
            d={tubeOpen
              ? "M 140 145 Q 160 158 190 172 Q 210 182 240 187 Q 255 190 265 187"
              : "M 140 146 Q 160 162 190 176 Q 210 185 240 189 Q 255 191 265 189"
            }
            fill="none"
            stroke="#e17055"
            strokeWidth="1"
            opacity="0.4"
          />
          <path
            d={tubeOpen
              ? "M 140 155 Q 160 172 190 188 Q 210 198 240 203 Q 255 206 265 203"
              : "M 140 154 Q 160 174 190 188 Q 210 196 240 199 Q 255 201 265 199"
            }
            fill="none"
            stroke="#e17055"
            strokeWidth="1"
            opacity="0.4"
          />

          {/* Tube label */}
          <text x="200" y="170" textAnchor="middle" fontSize="7" className="fill-text-tertiary">
            {t("education.eustachian.tube")}
          </text>

          {/* Nasopharynx */}
          <rect x="255" y="180" width="40" height="35" rx="8" fill="#fab1a0" opacity="0.4" stroke="#e17055" strokeWidth="1" />
          <text x="275" y="200" textAnchor="middle" fontSize="5.5" className="fill-text-tertiary">
            {t("education.eustachian.nasopharynx")}
          </text>

          {/* Air flow arrows during swallowing */}
          {state === "swallowing" && (
            <g>
              <circle r="3" fill="#55efc4" opacity="0.8">
                <animateMotion dur="1.5s" repeatCount="2" path="M 265 195 Q 240 195 210 190 Q 180 180 160 165 Q 150 155 140 150" />
                <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1.5s" repeatCount="2" />
              </circle>
              <circle r="2" fill="#55efc4" opacity="0.6">
                <animateMotion dur="1.5s" repeatCount="2" begin="0.3s" path="M 265 195 Q 240 195 210 190 Q 180 180 160 165 Q 150 155 140 150" />
              </circle>
              <text x="200" y="210" textAnchor="middle" fontSize="6" fill="#55efc4" fontWeight="bold">
                {t("education.eustachian.airFlow")}
              </text>
            </g>
          )}

          {/* Blocked tube indicator */}
          {tubeBlocked && (
            <g>
              <line x1="195" y1="175" x2="215" y2="195" stroke="#e74c3c" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="215" y1="175" x2="195" y2="195" stroke="#e74c3c" strokeWidth="2.5" strokeLinecap="round" />
              <rect x="188" y="177" width="35" height="12" rx="3" fill="#e74c3c" opacity="0.3" />
              <text x="205" y="186" textAnchor="middle" fontSize="5.5" fill="#e74c3c" fontWeight="bold">
                {t("education.eustachian.blocked")}
              </text>
            </g>
          )}

          {/* Fluid accumulation in middle ear */}
          {hasFluid && (
            <g>
              <defs>
                <clipPath id="middle-ear-clip">
                  <path d="M 80 50 L 180 40 C 190 38 195 45 195 55 L 195 130 C 195 140 190 148 180 150 L 80 155 C 70 156 65 150 65 140 L 65 65 C 65 55 70 48 80 50 Z" />
                </clipPath>
              </defs>
              <g clipPath="url(#middle-ear-clip)">
                <rect x="60" y="100" width="140" height="60" fill="rgba(116,185,255,0.4)">
                  <animate attributeName="y" values="130;100;100" dur="3s" fill="freeze" />
                </rect>
                <path
                  d="M 60 105 Q 90 100 120 105 Q 150 110 180 105 Q 200 100 210 105"
                  fill="none"
                  stroke="rgba(116,185,255,0.6)"
                  strokeWidth="1.5"
                >
                  <animate
                    attributeName="d"
                    values="M 60 130 Q 90 128 120 130 Q 150 132 180 130 Q 200 128 210 130;M 60 105 Q 90 102 120 105 Q 150 108 180 105 Q 200 102 210 105;M 60 103 Q 90 106 120 103 Q 150 100 180 103 Q 200 106 210 103"
                    dur="3s"
                    fill="freeze"
                  />
                </path>
                {/* Bubbles */}
                <circle cx="100" cy="130" r="2" fill="rgba(255,255,255,0.3)">
                  <animate attributeName="cy" values="140;110;140" dur="4s" repeatCount="indefinite" />
                </circle>
                <circle cx="150" cy="135" r="1.5" fill="rgba(255,255,255,0.25)">
                  <animate attributeName="cy" values="145;115;145" dur="3.5s" repeatCount="indefinite" />
                </circle>
              </g>
            </g>
          )}

          {/* Pressure indicator */}
          {state === "blocked" && (
            <g>
              <text x="130" y="110" textAnchor="middle" fontSize="14" fill="#e74c3c" opacity="0.5">
                <animate attributeName="opacity" values="0.3;0.7;0.3" dur="2s" repeatCount="indefinite" />
                -
              </text>
              <text x="130" y="125" textAnchor="middle" fontSize="5.5" fill="#e74c3c">
                {t("education.eustachian.negativePressure")}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Controls */}
      <div className="w-full lg:w-80">
        <div className="rounded-xl border border-border-secondary bg-bg-secondary p-4">
          <h4 className="mb-3 text-sm font-semibold text-text-primary">
            {t("education.eustachian.demos")}
          </h4>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => runDemo("swallowing")}
              disabled={animating}
              className="flex w-full items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2.5 text-left text-sm text-green-400 transition-colors hover:bg-green-500/20 disabled:opacity-50"
            >
              <Play size={14} />
              {t("education.eustachian.demoSwallow")}
            </button>
            <button
              type="button"
              onClick={() => setState("blocked")}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                state === "blocked" ? "bg-orange-500/20 text-orange-400" : "bg-orange-500/10 text-orange-400 hover:bg-orange-500/20"
              }`}
            >
              <Play size={14} />
              {t("education.eustachian.demoBlocked")}
            </button>
            <button
              type="button"
              onClick={() => runDemo("effusion")}
              disabled={animating}
              className="flex w-full items-center gap-2 rounded-lg bg-blue-500/10 px-3 py-2.5 text-left text-sm text-blue-400 transition-colors hover:bg-blue-500/20 disabled:opacity-50"
            >
              <Play size={14} />
              {t("education.eustachian.demoEffusion")}
            </button>
            <button
              type="button"
              onClick={() => { setState("idle"); setAnimating(false); }}
              className="flex w-full items-center gap-2 rounded-lg bg-bg-tertiary px-3 py-2.5 text-left text-sm text-text-secondary transition-colors hover:bg-bg-primary"
            >
              <RotateCcw size={14} />
              {t("education.eustachian.reset")}
            </button>
          </div>
        </div>

        {/* Info card */}
        <div className="mt-3 rounded-xl border border-accent bg-accent-subtle p-4">
          <h5 className="text-sm font-semibold text-accent-text">
            {t(`education.eustachian.info_${state}`)}
          </h5>
          <p className="mt-1 text-sm text-text-secondary leading-relaxed">
            {t(`education.eustachian.infoDesc_${state}`)}
          </p>
        </div>
      </div>
    </div>
  );
}

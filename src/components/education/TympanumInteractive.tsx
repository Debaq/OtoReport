import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";

type Pathology =
  | "normal"
  | "retraction"
  | "perforation"
  | "effusion"
  | "tympanosclerosis"
  | "otitis_media";

interface PathologyOption {
  id: Pathology;
  labelKey: string;
  descKey: string;
  color: string;
}

const PATHOLOGIES: PathologyOption[] = [
  { id: "normal", labelKey: "education.tympanum.normal", descKey: "education.tympanum.normalDesc", color: "#55efc4" },
  { id: "retraction", labelKey: "education.tympanum.retraction", descKey: "education.tympanum.retractionDesc", color: "#fdcb6e" },
  { id: "perforation", labelKey: "education.tympanum.perforation", descKey: "education.tympanum.perforationDesc", color: "#e17055" },
  { id: "effusion", labelKey: "education.tympanum.effusion", descKey: "education.tympanum.effusionDesc", color: "#74b9ff" },
  { id: "tympanosclerosis", labelKey: "education.tympanum.tympanosclerosis", descKey: "education.tympanum.tympanosclerosisDesc", color: "#dfe6e9" },
  { id: "otitis_media", labelKey: "education.tympanum.otitisMedia", descKey: "education.tympanum.otitisMediaDesc", color: "#ff7675" },
];

const QUADRANT_LABELS = [
  { key: "education.tympanum.anteriorSuperior", x: 115, y: 88 },
  { key: "education.tympanum.posteriorSuperior", x: 185, y: 88 },
  { key: "education.tympanum.anteriorInferior", x: 115, y: 172 },
  { key: "education.tympanum.posteriorInferior", x: 185, y: 172 },
];

export function TympanumInteractive() {
  const { t } = useTranslation();
  const [pathology, setPathology] = useState<Pathology>("normal");
  const [showLabels, setShowLabels] = useState(true);

  const getMembraneColor = () => {
    switch (pathology) {
      case "normal": return "#f5deb3";
      case "retraction": return "#e8c88a";
      case "perforation": return "#f5deb3";
      case "effusion": return "#deb887";
      case "tympanosclerosis": return "#f5deb3";
      case "otitis_media": return "#e8a090";
    }
  };

  const getMembraneOpacity = () => {
    switch (pathology) {
      case "effusion": return 0.7;
      default: return 1;
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start">
      <div className="relative w-full max-w-md">
        <svg
          viewBox="50 30 200 210"
          className="w-full rounded-xl border border-border-secondary bg-bg-tertiary"
          style={{ minHeight: 320 }}
        >
          {/* Outer ear canal ring */}
          <ellipse cx="150" cy="130" rx="75" ry="80" fill="none" stroke="#8b7355" strokeWidth="3" opacity="0.5" />

          {/* Tympanic membrane */}
          <ellipse
            cx="150" cy="130" rx="65" ry="70"
            fill={getMembraneColor()}
            opacity={getMembraneOpacity()}
            stroke="#c4a46c"
            strokeWidth="1.5"
          >
            {pathology === "otitis_media" && (
              <animate attributeName="fill" values="#e8a090;#d4756a;#e8a090" dur="2s" repeatCount="indefinite" />
            )}
          </ellipse>

          {/* Annulus */}
          <ellipse cx="150" cy="130" rx="65" ry="70" fill="none" stroke="#c4a46c" strokeWidth="2.5" />

          {/* Quadrant lines */}
          <line x1="150" y1="60" x2="150" y2="200" stroke="rgba(139,115,85,0.3)" strokeWidth="0.5" strokeDasharray="4,4" />
          <line x1="85" y1="130" x2="215" y2="130" stroke="rgba(139,115,85,0.3)" strokeWidth="0.5" strokeDasharray="4,4" />

          {/* Malleus handle */}
          <line x1="150" y1="75" x2="150" y2="140" stroke="#8b7355" strokeWidth="2.5" strokeLinecap="round" />

          {/* Umbo */}
          <circle cx="150" cy="140" r="3" fill="#6b5340" />

          {/* Short process */}
          <circle cx="150" cy="78" r="2.5" fill="#8b7355" />
          <line x1="150" y1="78" x2="142" y2="75" stroke="#8b7355" strokeWidth="1.5" strokeLinecap="round" />

          {/* Light cone (anterior-inferior) */}
          {pathology === "normal" && (
            <path
              d="M 150 140 L 120 175 L 135 180 Z"
              fill="rgba(255,255,200,0.5)"
              stroke="rgba(255,255,200,0.3)"
              strokeWidth="0.5"
            >
              <animate attributeName="opacity" values="0.3;0.6;0.3" dur="3s" repeatCount="indefinite" />
            </path>
          )}

          {/* Pathology-specific visuals */}

          {/* Retraction: membrane pulled inward */}
          {pathology === "retraction" && (
            <g>
              <path
                d="M 130 110 Q 150 150 170 110"
                fill="none"
                stroke="#b8860b"
                strokeWidth="1"
                strokeDasharray="3,2"
              />
              <text x="150" y="135" textAnchor="middle" fontSize="6" fill="#b8860b" fontStyle="italic">
                {t("education.tympanum.retracted")}
              </text>
              {/* Arrows showing inward pull */}
              <line x1="140" y1="120" x2="148" y2="130" stroke="#b8860b" strokeWidth="1" markerEnd="url(#arrowhead)" />
              <line x1="160" y1="120" x2="152" y2="130" stroke="#b8860b" strokeWidth="1" markerEnd="url(#arrowhead)" />
            </g>
          )}

          {/* Perforation */}
          {pathology === "perforation" && (
            <g>
              <ellipse cx="140" cy="160" rx="15" ry="12" fill="#2d2318" stroke="#8b7355" strokeWidth="1">
                <animate attributeName="rx" values="15;16;15" dur="4s" repeatCount="indefinite" />
                <animate attributeName="ry" values="12;13;12" dur="4s" repeatCount="indefinite" />
              </ellipse>
              <text x="140" y="162" textAnchor="middle" fontSize="5" fill="#ddd" fontStyle="italic">
                {t("education.tympanum.hole")}
              </text>
            </g>
          )}

          {/* Effusion: fluid level with animation */}
          {pathology === "effusion" && (
            <g>
              <defs>
                <clipPath id="membrane-clip">
                  <ellipse cx="150" cy="130" rx="63" ry="68" />
                </clipPath>
              </defs>
              <g clipPath="url(#membrane-clip)">
                <rect x="85" y="140" width="130" height="60" fill="rgba(116,185,255,0.4)">
                  <animate attributeName="y" values="145;140;145" dur="4s" repeatCount="indefinite" />
                </rect>
                {/* Fluid surface wave */}
                <path
                  d="M 85 145 Q 110 140 130 145 Q 150 150 170 145 Q 190 140 215 145"
                  fill="none"
                  stroke="rgba(116,185,255,0.6)"
                  strokeWidth="1.5"
                >
                  <animate
                    attributeName="d"
                    values="M 85 145 Q 110 140 130 145 Q 150 150 170 145 Q 190 140 215 145;M 85 143 Q 110 148 130 143 Q 150 138 170 143 Q 190 148 215 143;M 85 145 Q 110 140 130 145 Q 150 150 170 145 Q 190 140 215 145"
                    dur="3s"
                    repeatCount="indefinite"
                  />
                </path>
                {/* Air bubbles */}
                <circle cx="130" cy="165" r="2" fill="rgba(255,255,255,0.4)">
                  <animate attributeName="cy" values="170;155;170" dur="5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0.7;0.4" dur="5s" repeatCount="indefinite" />
                </circle>
                <circle cx="165" cy="170" r="1.5" fill="rgba(255,255,255,0.3)">
                  <animate attributeName="cy" values="175;160;175" dur="4s" repeatCount="indefinite" />
                </circle>
              </g>
            </g>
          )}

          {/* Tympanosclerosis: white calcified patches */}
          {pathology === "tympanosclerosis" && (
            <g>
              <ellipse cx="130" cy="150" rx="10" ry="8" fill="rgba(255,255,255,0.8)" stroke="#ccc" strokeWidth="0.5" />
              <ellipse cx="170" cy="115" rx="8" ry="6" fill="rgba(255,255,255,0.7)" stroke="#ccc" strokeWidth="0.5" />
              <ellipse cx="155" cy="165" rx="6" ry="5" fill="rgba(255,255,255,0.6)" stroke="#ccc" strokeWidth="0.5" />
              <circle cx="125" cy="110" r="4" fill="rgba(255,255,255,0.5)" stroke="#ccc" strokeWidth="0.5" />
            </g>
          )}

          {/* Otitis media: redness and bulging */}
          {pathology === "otitis_media" && (
            <g>
              {/* Radial redness */}
              <ellipse cx="150" cy="130" rx="50" ry="55" fill="rgba(255,100,100,0.15)">
                <animate attributeName="rx" values="48;52;48" dur="2s" repeatCount="indefinite" />
                <animate attributeName="ry" values="53;57;53" dur="2s" repeatCount="indefinite" />
              </ellipse>
              {/* Vessels */}
              <path d="M 100 100 Q 120 110 135 105" fill="none" stroke="rgba(255,80,80,0.5)" strokeWidth="0.8" />
              <path d="M 200 105 Q 180 115 165 108" fill="none" stroke="rgba(255,80,80,0.5)" strokeWidth="0.8" />
              <path d="M 105 160 Q 125 155 140 162" fill="none" stroke="rgba(255,80,80,0.4)" strokeWidth="0.6" />
              <path d="M 195 155 Q 175 150 162 158" fill="none" stroke="rgba(255,80,80,0.4)" strokeWidth="0.6" />
            </g>
          )}

          {/* Quadrant labels */}
          {showLabels && QUADRANT_LABELS.map((q) => (
            <text key={q.key} x={q.x} y={q.y} textAnchor="middle" fontSize="5.5" fill="currentColor" opacity="0.5">
              {t(q.key)}
            </text>
          ))}

          {/* Landmark labels */}
          {showLabels && (
            <g fontSize="5.5" fill="currentColor" opacity="0.6">
              <text x="158" y="77">{t("education.tympanum.shortProcess")}</text>
              <text x="158" y="142">{t("education.tympanum.umbo")}</text>
              <text x="158" y="100">{t("education.tympanum.malleusHandle")}</text>
              {pathology === "normal" && (
                <text x="118" y="170" fontSize="5" fontStyle="italic">{t("education.tympanum.lightCone")}</text>
              )}
            </g>
          )}

          {/* Arrow marker def */}
          <defs>
            <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
              <polygon points="0 0, 6 2, 0 4" fill="#b8860b" />
            </marker>
          </defs>
        </svg>
      </div>

      {/* Controls */}
      <div className="w-full lg:w-80">
        <div className="rounded-xl border border-border-secondary bg-bg-secondary p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-text-primary">
              {t("education.tympanum.selectPathology")}
            </h4>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-text-tertiary cursor-pointer">
                <input
                  type="checkbox"
                  checked={showLabels}
                  onChange={(e) => setShowLabels(e.target.checked)}
                  className="accent-accent"
                />
                {t("education.tympanum.labels")}
              </label>
              <button
                type="button"
                onClick={() => setPathology("normal")}
                className="rounded-lg p-1.5 text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary"
                title={t("education.tympanum.reset")}
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          <div className="space-y-1">
            {PATHOLOGIES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPathology(p.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  pathology === p.id
                    ? "bg-accent-subtle text-accent-text"
                    : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                }`}
              >
                <div
                  className="h-3 w-3 rounded-full flex-shrink-0 border border-white/20"
                  style={{ backgroundColor: p.color }}
                />
                {t(p.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="mt-3 rounded-xl border border-accent bg-accent-subtle p-4">
          <h5 className="text-sm font-semibold text-accent-text">
            {t(PATHOLOGIES.find((p) => p.id === pathology)!.labelKey)}
          </h5>
          <p className="mt-1 text-sm text-text-secondary leading-relaxed">
            {t(PATHOLOGIES.find((p) => p.id === pathology)!.descKey)}
          </p>
        </div>
      </div>
    </div>
  );
}

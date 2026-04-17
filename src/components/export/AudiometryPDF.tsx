import { Document, Page, Text, View, StyleSheet, Svg, Line, Path, Rect, Circle, G } from "@react-pdf/renderer";
import type { AudiometryReport, AudiogramEar, AudiogramEarSide, FowlerData, RegerData, SisiData, WorkspaceConfig } from "@/types";
import { AUDIOGRAM_FREQUENCIES, classifyHearingLoss, SUPRALIMINAR_TEST_LABELS, sisiScore, classifySisi, classifyBalance, BALANCE_CLASS_LABELS, BALANCE_CLASS_COLORS } from "@/types";

type SeriesKind = "air" | "bone" | "ldl";

const EAR_COLORS = { right: "#dc2626", left: "#2563eb" };

const CLASS_LABELS: Record<string, string> = {
  normal: "Audición normal",
  mild: "Hipoacusia leve",
  moderate: "Hipoacusia moderada",
  moderate_severe: "Hipoacusia moderada-severa",
  severe: "Hipoacusia severa",
  profound: "Hipoacusia profunda",
  "—": "—",
};

const WEBER_LBL: Record<string, string> = {
  not_performed: "No realizado",
  central: "Central",
  lateralized_right: "Lateraliza OD",
  lateralized_left: "Lateraliza OI",
  normal: "Normal",
};
const RINNE_LBL: Record<string, string> = {
  not_performed: "No realizado",
  positive: "Positivo (+)",
  negative: "Negativo (-)",
  neutral: "Neutro",
};
const SCHW_LBL: Record<string, string> = {
  not_performed: "No realizado",
  normal: "Normal",
  shortened: "Acortado",
  lengthened: "Alargado",
};

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica" },
  h1: { fontSize: 14, fontWeight: "bold", marginBottom: 4, color: "#1f2937" },
  h2: { fontSize: 11, fontWeight: "bold", marginTop: 10, marginBottom: 4, color: "#374151" },
  h3: { fontSize: 10, fontWeight: "bold", marginBottom: 2, color: "#4b5563" },
  row: { flexDirection: "row", gap: 12 },
  col: { flex: 1 },
  box: { border: "1 solid #e5e7eb", padding: 6, borderRadius: 4, marginBottom: 6 },
  kv: { flexDirection: "row", marginBottom: 1 },
  k: { width: 90, color: "#6b7280", fontSize: 8 },
  v: { flex: 1, color: "#1f2937", fontSize: 8 },
  small: { fontSize: 8, color: "#4b5563" },
  table: { marginTop: 4 },
  tr: { flexDirection: "row", borderBottom: "0.5 solid #e5e7eb", paddingVertical: 2 },
  th: { flex: 1, fontSize: 7, fontWeight: "bold", color: "#374151" },
  td: { flex: 1, fontSize: 7, color: "#4b5563" },
});

// Audiograma SVG params (combinado)
const AW = 540;
const AH = 340;
const APL = 38, APT = 22, APR = 12, APB = 24;
const plotW = AW - APL - APR;
const plotH = AH - APT - APB;
const MIN_DB = -10, MAX_DB = 120;

function xFor(i: number) { return APL + (i * plotW) / (AUDIOGRAM_FREQUENCIES.length - 1); }
function yFor(db: number) { return APT + ((db - MIN_DB) * plotH) / (MAX_DB - MIN_DB); }
const BONE_OFF = 5;
function xOff(ear: AudiogramEarSide, kind: SeriesKind) {
  if (kind !== "bone") return 0;
  return ear === "right" ? -BONE_OFF : BONE_OFF;
}

function renderAshaSymbol(cx: number, cy: number, ear: AudiogramEarSide, kind: SeriesKind, masked: boolean, noResponse: boolean, symbolSet: "asha" | "chile" = "asha") {
  const color = EAR_COLORS[ear];
  const s = 4;
  const sw = 1;
  const els: React.ReactNode[] = [];
  els.push(<Circle key="bg" cx={cx} cy={cy} r={s + 1} fill="white" stroke="none" />);
  if (kind === "air" && !masked) {
    if (ear === "right") els.push(<Circle key="s" cx={cx} cy={cy} r={s} fill="white" stroke={color} strokeWidth={sw} />);
    else els.push(
      <Line key="a" x1={cx - s} y1={cy - s} x2={cx + s} y2={cy + s} stroke={color} strokeWidth={sw} />,
      <Line key="b" x1={cx - s} y1={cy + s} x2={cx + s} y2={cy - s} stroke={color} strokeWidth={sw} />
    );
  } else if (kind === "air" && masked) {
    if (ear === "right") els.push(<Path key="s" d={`M${cx - s} ${cy + s} L${cx} ${cy - s} L${cx + s} ${cy + s} Z`} fill="white" stroke={color} strokeWidth={sw} />);
    else els.push(<Rect key="s" x={cx - s} y={cy - s} width={s * 2} height={s * 2} fill="white" stroke={color} strokeWidth={sw} />);
  } else if (kind === "bone" && !masked) {
    if (ear === "right") els.push(<Path key="s" d={`M${cx - s} ${cy - s} L${cx} ${cy} L${cx - s} ${cy + s}`} fill="none" stroke={color} strokeWidth={sw} />);
    else els.push(<Path key="s" d={`M${cx + s} ${cy - s} L${cx} ${cy} L${cx + s} ${cy + s}`} fill="none" stroke={color} strokeWidth={sw} />);
  } else if (kind === "bone" && masked) {
    if (ear === "right") els.push(<Path key="s" d={`M${cx} ${cy - s} L${cx - s} ${cy - s} L${cx - s} ${cy + s} L${cx} ${cy + s}`} fill="none" stroke={color} strokeWidth={sw} />);
    else els.push(<Path key="s" d={`M${cx} ${cy - s} L${cx + s} ${cy - s} L${cx + s} ${cy + s} L${cx} ${cy + s}`} fill="none" stroke={color} strokeWidth={sw} />);
  } else {
    if (symbolSet === "chile") {
      const GAP = s * 0.5;
      const H = s * 1.2;
      const WLEG = s * 1.0;
      const d = ear === "right"
        ? `M${cx - GAP} ${cy} L${cx - GAP} ${cy + 2 * H} L${cx - GAP - WLEG} ${cy + 2 * H} Z`
        : `M${cx + GAP} ${cy} L${cx + GAP} ${cy + 2 * H} L${cx + GAP + WLEG} ${cy + 2 * H} Z`;
      els.push(<Path key="s" d={d} fill="none" stroke={color} strokeWidth={sw} />);
    } else {
      els.push(<Text key="s" x={cx - s / 2 - 0.5} y={cy + s - 0.5} style={{ fontSize: s * 2, fontWeight: "bold" }} fill={color}>U</Text>);
    }
  }
  if (noResponse) {
    const dir = ear === "right" ? -1 : 1;
    els.push(
      <Path
        key="nr"
        d={`M${cx} ${cy + s} L${cx + dir * (s + 4)} ${cy + s + 6} M${cx + dir * (s + 4)} ${cy + s + 6} L${cx + dir * (s + 1)} ${cy + s + 2} M${cx + dir * (s + 4)} ${cy + s + 6} L${cx + dir * (s + 7)} ${cy + s + 2}`}
        stroke={color}
        strokeWidth={sw}
        fill="none"
      />
    );
  }
  return <G>{els}</G>;
}

function makeLine(pts: AudiogramEar["air"], ear: AudiogramEarSide, kind: SeriesKind) {
  const off = xOff(ear, kind);
  const sorted = [...pts].sort((a, b) => a.frequency - b.frequency).filter((p) => !p.noResponse);
  return sorted.map((p, i) => {
    const idx = AUDIOGRAM_FREQUENCIES.indexOf(p.frequency as any);
    return `${i === 0 ? "M" : "L"}${xFor(idx) + off} ${yFor(p.threshold)}`;
  }).join(" ");
}

function CombinedAudiogramSvg({ right, left, symbolSet = "asha" }: { right: AudiogramEar; left: AudiogramEar; symbolSet?: "asha" | "chile" }) {
  const series: { ear: AudiogramEarSide; kind: SeriesKind; pts: AudiogramEar["air"] }[] = [
    { ear: "right", kind: "air", pts: right.air },
    { ear: "right", kind: "bone", pts: right.bone },
    { ear: "right", kind: "ldl", pts: right.ldl ?? [] },
    { ear: "left", kind: "air", pts: left.air },
    { ear: "left", kind: "bone", pts: left.bone },
    { ear: "left", kind: "ldl", pts: left.ldl ?? [] },
  ];
  return (
    <Svg width={AW} height={AH} viewBox={`0 0 ${AW} ${AH}`}>
      {Array.from({ length: (MAX_DB - MIN_DB) / 10 + 1 }).map((_, i) => {
        const db = MIN_DB + i * 10;
        const y = yFor(db);
        return (
          <G key={`h${db}`}>
            <Line x1={APL} y1={y} x2={AW - APR} y2={y} stroke="#e5e7eb" strokeWidth={0.3} />
            <Text x={APL - 4} y={y + 2} style={{ fontSize: 6 }} fill="#6b7280">{db}</Text>
          </G>
        );
      })}
      {AUDIOGRAM_FREQUENCIES.map((f, i) => {
        const x = xFor(i);
        return (
          <G key={`v${f}`}>
            <Line x1={x} y1={APT} x2={x} y2={AH - APB} stroke="#e5e7eb" strokeWidth={0.3} />
            <Text x={x - 6} y={APT - 6} style={{ fontSize: 6 }} fill="#6b7280">{f >= 1000 ? `${f / 1000}k` : f}</Text>
          </G>
        );
      })}
      <Rect x={APL} y={APT} width={plotW} height={plotH} fill="none" stroke="#9ca3af" strokeWidth={0.5} />
      {series.map((s) => (
        <Path
          key={`ln-${s.ear}-${s.kind}`}
          d={makeLine(s.pts, s.ear, s.kind)}
          fill="none"
          stroke={EAR_COLORS[s.ear]}
          strokeWidth={0.8}
          strokeDasharray={s.kind === "bone" ? "2 2" : s.kind === "ldl" ? "1 2" : undefined}
        />
      ))}
      {series.map((s) =>
        s.pts.map((p) => {
          const idx = AUDIOGRAM_FREQUENCIES.indexOf(p.frequency as any);
          return (
            <G key={`pt-${s.ear}-${s.kind}-${p.frequency}`}>
              {renderAshaSymbol(xFor(idx) + xOff(s.ear, s.kind), yFor(p.threshold), s.ear, s.kind, p.masked, p.noResponse, symbolSet)}
            </G>
          );
        })
      )}
    </Svg>
  );
}

// Mini-audiograma reutilizable para pruebas supraliminares
const MW = 380, MH = 180;
const MPL = 28, MPT = 14, MPR = 14, MPB = 18;
const MplotW = MW - MPL - MPR;
const MplotH = MH - MPT - MPB;
function mxFor(i: number) { return MPL + (i * MplotW) / (AUDIOGRAM_FREQUENCIES.length - 1); }
function myFor(db: number) { return MPT + ((db - -10) * MplotH) / (120 - -10); }

function MiniGrid({ highlight }: { highlight: { x: number; color: string }[] }) {
  return (
    <G>
      {Array.from({ length: 14 }, (_, i) => {
        const db = -10 + i * 10;
        const y = myFor(db);
        return (
          <G key={db}>
            <Line x1={MPL} y1={y} x2={MW - MPR} y2={y} stroke="#e5e7eb" strokeWidth={0.3} />
            <Text x={MPL - 4} y={y + 1.5} style={{ fontSize: 4 }} fill="#9ca3af">{db}</Text>
          </G>
        );
      })}
      {AUDIOGRAM_FREQUENCIES.map((f, i) => {
        const x = mxFor(i);
        return (
          <G key={f}>
            <Line x1={x} y1={MPT} x2={x} y2={MH - MPB} stroke="#e5e7eb" strokeWidth={0.3} />
            <Text x={x - 4} y={MPT - 3} style={{ fontSize: 4 }} fill="#9ca3af">{f >= 1000 ? `${f / 1000}k` : f}</Text>
          </G>
        );
      })}
      {highlight.map((h, i) => (
        <Rect key={i} x={h.x - 9} y={MPT} width={18} height={MplotH} fill={h.color} opacity={0.4} />
      ))}
      <Rect x={MPL} y={MPT} width={MplotW} height={MplotH} fill="none" stroke="#9ca3af" strokeWidth={0.4} />
    </G>
  );
}

function FowlerPdf({ data }: { data: FowlerData }) {
  const betterEar: AudiogramEarSide = data.reference_ear === "right" ? "left" : "right";
  const refEarLabel = data.reference_ear === "right" ? "OD" : "OI";
  const matchEarLabel = betterEar === "right" ? "OD" : "OI";
  const idx = AUDIOGRAM_FREQUENCIES.indexOf(data.frequency as any);
  const xCol = mxFor(Math.max(0, idx));
  const refOff = data.reference_ear === "right" ? -5 : 5;
  const xRef = xCol + refOff;
  const xMatch = xCol - refOff;
  const steps = data.matches.length;
  const refLevels = Array.from({ length: steps }, (_, i) => Math.min(120, data.threshold_db + i * data.step_db));
  return (
    <Svg width={MW} height={MH} viewBox={`0 0 ${MW} ${MH}`}>
      <MiniGrid highlight={[{ x: xCol, color: "#fef3c7" }]} />
      <Text x={MW / 2 - 50} y={MH - 4} style={{ fontSize: 5 }} fill="#6b7280">
        Fowler (ABLB) · {data.frequency >= 1000 ? data.frequency / 1000 + "k" : data.frequency} Hz · peor: {refEarLabel} · mejor: {matchEarLabel}
      </Text>
      {refLevels.map((ref, i) => {
        const m = data.matches[i];
        if (m === null || m === undefined) return null;
        return <Line key={`ln${i}`} x1={xRef} y1={myFor(ref)} x2={xMatch} y2={myFor(m)} stroke="#374151" strokeWidth={0.4} />;
      })}
      {refLevels.map((ref, i) => (
        <G key={`ref${i}`}>{renderAshaSymbol(xRef, myFor(ref), data.reference_ear, "air", false, false)}</G>
      ))}
      {data.matches.map((m, i) => {
        if (m === null || m === undefined) return null;
        return <G key={`m${i}`}>{renderAshaSymbol(xMatch, myFor(m), betterEar, "air", false, false)}</G>;
      })}
    </Svg>
  );
}

function RegerPdf({ data }: { data: RegerData }) {
  const refIdx = AUDIOGRAM_FREQUENCIES.indexOf(data.reference_frequency as any);
  const cmpIdx = AUDIOGRAM_FREQUENCIES.indexOf(data.comparison_frequency as any);
  const xRef = mxFor(Math.max(0, refIdx));
  const xCmp = mxFor(Math.max(0, cmpIdx));
  const steps = data.matches.length;
  const refLevels = Array.from({ length: steps }, (_, i) => Math.min(120, data.threshold_db + i * data.step_db));
  const lbl = (f: number) => f >= 1000 ? `${f / 1000}k` : `${f}`;
  return (
    <Svg width={MW} height={MH} viewBox={`0 0 ${MW} ${MH}`}>
      <MiniGrid highlight={[{ x: xRef, color: "#fee2e2" }, { x: xCmp, color: "#dbeafe" }]} />
      <Text x={MW / 2 - 60} y={MH - 4} style={{ fontSize: 5 }} fill="#6b7280">
        Reger (MBLB) · {data.ear === "right" ? "OD" : "OI"} · peor: {lbl(data.reference_frequency)} Hz · mejor: {lbl(data.comparison_frequency)} Hz
      </Text>
      {refLevels.map((ref, i) => {
        const m = data.matches[i];
        if (m === null || m === undefined) return null;
        return <Line key={`ln${i}`} x1={xRef} y1={myFor(ref)} x2={xCmp} y2={myFor(m)} stroke="#374151" strokeWidth={0.4} />;
      })}
      {refLevels.map((ref, i) => (
        <G key={`ref${i}`}>{renderAshaSymbol(xRef, myFor(ref), data.ear, "air", false, false)}</G>
      ))}
      {data.matches.map((m, i) => {
        if (m === null || m === undefined) return null;
        return <G key={`m${i}`}>{renderAshaSymbol(xCmp, myFor(m), data.ear, "air", false, false)}</G>;
      })}
    </Svg>
  );
}

function SisiPdf({ data }: { data: SisiData }) {
  const score = sisiScore(data);
  const cls = classifySisi(score);
  const clsLbl: Record<string, string> = {
    low: "Bajo (sin reclutamiento)",
    intermediate: "Intermedio (dudoso)",
    high: "Alto (reclutamiento positivo)",
  };
  const clsColor: Record<string, string> = { low: "#059669", intermediate: "#d97706", high: "#dc2626" };
  const hits = data.trials.filter(Boolean).length;
  const freqLbl = data.frequency >= 1000 ? `${data.frequency / 1000}k` : `${data.frequency}`;
  return (
    <View style={{ marginTop: 2 }}>
      <Text style={{ fontSize: 7, color: "#374151" }}>
        {freqLbl} Hz · {data.presentation_db} dB ({data.sl_db} dB SL) · {data.trials.length} presentaciones · paso {data.test_increment_db} dB
      </Text>
      <Text style={{ fontSize: 8, fontWeight: "bold", color: clsColor[cls] }}>
        {hits}/{data.trials.length} = {score}% · {clsLbl[cls]}
      </Text>
    </View>
  );
}

interface Props {
  report: AudiometryReport;
  config: WorkspaceConfig;
}

export function AudiometryPDF({ report, config }: Props) {
  const date = new Date(report.created_at).toLocaleDateString("es-CL");
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={{ marginBottom: 8, borderBottom: "1 solid #9ca3af", paddingBottom: 6 }}>
          <Text style={styles.h1}>Informe de Audiometría</Text>
          {config.center_name && <Text style={styles.small}>{config.center_name}</Text>}
          {config.center_address && <Text style={styles.small}>{config.center_address}</Text>}
        </View>

        <View style={styles.row}>
          <View style={styles.col}>
            <View style={styles.kv}><Text style={styles.k}>Paciente:</Text><Text style={styles.v}>{report.patient.name}</Text></View>
            <View style={styles.kv}><Text style={styles.k}>ID:</Text><Text style={styles.v}>{report.patient.rut}</Text></View>
            <View style={styles.kv}><Text style={styles.k}>Edad:</Text><Text style={styles.v}>{report.patient.age} años</Text></View>
          </View>
          <View style={styles.col}>
            <View style={styles.kv}><Text style={styles.k}>Fecha:</Text><Text style={styles.v}>{date}</Text></View>
            <View style={styles.kv}><Text style={styles.k}>Examinador:</Text><Text style={styles.v}>{report.examiner}</Text></View>
            <View style={styles.kv}><Text style={styles.k}>Equipo:</Text><Text style={styles.v}>{report.equipment}</Text></View>
          </View>
        </View>

        <Text style={styles.h2}>Audiograma tonal</Text>
        <View style={{ alignItems: "center" }}>
          <CombinedAudiogramSvg right={report.right_audiogram} left={report.left_audiogram} symbolSet={(config.audiometry_symbol_set as "asha" | "chile") || "asha"} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
          <Text style={[styles.small, { color: EAR_COLORS.right }]}>OD: O aérea · Δ aérea-M · &lt; ósea · [ ósea-M · {(config.audiometry_symbol_set || "asha") === "chile" ? "◁ LDL" : "U LDL"}</Text>
          <Text style={[styles.small, { color: EAR_COLORS.left }]}>OI: X aérea · □ aérea-M · &gt; ósea · ] ósea-M · {(config.audiometry_symbol_set || "asha") === "chile" ? "▷ LDL" : "U LDL"}</Text>
          <Text style={styles.small}>Línea punteada = vía ósea · flecha = sin respuesta</Text>
        </View>

        <Text style={styles.h2}>Promedios tonales puros</Text>
        <View style={[styles.row]}>
          <View style={[styles.box, styles.col]}>
            <Text style={styles.h3}>PTA 500 / 1k / 2k Hz</Text>
            <Text style={styles.small}>OD aéreo: {report.pta.right_air ?? "—"} dB · óseo: {report.pta.right_bone ?? "—"} dB</Text>
            <Text style={styles.small}>OI aéreo: {report.pta.left_air ?? "—"} dB · óseo: {report.pta.left_bone ?? "—"} dB</Text>
            <Text style={[styles.small, { color: EAR_COLORS.right }]}>OD: {CLASS_LABELS[classifyHearingLoss(report.pta.right_air)]}</Text>
            <Text style={[styles.small, { color: EAR_COLORS.left }]}>OI: {CLASS_LABELS[classifyHearingLoss(report.pta.left_air)]}</Text>
          </View>
          <View style={[styles.box, styles.col]}>
            <Text style={styles.h3}>PTA 500 / 1k / 2k / 4k Hz</Text>
            <Text style={styles.small}>OD aéreo: {report.pta.right_air_4 ?? "—"} dB · óseo: {report.pta.right_bone_4 ?? "—"} dB</Text>
            <Text style={styles.small}>OI aéreo: {report.pta.left_air_4 ?? "—"} dB · óseo: {report.pta.left_bone_4 ?? "—"} dB</Text>
            <Text style={[styles.small, { color: EAR_COLORS.right }]}>OD: {CLASS_LABELS[classifyHearingLoss(report.pta.right_air_4)]}</Text>
            <Text style={[styles.small, { color: EAR_COLORS.left }]}>OI: {CLASS_LABELS[classifyHearingLoss(report.pta.left_air_4)]}</Text>
          </View>
        </View>

        <Text style={styles.h2}>Logoaudiometría</Text>
        <View style={[styles.row, styles.box]}>
          <View style={styles.col}>
            <Text style={[styles.h3, { color: EAR_COLORS.right }]}>OD</Text>
            <Text style={styles.small}>SRT: {report.logo_right.srt ?? "—"} dB</Text>
            <Text style={styles.small}>Discriminación: {report.logo_right.discrimination ?? "—"}% @ {report.logo_right.discrimination_intensity ?? "—"} dB</Text>
            {report.logo_right.observations && <Text style={styles.small}>{report.logo_right.observations}</Text>}
          </View>
          <View style={styles.col}>
            <Text style={[styles.h3, { color: EAR_COLORS.left }]}>OI</Text>
            <Text style={styles.small}>SRT: {report.logo_left.srt ?? "—"} dB</Text>
            <Text style={styles.small}>Discriminación: {report.logo_left.discrimination ?? "—"}% @ {report.logo_left.discrimination_intensity ?? "—"} dB</Text>
            {report.logo_left.observations && <Text style={styles.small}>{report.logo_left.observations}</Text>}
          </View>
        </View>

        {(report.supraliminar?.tests?.length ?? 0) > 0 && (
          <>
            <Text style={styles.h2}>Pruebas supraliminares realizadas</Text>
            <View style={styles.box}>
              {report.supraliminar.tests.map((t) => {
                const name = t.type === "other" && t.custom_name ? t.custom_name : SUPRALIMINAR_TEST_LABELS[t.type];
                const earLbl = t.ear === "right" ? "OD" : t.ear === "left" ? "OI" : "Bilateral";
                const earColor = t.ear === "right" ? EAR_COLORS.right : t.ear === "left" ? EAR_COLORS.left : "#374151";
                return (
                  <View key={t.id} style={{ marginBottom: 6 }}>
                    <Text style={[styles.small, { fontWeight: "bold" }]}>
                      <Text style={{ color: earColor }}>{earLbl}</Text> · {name}
                      {t.result ? `: ${t.result}` : ""}
                    </Text>
                    {t.type === "fowler" && t.fowler && (
                      <>
                        <FowlerPdf data={t.fowler} />
                        {(() => {
                          const lvls = Array.from({ length: t.fowler.matches.length }, (_, i) => Math.min(120, t.fowler!.threshold_db + i * t.fowler!.step_db));
                          const cls = classifyBalance(lvls, t.fowler.matches);
                          return (
                            <Text style={[styles.small, { fontWeight: "bold", color: BALANCE_CLASS_COLORS[cls] }]}>
                              Interpretación: {BALANCE_CLASS_LABELS[cls]}{t.fowler.diplacusia ? " + diploacusia" : ""}
                            </Text>
                          );
                        })()}
                      </>
                    )}
                    {t.type === "reger" && t.reger && (
                      <>
                        <RegerPdf data={t.reger} />
                        {(() => {
                          const lvls = Array.from({ length: t.reger.matches.length }, (_, i) => Math.min(120, t.reger!.threshold_db + i * t.reger!.step_db));
                          const cls = classifyBalance(lvls, t.reger.matches);
                          return (
                            <Text style={[styles.small, { fontWeight: "bold", color: BALANCE_CLASS_COLORS[cls] }]}>
                              Interpretación: {BALANCE_CLASS_LABELS[cls]}{t.reger.diplacusia ? " + diploacusia" : ""}
                            </Text>
                          );
                        })()}
                      </>
                    )}
                    {t.type === "sisi" && t.sisi && <SisiPdf data={t.sisi} />}
                    {t.observations ? <Text style={styles.small}>  {t.observations}</Text> : null}
                  </View>
                );
              })}
            </View>
          </>
        )}

        <Text style={styles.h2}>Acumetría</Text>
        <View style={styles.box}>
          <Text style={styles.small}>Weber: {WEBER_LBL[report.acumetry.weber]}</Text>
          <Text style={styles.small}>Rinne OD: {RINNE_LBL[report.acumetry.rinne_right]}</Text>
          <Text style={styles.small}>Rinne OI: {RINNE_LBL[report.acumetry.rinne_left]}</Text>
          <Text style={styles.small}>Schwabach: {SCHW_LBL[report.acumetry.schwabach]}</Text>
          {report.acumetry.observations && <Text style={styles.small}>{report.acumetry.observations}</Text>}
        </View>

        {report.conclusion && (
          <>
            <Text style={styles.h2}>Conclusión</Text>
            <View style={styles.box}>
              <Text style={styles.small}>{report.conclusion}</Text>
            </View>
          </>
        )}
      </Page>
    </Document>
  );
}

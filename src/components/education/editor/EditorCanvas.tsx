import { useRef, useState, useCallback } from "react";
import type {
  AnimationEditorState,
  AnimationEditorActions,
} from "@/hooks/useAnimationEditor";
import { computeAnimationState } from "@/lib/animation/animation-engine";
import { LayerRenderer } from "../animation/LayerRenderer";
import { createUniformGrid } from "@/lib/animation/mesh-warp";
import { shapeToSvgPath } from "@/lib/animation/clip-shapes";

interface EditorCanvasProps {
  state: AnimationEditorState;
  actions: AnimationEditorActions;
}

type DragType = "layer" | "mesh-point" | "handle-in" | "handle-out" | "clip-point" | "shape-prop" | "shape-point";

interface DragState {
  type: DragType;
  layerId: string;
  pointIndex?: number;
  /** For shape-prop: which svgProps keys to update */
  propKeys?: { x: string; y: string };
  startX: number;
  startY: number;
  origValue: { x: number; y: number };
}

export function EditorCanvas({ state, actions }: EditorCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<DragState | null>(null);

  const { animation, selectedLayerId, currentTime, tool } = state;
  const layerStates = computeAnimationState(animation, currentTime);
  const selectedLayer = animation.layers.find((l) => l.id === selectedLayerId);

  const toSvgCoords = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const svgPt = pt.matrixTransform(svg.getScreenCTM()?.inverse());
      return { x: svgPt.x, y: svgPt.y };
    },
    [],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!selectedLayer || selectedLayer.locked) return;
      const coords = toSvgCoords(e.clientX, e.clientY);

      if (tool === "move") {
        setDragging({
          type: "layer",
          layerId: selectedLayer.id,
          startX: coords.x,
          startY: coords.y,
          origValue: {
            x: selectedLayer.transform.x,
            y: selectedLayer.transform.y,
          },
        });
      }
    },
    [selectedLayer, tool, toSvgCoords],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      const coords = toSvgCoords(e.clientX, e.clientY);
      const dx = coords.x - dragging.startX;
      const dy = coords.y - dragging.startY;

      if (dragging.type === "layer") {
        actions.updateLayer(dragging.layerId, {
          transform: {
            ...animation.layers.find((l) => l.id === dragging.layerId)!.transform,
            x: dragging.origValue.x + dx,
            y: dragging.origValue.y + dy,
          },
        });
      } else if (dragging.type === "clip-point" && dragging.pointIndex !== undefined) {
        const layer = animation.layers.find((l) => l.id === dragging.layerId);
        if (!layer?.effectClip) return;
        const newPoints = layer.effectClip.points.map((p, i) =>
          i === dragging.pointIndex
            ? { x: dragging.origValue.x + dx, y: dragging.origValue.y + dy }
            : p,
        );
        actions.updateLayer(dragging.layerId, {
          effectClip: { ...layer.effectClip, points: newPoints },
        });
      } else if (dragging.type === "shape-prop" && dragging.propKeys) {
        const layer = animation.layers.find((l) => l.id === dragging.layerId);
        if (!layer?.svgProps) return;
        actions.updateLayer(dragging.layerId, {
          svgProps: {
            ...layer.svgProps,
            [dragging.propKeys.x]: Math.round(dragging.origValue.x + dx),
            [dragging.propKeys.y]: Math.round(dragging.origValue.y + dy),
          },
        });
      } else if (dragging.type === "shape-point" && dragging.pointIndex !== undefined) {
        const layer = animation.layers.find((l) => l.id === dragging.layerId);
        if (!layer?.shapePoints) return;
        const newPoints = layer.shapePoints.map((p, i) =>
          i === dragging.pointIndex
            ? { x: Math.round(dragging.origValue.x + dx), y: Math.round(dragging.origValue.y + dy) }
            : p,
        );
        actions.updateLayer(dragging.layerId, { shapePoints: newPoints });
      } else if (dragging.type === "mesh-point" && dragging.pointIndex !== undefined) {
        const layer = animation.layers.find((l) => l.id === dragging.layerId);
        if (!layer?.meshPoints) return;
        const newPoints = [...layer.meshPoints];
        newPoints[dragging.pointIndex] = {
          ...newPoints[dragging.pointIndex],
          x: dragging.origValue.x + dx,
          y: dragging.origValue.y + dy,
        };
        actions.updateLayer(dragging.layerId, { meshPoints: newPoints });
      } else if (
        (dragging.type === "handle-in" || dragging.type === "handle-out") &&
        dragging.pointIndex !== undefined
      ) {
        const layer = animation.layers.find((l) => l.id === dragging.layerId);
        if (!layer?.meshPoints) return;
        const newPoints = [...layer.meshPoints];
        const pt = newPoints[dragging.pointIndex];
        const handleKey = dragging.type === "handle-in" ? "handleIn" : "handleOut";
        newPoints[dragging.pointIndex] = {
          ...pt,
          [handleKey]: {
            x: dragging.origValue.x + dx,
            y: dragging.origValue.y + dy,
          },
        };
        actions.updateLayer(dragging.layerId, { meshPoints: newPoints });
      }
    },
    [dragging, toSvgCoords, actions, animation.layers],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const startShapePropDrag = (
    e: React.MouseEvent,
    xKey: string,
    yKey: string,
    xVal: number,
    yVal: number,
  ) => {
    e.stopPropagation();
    const coords = toSvgCoords(e.clientX, e.clientY);
    setDragging({
      type: "shape-prop",
      layerId: selectedLayer!.id,
      propKeys: { x: xKey, y: yKey },
      startX: coords.x,
      startY: coords.y,
      origValue: { x: xVal, y: yVal },
    });
  };

  const renderHandle = (
    x: number,
    y: number,
    label: string,
    onMouseDown: (e: React.MouseEvent) => void,
    isCenter = false,
  ) => (
    <g key={label}>
      <circle
        cx={x}
        cy={y}
        r={isCenter ? 5 : 4}
        fill={isCenter ? "rgba(59,200,246,0.9)" : "white"}
        stroke="rgba(59,200,246,0.9)"
        strokeWidth={1.5}
        cursor="move"
        onMouseDown={onMouseDown}
      />
      <text
        x={x}
        y={y - 8}
        textAnchor="middle"
        fontSize={8}
        fill="rgba(59,200,246,0.8)"
        pointerEvents="none"
      >
        {label}
      </text>
    </g>
  );

  // --- SVG Shape handles ---
  const renderShapeControls = () => {
    if (!selectedLayer || selectedLayer.type !== "svg-shape") return null;
    const p = selectedLayer.svgProps ?? {};
    const handles: React.ReactNode[] = [];

    // Dashed outline of the shape
    const shapeOutline = (() => {
      switch (selectedLayer.svgType) {
        case "ellipse":
          return <ellipse cx={p.cx as number} cy={p.cy as number} rx={p.rx as number} ry={p.ry as number}
            fill="none" stroke="rgba(59,200,246,0.4)" strokeWidth={1} strokeDasharray="4,3" pointerEvents="none" />;
        case "circle":
          return <circle cx={p.cx as number} cy={p.cy as number} r={p.r as number}
            fill="none" stroke="rgba(59,200,246,0.4)" strokeWidth={1} strokeDasharray="4,3" pointerEvents="none" />;
        case "rect":
          return <rect x={p.x as number} y={p.y as number} width={p.width as number} height={p.height as number}
            fill="none" stroke="rgba(59,200,246,0.4)" strokeWidth={1} strokeDasharray="4,3" pointerEvents="none" />;
        default:
          return null;
      }
    })();

    switch (selectedLayer.svgType) {
      case "ellipse": {
        const cx = (p.cx as number) ?? 0;
        const cy = (p.cy as number) ?? 0;
        const rx = (p.rx as number) ?? 0;
        const ry = (p.ry as number) ?? 0;
        // Center handle
        handles.push(renderHandle(cx, cy, "C", (e) => startShapePropDrag(e, "cx", "cy", cx, cy), true));
        // Right handle (rx)
        handles.push(
          <g key="rx">
            <line x1={cx} y1={cy} x2={cx + rx} y2={cy} stroke="rgba(59,200,246,0.3)" strokeWidth={1} strokeDasharray="3,3" pointerEvents="none" />
            {renderHandle(cx + rx, cy, "Rx", (e) => {
              e.stopPropagation();
              const coords = toSvgCoords(e.clientX, e.clientY);
              setDragging({ type: "shape-prop", layerId: selectedLayer.id, propKeys: { x: "rx", y: "ry" }, startX: coords.x, startY: coords.y, origValue: { x: rx, y: ry } });
            })}
          </g>
        );
        // Bottom handle (ry)
        handles.push(
          <g key="ry">
            <line x1={cx} y1={cy} x2={cx} y2={cy + ry} stroke="rgba(59,200,246,0.3)" strokeWidth={1} strokeDasharray="3,3" pointerEvents="none" />
            {renderHandle(cx, cy + ry, "Ry", (e) => {
              e.stopPropagation();
              const coords = toSvgCoords(e.clientX, e.clientY);
              // Only drag Y affects ry
              setDragging({ type: "shape-prop", layerId: selectedLayer.id, propKeys: { x: "rx", y: "ry" }, startX: coords.x, startY: coords.y, origValue: { x: rx, y: ry } });
            })}
          </g>
        );
        break;
      }
      case "circle": {
        const cx = (p.cx as number) ?? 0;
        const cy = (p.cy as number) ?? 0;
        const r = (p.r as number) ?? 0;
        handles.push(renderHandle(cx, cy, "C", (e) => startShapePropDrag(e, "cx", "cy", cx, cy), true));
        handles.push(
          <g key="r">
            <line x1={cx} y1={cy} x2={cx + r} y2={cy} stroke="rgba(59,200,246,0.3)" strokeWidth={1} strokeDasharray="3,3" pointerEvents="none" />
            {renderHandle(cx + r, cy, "R", (e) => {
              e.stopPropagation();
              const coords = toSvgCoords(e.clientX, e.clientY);
              setDragging({ type: "shape-prop", layerId: selectedLayer.id, propKeys: { x: "r", y: "r" }, startX: coords.x, startY: coords.y, origValue: { x: r, y: r } });
            })}
          </g>
        );
        break;
      }
      case "rect": {
        const x = (p.x as number) ?? 0;
        const y = (p.y as number) ?? 0;
        const w = (p.width as number) ?? 0;
        const h = (p.height as number) ?? 0;
        // Top-left
        handles.push(renderHandle(x, y, "TL", (e) => startShapePropDrag(e, "x", "y", x, y)));
        // Bottom-right
        handles.push(renderHandle(x + w, y + h, "BR", (e) => {
          e.stopPropagation();
          const coords = toSvgCoords(e.clientX, e.clientY);
          setDragging({ type: "shape-prop", layerId: selectedLayer.id, propKeys: { x: "width", y: "height" }, startX: coords.x, startY: coords.y, origValue: { x: w, y: h } });
        }));
        // Top-right
        handles.push(renderHandle(x + w, y, "TR", (e) => {
          e.stopPropagation();
          const coords = toSvgCoords(e.clientX, e.clientY);
          setDragging({ type: "shape-prop", layerId: selectedLayer.id, propKeys: { x: "width", y: "y" }, startX: coords.x, startY: coords.y, origValue: { x: w, y: y } });
        }));
        // Bottom-left
        handles.push(renderHandle(x, y + h, "BL", (e) => {
          e.stopPropagation();
          const coords = toSvgCoords(e.clientX, e.clientY);
          setDragging({ type: "shape-prop", layerId: selectedLayer.id, propKeys: { x: "x", y: "height" }, startX: coords.x, startY: coords.y, origValue: { x: x, y: h } });
        }));
        break;
      }
      case "line": {
        const x1 = (p.x1 as number) ?? 0;
        const y1 = (p.y1 as number) ?? 0;
        const x2 = (p.x2 as number) ?? 0;
        const y2 = (p.y2 as number) ?? 0;
        handles.push(renderHandle(x1, y1, "1", (e) => startShapePropDrag(e, "x1", "y1", x1, y1)));
        handles.push(renderHandle(x2, y2, "2", (e) => startShapePropDrag(e, "x2", "y2", x2, y2)));
        break;
      }
      case "polygon":
      case "path": {
        const pts = selectedLayer.shapePoints ?? [];
        // Lines connecting points
        if (pts.length >= 2) {
          for (let i = 0; i < pts.length - 1; i++) {
            handles.push(
              <line key={`line-${i}`} x1={pts[i].x} y1={pts[i].y} x2={pts[i + 1].x} y2={pts[i + 1].y}
                stroke="rgba(59,200,246,0.3)" strokeWidth={1} strokeDasharray="3,3" pointerEvents="none" />
            );
          }
          // Close polygon
          if (selectedLayer.svgType === "polygon" && pts.length >= 3) {
            handles.push(
              <line key="line-close" x1={pts[pts.length - 1].x} y1={pts[pts.length - 1].y} x2={pts[0].x} y2={pts[0].y}
                stroke="rgba(59,200,246,0.3)" strokeWidth={1} strokeDasharray="3,3" pointerEvents="none" />
            );
          }
        }
        // Point handles
        const minPts = selectedLayer.svgType === "polygon" ? 3 : 2;
        pts.forEach((pt, i) => {
          handles.push(
            <g key={`pt-${i}`}>
              <circle
                cx={pt.x} cy={pt.y} r={4}
                fill="white" stroke="rgba(59,200,246,0.9)" strokeWidth={1.5} cursor="move"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const coords = toSvgCoords(e.clientX, e.clientY);
                  setDragging({
                    type: "shape-point",
                    layerId: selectedLayer.id,
                    pointIndex: i,
                    startX: coords.x,
                    startY: coords.y,
                    origValue: { x: pt.x, y: pt.y },
                  });
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (pts.length > minPts) {
                    actions.updateLayer(selectedLayer.id, {
                      shapePoints: pts.filter((_, j) => j !== i),
                    });
                  }
                }}
              />
              <text x={pt.x} y={pt.y - 8} textAnchor="middle" fontSize={8}
                fill="rgba(59,200,246,0.8)" pointerEvents="none">{i + 1}</text>
            </g>
          );
        });
        // Add point button (+ at midpoint of last segment or offset from last point)
        if (pts.length >= 1) {
          const last = pts[pts.length - 1];
          const addX = pts.length >= 2 ? (last.x + pts[pts.length - 2].x) / 2 : last.x + 30;
          const addY = pts.length >= 2 ? (last.y + pts[pts.length - 2].y) / 2 - 25 : last.y - 30;
          handles.push(
            <g key="add-point" cursor="pointer"
              onClick={(e) => {
                e.stopPropagation();
                const newPts = [...pts, { x: Math.round(addX), y: Math.round(addY) }];
                actions.updateLayer(selectedLayer.id, { shapePoints: newPts });
              }}
            >
              <circle cx={addX} cy={addY} r={7} fill="rgba(59,200,246,0.15)" stroke="rgba(59,200,246,0.7)" strokeWidth={1} />
              <text x={addX} y={addY + 3.5} textAnchor="middle" fontSize={11} fill="rgba(59,200,246,0.9)" pointerEvents="none" fontWeight="bold">+</text>
            </g>
          );
        }
        break;
      }
    }

    return <g>{shapeOutline}{handles}</g>;
  };

  // --- Clip shape handles (tirantes) ---
  const renderClipShapeControls = () => {
    if (!selectedLayer || selectedLayer.type !== "svg-effect" || !selectedLayer.effectClip) {
      return null;
    }

    const clip = selectedLayer.effectClip;
    const pathD = shapeToSvgPath(clip);

    return (
      <g>
        <path
          d={pathD}
          fill="none"
          stroke="rgba(59,200,246,0.6)"
          strokeWidth={1.5}
          strokeDasharray="6,3"
          pointerEvents="none"
        />
        {clip.points.map((pt, i) => {
          const isCenter =
            (clip.type === "ellipse" || clip.type === "circle") && i === 0;
          const label =
            clip.type === "rect"
              ? i === 0 ? "TL" : "BR"
              : clip.type === "ellipse" || clip.type === "circle"
                ? i === 0 ? "C" : "R"
                : `${i + 1}`;

          return (
            <g key={i}>
              {(clip.type === "ellipse" || clip.type === "circle") && i === 1 && (
                <line
                  x1={clip.points[0].x} y1={clip.points[0].y}
                  x2={pt.x} y2={pt.y}
                  stroke="rgba(59,200,246,0.3)" strokeWidth={1} strokeDasharray="3,3" pointerEvents="none"
                />
              )}
              {renderHandle(pt.x, pt.y, label, (e) => {
                e.stopPropagation();
                const coords = toSvgCoords(e.clientX, e.clientY);
                setDragging({
                  type: "clip-point",
                  layerId: selectedLayer.id,
                  pointIndex: i,
                  startX: coords.x,
                  startY: coords.y,
                  origValue: { x: pt.x, y: pt.y },
                });
              }, isCenter)}
            </g>
          );
        })}
      </g>
    );
  };

  // --- Mesh controls ---
  const renderMeshControls = () => {
    if (
      !selectedLayer ||
      selectedLayer.type !== "mesh-deformable" ||
      tool !== "bezier"
    )
      return null;

    const points =
      selectedLayer.meshPoints ??
      createUniformGrid(
        selectedLayer.meshGrid?.cols ?? 4,
        selectedLayer.meshGrid?.rows ?? 4,
        animation.width,
        animation.height,
      );

    return (
      <g>
        {points.map((pt, i) => (
          <g key={i}>
            <line x1={pt.x} y1={pt.y} x2={pt.x + pt.handleIn.x} y2={pt.y + pt.handleIn.y} stroke="rgba(0,150,255,0.4)" strokeWidth={0.5} />
            <line x1={pt.x} y1={pt.y} x2={pt.x + pt.handleOut.x} y2={pt.y + pt.handleOut.y} stroke="rgba(255,100,0,0.4)" strokeWidth={0.5} />
            <circle cx={pt.x + pt.handleIn.x} cy={pt.y + pt.handleIn.y} r={3} fill="rgba(0,150,255,0.8)" stroke="white" strokeWidth={0.5} cursor="pointer"
              onMouseDown={(e) => { e.stopPropagation(); const c = toSvgCoords(e.clientX, e.clientY); setDragging({ type: "handle-in", layerId: selectedLayer.id, pointIndex: i, startX: c.x, startY: c.y, origValue: { ...pt.handleIn } }); }}
            />
            <circle cx={pt.x + pt.handleOut.x} cy={pt.y + pt.handleOut.y} r={3} fill="rgba(255,100,0,0.8)" stroke="white" strokeWidth={0.5} cursor="pointer"
              onMouseDown={(e) => { e.stopPropagation(); const c = toSvgCoords(e.clientX, e.clientY); setDragging({ type: "handle-out", layerId: selectedLayer.id, pointIndex: i, startX: c.x, startY: c.y, origValue: { ...pt.handleOut } }); }}
            />
            <circle cx={pt.x} cy={pt.y} r={4} fill="white" stroke="rgba(0,150,255,0.8)" strokeWidth={1.5} cursor="move"
              onMouseDown={(e) => { e.stopPropagation(); const c = toSvgCoords(e.clientX, e.clientY); setDragging({ type: "mesh-point", layerId: selectedLayer.id, pointIndex: i, startX: c.x, startY: c.y, origValue: { x: pt.x, y: pt.y } }); }}
            />
          </g>
        ))}
      </g>
    );
  };

  const renderSelectionBox = () => {
    if (!selectedLayer || tool === "bezier") return null;
    // SVG shapes, effects have their own handles
    if (selectedLayer.type === "svg-shape") return null;
    if (selectedLayer.type === "svg-effect" && selectedLayer.effectClip) return null;
    if (selectedLayer.type === "background") return null;

    const ls = layerStates.find((l) => l.id === selectedLayerId);
    if (!ls) return null;

    return (
      <rect
        x={ls.transform.x - 2}
        y={ls.transform.y - 2}
        width={animation.width + 4}
        height={animation.height + 4}
        fill="none"
        stroke="rgba(59,130,246,0.5)"
        strokeWidth={1}
        strokeDasharray="4,4"
        pointerEvents="none"
      />
    );
  };

  return (
    <div className="rounded-xl border border-border-secondary bg-bg-tertiary p-2">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${animation.width} ${animation.height}`}
        className="w-full cursor-crosshair rounded-lg"
        style={{ background: "#1a1a2e" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <pattern id="editor-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={animation.width} height={animation.height} fill="url(#editor-grid)" />

        {/* Layers */}
        {layerStates.map((ls) => (
          <g key={ls.id} pointerEvents="visiblePainted" onClick={(e) => { e.stopPropagation(); actions.selectLayer(ls.id); }}>
            <LayerRenderer layer={ls} canvasWidth={animation.width} canvasHeight={animation.height} time={currentTime} />
          </g>
        ))}

        {/* Editor overlays */}
        {renderSelectionBox()}
        {renderShapeControls()}
        {renderClipShapeControls()}
        {renderMeshControls()}
      </svg>
    </div>
  );
}

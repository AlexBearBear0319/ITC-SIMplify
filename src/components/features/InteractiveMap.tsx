"use client";

/**
 * InteractiveMap — Tay Eng Soon Library floor plan
 *
 * Markers are plotted using coordinates_x / coordinates_y from the
 * Supabase `locations` table (0–100 percent of the canvas).
 * current_status ('empty'|'busy'|'full') drives marker colour.
 *
 * react-zoom-pan-pinch handles mouse drag, touch drag and pinch-to-zoom.
 * wrapperStyle touchAction:"none" hands all pointer events to JS so the
 * browser never interprets a finger-drag as a native page scroll.
 */

import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

// ─── Status → Tailwind colour class ──────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  empty: "bg-success",
  busy:  "bg-gold",
  full:  "bg-alert",
};

// ─── Prop type ────────────────────────────────────────────────────────────────

type MapLocation = {
  id: number;
  name: string;
  coordinates_x: number | null;
  coordinates_y: number | null;
  current_status: string | null;
};

// ─── Library floor plan SVG ──────────────────────────────────────────────────
//
// viewBox 0 0 600 400 matches the canvas div (w-150 h-100 = 600×400 px).
// Zones are drawn as filled rects so the % coordinates from Supabase
// overlay accurately on the correct room area.
//
// Zone approximate coordinate ranges (for DB seeding reference):
//   Book Stacks A    :  x 2–32 %,  y 3–37 %
//   Book Stacks B    :  x 34–64 %,  y 3–37 %
//   Quiet Pods       :  x 66–96 %,  y 3–39 %
//   Main Reading Hall:  x 2–96 %,  y 41–68 %
//   Discussion Zone  :  x 2–37 %,  y 70–96 %
//   Help Desk        :  x 39–56 %,  y 70–96 %
//   IT Corner        :  x 58–96 %,  y 70–96 %

function LibraryFloorPlan() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 600 400"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Tay Eng Soon Library floor plan"
    >
      {/* ── Outer perimeter wall ── */}
      <rect x="4" y="4" width="592" height="392" fill="none" stroke="#D4D4D0" strokeWidth="2" rx="8" />

      {/* ── Top row: three study zones ── */}

      {/* Book Stacks A */}
      <rect x="12" y="12" width="172" height="120" fill="#EDF5F6" stroke="#D4E9EB" strokeWidth="1.5" rx="5" />
      <text x="98" y="68" textAnchor="middle" fill="#A8B8C8" style={{ fontSize: 9, fontFamily: "sans-serif" }}>
        Book Stacks A
      </text>
      {/* Shelf rows hint */}
      {[84, 96, 108].map((y) => (
        <line key={y} x1="20" y1={y} x2="176" y2={y} stroke="#D4E9EB" strokeWidth="1" strokeDasharray="4,4" />
      ))}

      {/* Book Stacks B */}
      <rect x="200" y="12" width="164" height="120" fill="#EDF5F6" stroke="#D4E9EB" strokeWidth="1.5" rx="5" />
      <text x="282" y="68" textAnchor="middle" fill="#A8B8C8" style={{ fontSize: 9, fontFamily: "sans-serif" }}>
        Book Stacks B
      </text>
      {[84, 96, 108].map((y) => (
        <line key={y} x1="208" y1={y} x2="356" y2={y} stroke="#D4E9EB" strokeWidth="1" strokeDasharray="4,4" />
      ))}

      {/* Quiet Pods (dashed border = reserved / quieter area) */}
      <rect x="380" y="12" width="208" height="124" fill="#FBF3D0" stroke="#E2C044" strokeWidth="1.5" strokeDasharray="5,3" strokeOpacity={0.6} rx="5" />
      <text x="484" y="66" textAnchor="middle" fill="#8FBDC1" style={{ fontSize: 9, fontFamily: "sans-serif" }}>
        Quiet Pods
      </text>
      {/* Pod dividers */}
      {[392, 424, 456, 520, 552].map((x) => (
        <line key={x} x1={x} y1="20" x2={x} y2="128" stroke="#E2C044" strokeWidth="0.8" strokeOpacity={0.4} />
      ))}

      {/* ── Horizontal corridor (y 140–152) ── light wash */}
      <rect x="4" y="138" width="592" height="14" fill="#F1F1EE" />

      {/* ── Main Reading Hall ── */}
      <rect x="12" y="152" width="576" height="104" fill="#F9F9F8" stroke="#D4D4D0" strokeWidth="1.5" rx="5" />
      <text x="300" y="206" textAnchor="middle" fill="#A8B8C8" style={{ fontSize: 10, fontFamily: "sans-serif", letterSpacing: "0.04em" }}>
        Main Reading Hall
      </text>
      {/* Table rows hint */}
      {[168, 188, 208, 228, 244].map((y) => (
        <line key={y} x1="30" y1={y} x2="570" y2={y} stroke="#E4E4E0" strokeWidth="0.8" strokeDasharray="8,12" />
      ))}

      {/* ── Vertical corridor (y 260–272) ── */}
      <rect x="4" y="258" width="592" height="14" fill="#F1F1EE" />

      {/* ── Bottom row: three service zones ── */}

      {/* Discussion Zone */}
      <rect x="12" y="272" width="210" height="112" fill="#EDF5F6" stroke="#B3D2D5" strokeWidth="1.5" rx="5" />
      <text x="117" y="334" textAnchor="middle" fill="#8FBDC1" style={{ fontSize: 9, fontFamily: "sans-serif" }}>
        Discussion Zone
      </text>
      {/* Circular table hints */}
      {[[60, 308], [120, 308], [180, 308], [90, 340], [150, 340]].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="9" fill="none" stroke="#B3D2D5" strokeWidth="0.8" />
      ))}

      {/* Help Desk */}
      <rect x="238" y="272" width="112" height="112" fill="#E8F6EE" stroke="#7BC99A" strokeWidth="1.5" rx="5" />
      <text x="294" y="326" textAnchor="middle" fill="#7BC99A" style={{ fontSize: 8, fontFamily: "sans-serif" }}>
        Help Desk
      </text>
      {/* Counter shape */}
      <rect x="250" y="300" width="88" height="24" fill="none" stroke="#7BC99A" strokeWidth="1" strokeOpacity={0.5} rx="3" />

      {/* IT Corner */}
      <rect x="366" y="272" width="222" height="112" fill="#F7F7F5" stroke="#D4D4D0" strokeWidth="1.5" rx="5" />
      <text x="477" y="334" textAnchor="middle" fill="#A8B8C8" style={{ fontSize: 9, fontFamily: "sans-serif" }}>
        IT Corner
      </text>
      {/* Monitor hints */}
      {[380, 416, 452, 488, 524, 558].map((x) => (
        <rect key={x} x={x} y="296" width="18" height="12" fill="none" stroke="#D4D4D0" strokeWidth="0.8" rx="1" />
      ))}

      {/* ── Entry indicator ── */}
      <text
        x="300"
        y="391"
        textAnchor="middle"
        fill="#B3D2D5"
        style={{ fontSize: 8, fontFamily: "sans-serif", fontWeight: 600, letterSpacing: "0.08em" }}
      >
        ENTRY ▼
      </text>
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InteractiveMap({
  locations,
  onSelectLocation,
}: {
  locations: MapLocation[];
  onSelectLocation?: (loc: MapLocation) => void;
}) {
  return (
    <div className="relative w-full h-full bg-canvas overflow-hidden rounded-2xl select-none">
      <TransformWrapper
        initialScale={1}
        minScale={0.4}
        maxScale={4}
        limitToBounds={false}
        doubleClick={{ disabled: false, mode: "zoomIn" }}
        panning={{ velocityDisabled: false }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            {/* ── Zoom controls ── */}
            <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
              {[
                { fn: () => zoomIn(),         Icon: ZoomIn,    label: "Zoom in"    },
                { fn: () => zoomOut(),        Icon: ZoomOut,   label: "Zoom out"   },
                { fn: () => resetTransform(), Icon: Maximize2, label: "Reset view" },
              ].map(({ fn, Icon, label }) => (
                <button
                  key={label}
                  onClick={fn}
                  aria-label={label}
                  className="p-2 bg-surface border border-border rounded-xl shadow-sm hover:bg-brand-faint active:scale-95 transition-all duration-150"
                >
                  <Icon size={17} className="text-ink-muted" />
                </button>
              ))}
            </div>

            {/*
              TransformComponent wraps the pannable/zoomable canvas.
              wrapperStyle touchAction:none hands all pointer events to JS,
              preventing the browser from treating a finger-drag as page scroll.
            */}
            <TransformComponent
              wrapperStyle={{ width: "100%", height: "100%", touchAction: "none" }}
              wrapperClass="cursor-grab active:cursor-grabbing"
            >
              {/* ── Map canvas — 600 × 400 px ── */}
              <div className="relative w-150 h-100 bg-surface rounded-xl overflow-hidden">

                {/* Floor plan (SVG zones + labels) */}
                <LibraryFloorPlan />

                {/* ── Library label chip ── */}
                <div className="absolute top-3 left-3 z-10 bg-surface/90 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-border shadow-sm">
                  <p className="text-[11px] font-semibold text-ink-muted">Tay Eng Soon Library</p>
                </div>

                {/* ── Zone markers from Supabase ── */}
                {locations.map((loc) => {
                  if (loc.coordinates_x == null || loc.coordinates_y == null) return null;
                  const statusKey  = (loc.current_status ?? "empty").toLowerCase();
                  const colorClass = STATUS_COLORS[statusKey] ?? "bg-brand";
                  return (
                    <div
                      key={loc.id}
                      className="absolute z-10 cursor-pointer flex flex-col items-center"
                      style={{
                        left:      `${loc.coordinates_x}%`,
                        top:       `${loc.coordinates_y}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                      onClick={() => onSelectLocation?.(loc)}
                    >
                      {/* Pulse ring */}
                      <span
                        className={`absolute inset-0 rounded-full ${colorClass} opacity-30 animate-ping z-0`}
                      />
                      {/* Marker dot */}
                      <div
                        title={`${loc.name} · ${loc.current_status ?? "unknown"}`}
                        className={`
                          relative w-7 h-7 rounded-full border-2 border-surface shadow-md z-10
                          flex items-center justify-center cursor-pointer
                          hover:scale-125 transition-transform duration-200
                          ${colorClass}
                        `}
                      >
                        <div className="w-2 h-2 rounded-full bg-surface/80" />
                      </div>
                      {/* Location name above marker, always on top */}
                      <span className="mt-1 text-xs text-ink bg-surface/90 px-1.5 py-0.5 rounded shadow whitespace-nowrap pointer-events-none select-none relative z-20">
                        {loc.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </TransformComponent>

            {/* ── Status legend ── */}
            <div className="absolute bottom-3 left-3 z-10 flex items-center gap-3 bg-surface/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-border pointer-events-none">
              {[
                { color: "bg-success", label: "Open"  },
                { color: "bg-gold",    label: "Busy"  },
                { color: "bg-alert",   label: "Full"  },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
                  <span className="text-[10px] text-ink-muted">{label}</span>
                </div>
              ))}
            </div>

            {/* ── Gesture hint ── */}
            <div className="absolute bottom-3 right-3 z-10 bg-surface/80 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-border pointer-events-none">
              <p className="text-[10px] text-ink-faint">Drag · Pinch · Scroll to zoom</p>
            </div>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}

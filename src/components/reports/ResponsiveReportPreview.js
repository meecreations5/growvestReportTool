"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, ScanLine } from "lucide-react";
import MonthlyReportPrintDocument from "@/components/reports/MonthlyReportPrintDocument";

const BASE_REPORT_WIDTH = 842;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 1.35;
const ZOOM_STEP = 0.1;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function ResponsiveReportPreview({
  report,
  history = [],
  showControls = true,
  className = ""
}) {
  const viewportRef = useRef(null);
  const [fitZoom, setFitZoom] = useState(1);
  const [zoom, setZoom] = useState(null);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return undefined;

    const update = () => {
      const width = node.clientWidth || window.innerWidth || BASE_REPORT_WIDTH;
      const breathingRoom = width < 640 ? 8 : 28;
      const nextFit = clamp((width - breathingRoom) / BASE_REPORT_WIDTH, MIN_ZOOM, 1);
      setFitZoom(nextFit);
    };

    update();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    observer?.observe(node);
    window.addEventListener("resize", update);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const activeZoom = zoom ?? fitZoom;
  const zoomPercent = Math.round(activeZoom * 100);
  const stageWidth = useMemo(() => Math.ceil(BASE_REPORT_WIDTH * activeZoom), [activeZoom]);

  function setManualZoom(nextZoom) {
    setZoom(clamp(Number(nextZoom.toFixed(2)), MIN_ZOOM, MAX_ZOOM));
  }

  return (
    <section className={`gv-responsive-report-viewer ${className}`.trim()}>
      {showControls ? (
        <div className="gv-responsive-report-controls" aria-label="Report preview controls">
          <div className="gv-responsive-report-controls-copy">
            <strong>Exact report design</strong>
            <span>Same A4 layout on desktop and mobile. Zoom changes the viewer only, not the PDF.</span>
          </div>
          <div className="gv-responsive-report-zoom">
            <button type="button" onClick={() => setManualZoom(activeZoom - ZOOM_STEP)} disabled={activeZoom <= MIN_ZOOM + 0.01} aria-label="Zoom out">
              <Minus size={16} />
            </button>
            <span>{zoomPercent}%</span>
            <button type="button" onClick={() => setManualZoom(activeZoom + ZOOM_STEP)} disabled={activeZoom >= MAX_ZOOM - 0.01} aria-label="Zoom in">
              <Plus size={16} />
            </button>
            <button type="button" className="gv-responsive-report-fit" onClick={() => setZoom(null)} aria-label="Fit report to screen">
              <ScanLine size={16} /> <span>Fit</span>
            </button>
          </div>
        </div>
      ) : null}

      <div ref={viewportRef} className="gv-responsive-report-viewport">
        <div className="gv-responsive-report-stage" style={{ width: `${stageWidth}px` }}>
          <div className="gv-responsive-report-inner" style={{ zoom: activeZoom }}>
            <MonthlyReportPrintDocument
              key={`${report?.id || "report"}-${report?.version || report?.publishedVersion || 1}-${report?.templateId || "template"}-${report?.templateVersion || 1}`}
              report={report}
              history={history}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

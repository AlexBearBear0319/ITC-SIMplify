"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

type WriterModule = {
  BrowserQRCodeSvgWriter: new () => {
    write: (contents: string, width: number, height: number) => SVGElement;
  };
};

type Props = {
  value: string;
  size?: number;
};

export default function RewardQrCode({ value, size = 208 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;

    async function renderCode() {
      setState("loading");

      try {
        const qrLib = await import("html5-qrcode/third_party/zxing-js.umd.js");
        const { BrowserQRCodeSvgWriter } = qrLib as unknown as WriterModule;
        const writer = new BrowserQRCodeSvgWriter();
        const svg = writer.write(value, size, size);

        svg.setAttribute("width", String(size));
        svg.setAttribute("height", String(size));
        svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", "Reward collection QR code");
        svg.classList.add("w-full", "h-full");

        if (!active || !containerRef.current) return;

        containerRef.current.innerHTML = "";
        containerRef.current.appendChild(svg);
        setState("ready");
      } catch {
        if (!active) return;
        setState("error");
      }
    }

    void renderCode();

    return () => {
      active = false;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [size, value]);

  return (
    <div className="relative w-[208px] h-[208px] rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
      <div ref={containerRef} className="w-full h-full p-3" />

      {state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90">
          <Loader2 size={22} className="text-ink-muted animate-spin" />
        </div>
      )}

      {state === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white px-4 text-center">
          <AlertCircle size={22} className="text-alert" />
          <p className="text-xs text-ink-muted leading-relaxed">
            QR code could not be generated.
          </p>
        </div>
      )}
    </div>
  );
}

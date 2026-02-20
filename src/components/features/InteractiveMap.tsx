"use client";
import { useState, useRef, MouseEvent, WheelEvent } from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

export default function InteractiveMap({ locations }: { locations: any[] }) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const mapRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.max(0.5, Math.min(3, z + delta)));
  };

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.5));
  const handleReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div className="relative w-full h-full bg-gray-50 overflow-hidden rounded-xl">
      {/* Control Buttons */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          className="p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
          title="Zoom In"
        >
          <ZoomIn size={20} className="text-gray-700" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut size={20} className="text-gray-700" />
        </button>
        <button
          onClick={handleReset}
          className="p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
          title="Reset View"
        >
          <Maximize2 size={20} className="text-gray-700" />
        </button>
      </div>

      {/* Draggable Map Container */}
      <div
        ref={mapRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className={`w-full h-full flex items-center justify-center ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
          transition: isDragging ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {/* Simple Map Placeholder - Replace with actual map image */}
        <div className="relative w-full max-w-150 h-100 bg-white border-2 border-gray-300 rounded-lg">
          {/* Grid Pattern */}
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Location Markers */}
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="absolute"
              style={{
                left: `${loc.coordinates_x}%`,
                top: `${loc.coordinates_y}%`,
                transform: 'translate(-50%, -50%)', // Center the marker on coordinates
              }}
            >
              <div 
                className={`w-8 h-8 rounded-full border-2 border-gray-700 shadow-lg flex items-center justify-center transition-all hover:scale-110 cursor-pointer ${
                  loc.current_status === "Empty"
                    ? "bg-mint"
                    : loc.current_status === "Busy"
                    ? "bg-cream"
                    : "bg-rose"
                }`}
                title={`${loc.name} - ${loc.current_status}`}
              >
                <div className="w-3 h-3 bg-gray-800 rounded-full" />
              </div>
            </div>
          ))}

          {/* Map Labels */}
          <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg border border-gray-200">
            <p className="text-xs font-semibold text-gray-700">Campus Map</p>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg border border-gray-200">
        <p className="text-xs text-gray-600">Click and drag to move • Scroll to zoom</p>
      </div>
    </div>
  );
}

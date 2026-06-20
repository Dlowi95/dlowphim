import React from "react";

export default function HalftoneOverlay() {
  return (
    <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:4px_4px] opacity-100 z-10 pointer-events-none" />
  );
}

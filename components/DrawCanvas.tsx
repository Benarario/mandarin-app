"use client";

import { useEffect, useRef } from "react";

// A finger/mouse scratch pad for attempting to write a character from memory.
// Purely a retrieval aid — nothing is graded or stored. The 米字格 guide lines
// help with proportions. Reset by giving it a new `key` per card.
export default function DrawCanvas({ size = 220 }: { size?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  function grid() {
    const c = ref.current?.getContext("2d");
    if (!c) return;
    c.clearRect(0, 0, size, size);
    c.strokeStyle = "#e7e5e4";
    c.lineWidth = 1;
    c.strokeRect(0.5, 0.5, size - 1, size - 1);
    c.save();
    c.setLineDash([4, 5]);
    c.beginPath();
    c.moveTo(size / 2, 0);
    c.lineTo(size / 2, size);
    c.moveTo(0, size / 2);
    c.lineTo(size, size / 2);
    c.stroke();
    c.restore();
  }

  useEffect(grid, [size]);

  function at(e: React.PointerEvent) {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * size) / r.width, y: ((e.clientY - r.top) * size) / r.height };
  }
  function down(e: React.PointerEvent) {
    const c = ref.current!.getContext("2d")!;
    drawing.current = true;
    const { x, y } = at(e);
    c.strokeStyle = "#1c1917";
    c.lineWidth = 7;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.beginPath();
    c.moveTo(x, y);
    ref.current!.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current) return;
    const c = ref.current!.getContext("2d")!;
    const { x, y } = at(e);
    c.lineTo(x, y);
    c.stroke();
  }
  function up() {
    drawing.current = false;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas
        ref={ref}
        width={size}
        height={size}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        style={{ width: size, height: size }}
        className="touch-none rounded-2xl border border-stone-200 bg-white"
      />
      <button onClick={grid} className="text-xs text-stone-400 underline hover:text-stone-600">
        clear
      </button>
    </div>
  );
}

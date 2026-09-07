export function HUDStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="notch-6 border border-marquinhos-border bg-marquinhos-panel px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.26em] text-marquinhos-text-dim">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-marquinhos-text">
        {value}
      </div>
    </div>
  );
}

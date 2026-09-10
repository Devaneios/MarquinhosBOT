interface OrbitClone {
  radius: number;
  duration: number;
  delay: number;
  size: number;
  hue: number;
  reverse?: boolean;
  tumble?: boolean;
}

const ORBIT_CLONES: OrbitClone[] = [
  { radius: 58, duration: 2.1, delay: 0, size: 34, hue: 0 },
  { radius: 86, duration: 2.8, delay: -0.7, size: 26, hue: 55, reverse: true },
  { radius: 112, duration: 2.4, delay: -1.3, size: 40, hue: 110, tumble: true },
  {
    radius: 138,
    duration: 3.4,
    delay: -2,
    size: 22,
    hue: 190,
    reverse: true,
    tumble: true,
  },
  { radius: 162, duration: 2.9, delay: -0.4, size: 32, hue: 260 },
  {
    radius: 184,
    duration: 3.7,
    delay: -1.8,
    size: 28,
    hue: 320,
    reverse: true,
  },
];

export function MinimizedOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-marquinhos-bg">
      <div
        aria-hidden="true"
        className="animate-minimized-bg-spin pointer-events-none absolute inset-[-50%] bg-[conic-gradient(from_0deg,var(--color-marquinhos-accent),var(--color-marquinhos-blue),var(--color-marquinhos-green),var(--color-marquinhos-danger),var(--color-marquinhos-accent))] opacity-25 blur-3xl"
      />

      <div className="relative h-0 w-0" aria-hidden="true">
        {ORBIT_CLONES.map((clone, index) => (
          <div
            key={index}
            className="absolute top-0 left-0"
            style={{
              width: clone.size,
              height: clone.size,
              marginLeft: -clone.size / 2,
              marginTop: -clone.size / 2,
              animationName: clone.tumble
                ? 'minimized-orbit-tumble'
                : 'minimized-orbit',
              animationDuration: `${clone.duration}s`,
              animationDelay: `${clone.delay}s`,
              animationTimingFunction: 'linear',
              animationIterationCount: 'infinite',
              animationDirection: clone.reverse ? 'reverse' : 'normal',
              ['--orbit-radius' as string]: `${clone.radius}px`,
            }}
          >
            <img
              src="/marquinhoshead.jpg"
              alt=""
              className="mix-blend-screen animate-[minimized-clone-spin_1.4s_linear_infinite] h-full w-full rounded-full"
              style={{ filter: `hue-rotate(${clone.hue}deg) saturate(1.9)` }}
            />
          </div>
        ))}
      </div>

      <img
        src="/marquinhoshead.jpg"
        alt=""
        aria-hidden="true"
        className="animate-minimized-spin relative h-24 w-24 rounded-full shadow-[0_0_40px_var(--color-marquinhos-accent)]"
      />
    </div>
  );
}

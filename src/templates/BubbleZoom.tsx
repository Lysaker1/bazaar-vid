import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';

export default function BubbleZoom() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const bubbleSize = 70;
  const gap = 100;
  const cols = 21;
  const rows = 13;
  const gridWidth = cols * gap;
  const gridHeight = rows * gap;
  const offsetX = (width - gridWidth) / 2 + gap / 2;
  const offsetY = (height - gridHeight) / 2 + gap / 2;
  const centerCol = Math.floor(cols / 2);
  const centerRow = Math.floor(rows / 2);
  const ZOOM_END = 27;

  const zoomProgress = spring({
    frame,
    fps: 30,
    config: { damping: 20, stiffness: 45, mass: 1.8 },
  });

  const easeInOutCubic = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const scale = interpolate(easeInOutCubic(zoomProgress), [0, 1], [1, 4.5], {
    extrapolateRight: "clamp",
  });

  const nonCenterOpacity = interpolate(
    frame,
    [ZOOM_END - 10, ZOOM_END],
    [1, 0],
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ background: "#faf9f6" }}>
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          width: "100%",
          height: "100%",
          position: "relative",
        }}
      >
        {Array.from({ length: rows * cols }).map((_, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = col * gap + offsetX;
          const y = row * gap + offsetY;
          const isCenter = col === centerCol && row === centerRow;
          const pulse = isCenter ? Math.sin(frame / 20) * 0.05 + 1 : 1;
          const bubbleScale = isCenter ? 1.4 : 1;

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: bubbleSize,
                height: bubbleSize,
                borderRadius: "50%",
                background: "linear-gradient(90deg, #ff5757, #8c52ff)",
                boxShadow: isCenter
                  ? `
                    0 0 40px rgba(255, 87, 87, 0.4),
                    0 0 80px rgba(140, 82, 255, 0.2),
                    inset 0 0 30px rgba(255, 255, 255, 0.2)
                  `
                  : "0 0 20px rgba(140, 82, 255, 0.15)",
                opacity: isCenter ? 1 : nonCenterOpacity,
                transform: `translate(-50%, -50%) scale(${bubbleScale * pulse})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.3s ease-out",
              }}
            >
              {isCenter && (
                <div
                  style={{
                    color: "white",
                    fontSize: 24,
                    fontFamily: "sans-serif",
                    fontWeight: 600,
                    padding: 24,
                    textAlign: "center",
                    textShadow: `
                      0 2px 4px rgba(0,0,0,0.2),
                      0 4px 8px rgba(0,0,0,0.1)
                    `,
                    transform: "translateY(-2px)",
                  }}
                >
                  Today
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
} 
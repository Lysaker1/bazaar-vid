import ParticleFlow from './FloatingParticles';
import GoogleSignIn from './GoogleSignIn';
import GitHubSignIn from './GitHubSignIn';
import Code from './Code';
import AICoding from './AICoding';
import PromptIntro from './PromptIntro';
import GrowthGraph from './GrowthGraph';
import AppleSignIn from './AppleSignIn';
import FintechUI from './FintechUI';
import AIDialogue from './AIDialogue';
import BubbleZoom from './BubbleZoom';
import KnowsCode from './KnowsCode';
import DotRipple from './DotRipple';
import GradientText from './GradientText';
import BlueGradientText from './BlueGradientText';

export interface TemplateDefinition {
  id: string;
  name: string;
  duration: number; // in frames
  component: React.ComponentType; // Real React component for Remotion Player
  getCode: () => string; // Code string for database storage
}

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'glitch',
    name: 'Particle Flow',
    duration: 180, // 6 seconds  
    component: ParticleFlow,
    getCode: () => `import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, random } from 'remotion';

// Static color array (safe for SSR)
const colors = ['#FF8DC7', '#86A8E7', '#FF69B4', '#9B6DFF'];

export default function ParticleFlow() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const progress = frame / 90;

  // Generate particles deterministically using Remotion's random function
  const particles = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    baseOffset: random(\`baseOffset-\${i}\`) * Math.PI * 2,
    radius: random(\`radius-\${i}\`) * 100 + 300,
    size: random(\`size-\${i}\`) * 12 + 6,
    color: colors[Math.floor(random(\`color-\${i}\`) * colors.length)] || colors[0],
    speed: random(\`speed-\${i}\`) * 0.3 + 0.2,
    clockwise: random(\`clockwise-\${i}\`) > 0.5,
  }));

  const particleStyles = particles.map((p) => {
    const angle =
      (progress * p.speed + p.baseOffset) *
      (p.clockwise ? 1 : -1) *
      Math.PI *
      2;

    const x = width / 2 + Math.cos(angle) * p.radius;
    const y = height / 2 + Math.sin(angle) * p.radius;

    const opacity = interpolate(Math.sin(progress * Math.PI * 2), [-1, 1], [0.4, 1]);

    return {
      transform: \`translate(\${x}px, \${y}px)\`,
      opacity,
      width: p.size,
      height: p.size,
      background: p.color,
      position: 'absolute',
      borderRadius: '50%',
      boxShadow: \`0 0 \${p.size * 2}px \${p.color}\`,
    };
  });

  const textOpacity = interpolate(frame, [0, 15, 60, 75], [0, 1, 1, 0], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(45deg, #000000, #1a1a1a)',
        overflow: 'visible', // allow particles outside the box
        position: 'relative',
      }}
    >
      {particleStyles.map((style, i) => (
        <div key={particles[i]?.id || i} style={style} />
      ))}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) scale(0.85)',
          opacity: textOpacity,
          color: 'white',
          fontSize: 56,
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 700,
          textAlign: 'center',
          textShadow: '0 0 20px rgba(255,255,255,0.5)',
        }}
      >
        AI - Powered
        <br />
        <span
          style={{
            fontSize: 60,
            background: 'linear-gradient(90deg, #FF8DC7, #86A8E7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            display: 'inline-block',
          }}
        >
          Motion Graphics
        </span>
      </div>
    </AbsoluteFill>
  );
}`
  },
  {
    id: 'floating',
    name: 'Google Sign In',
    duration: 240, // 8 seconds
    component: GoogleSignIn,
    getCode: () => `import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

export default function GoogleSignIn() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = spring({
    frame,
    fps,
    config: {
      damping: 20,
      stiffness: 80,
    },
  });

  const buttonScale = spring({
    frame: frame - 15,
    fps,
    config: {
      damping: 12,
      stiffness: 200,
    },
  });

  const hover = spring({
    frame: frame - 45,
    fps,
    config: {
      damping: 12,
      stiffness: 200,
    },
  });

  const shadowSize = interpolate(hover, [0, 1], [20, 30]);
  const pulse = Math.sin(frame / 30) * 0.1 + 0.9;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 600,
          height: 200,
          transform: \`translate(-50%, -50%) scale(\${pulse})\`,
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.05) 0%, transparent 70%)',
          filter: 'blur(40px)',
          opacity: fadeIn,
        }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          background: 'white',
          color: '#1a1a1a',
          border: '1px solid #ccc',
          borderRadius: 100,
          padding: '24px 120px',
          fontSize: 32,
          fontFamily: 'Inter, sans-serif',
          fontWeight: 500,
          cursor: 'pointer',
          opacity: fadeIn,
          transform: \`scale(\${interpolate(buttonScale, [0, 1], [0.9, 1])})\`,
          boxShadow: \`0 \${shadowSize}px \${shadowSize * 2}px rgba(0, 0, 0, 0.1)\`,
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 256 262"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M255.68 133.49c0-11.26-.93-22.07-2.67-32.52H130v61.55h70.68c-3.06 16.52-12.28 30.51-26.18 39.89v33.03h42.32c24.75-22.8 38.86-56.4 38.86-101.95z"
            fill="#4285F4"
          />
          <path
            d="M130 262c35.1 0 64.56-11.66 86.08-31.6l-42.32-33.03c-11.78 7.9-26.88 12.56-43.76 12.56-33.64 0-62.15-22.71-72.34-53.2H14.59v33.59C36.2 230.82 79.91 262 130 262z"
            fill="#34A853"
          />
          <path
            d="M57.66 156.73c-2.77-8.23-4.36-17-4.36-26s1.59-17.77 4.36-26V71.14H14.59C5.28 88.79 0 109.1 0 130s5.28 41.21 14.59 58.86l43.07-32.13z"
            fill="#FBBC05"
          />
          <path
            d="M130 51.05c19.08 0 36.16 6.56 49.68 19.42l37.26-37.26C194.56 11.72 165.1 0 130 0 79.91 0 36.2 31.18 14.59 71.14l43.07 33.59C67.85 73.76 96.36 51.05 130 51.05z"
            fill="#EA4335"
          />
        </svg>
        &nbsp;Sign in with Google
      </div>
    </AbsoluteFill>
  );
}`
  },
  {
    id: 'github',
    name: 'GitHub Sign In',
    duration: 240, // 8 seconds
    component: GitHubSignIn,
    getCode: () => `import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

export default function GithubSignIn() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = spring({
    frame,
    fps,
    config: {
      damping: 20,
      stiffness: 80,
    },
  });

  const scaleIn = spring({
    frame: frame - 15,
    fps,
    config: {
      damping: 12,
      stiffness: 200,
    },
  });

  const pulse = Math.sin(frame / 30) * 0.1 + 0.9;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 600,
          height: 200,
          transform: \`translate(-50%, -50%) scale(\${pulse})\`,
          background: "radial-gradient(ellipse at center, rgba(0,0,0,0.05) 0%, transparent 70%)",
          filter: "blur(40px)",
          opacity: fadeIn,
        }}
      />
      
      <button
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          background: "black",
          color: "white",
          border: "none",
          borderRadius: "100px",
          padding: "24px 120px",
          fontSize: 32,
          fontFamily: "Inter, -apple-system, system-ui, sans-serif",
          fontWeight: 500,
          cursor: "pointer",
          opacity: fadeIn,
          transform: \`scale(\${interpolate(scaleIn, [0, 1], [0.9, 1])})\`,
          boxShadow: \`0 24px 48px rgba(0, 0, 0, 0.15)\`,
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          width={32}
          height={32}
        >
          <path d="M12 .5C5.65.5.5 5.66.5 12.05c0 5.1 3.29 9.42 7.86 10.96.58.11.8-.25.8-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.72-1.54-2.55-.3-5.23-1.28-5.23-5.7 0-1.26.46-2.3 1.2-3.11-.12-.3-.52-1.52.11-3.16 0 0 .98-.31 3.2 1.19a11.14 11.14 0 0 1 5.82 0c2.2-1.5 3.18-1.19 3.18-1.19.64 1.64.24 2.86.12 3.16.75.81 1.2 1.85 1.2 3.11 0 4.43-2.69 5.39-5.25 5.68.42.36.77 1.08.77 2.17 0 1.56-.02 2.82-.02 3.2 0 .31.21.68.8.56A10.53 10.53 0 0 0 23.5 12.05C23.5 5.66 18.34.5 12 .5Z" />
        </svg>
        Sign in with GitHub
      </button>
    </AbsoluteFill>
  );
}`
  },
  {
    id: 'apple',
    name: 'Apple Sign In',
    duration: 240, // 8 seconds
    component: AppleSignIn,
    getCode: () => `import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from "remotion";
import React from "react";

export default function AppleSignIn() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  const buttonScale = spring({
    frame: frame - 15,
    fps,
    config: { damping: 12, stiffness: 200 },
  });

  const hover = spring({
    frame: frame - 45,
    fps,
    config: { damping: 12, stiffness: 200 },
  });

  const shadowSize = interpolate(hover, [0, 1], [20, 30]);

  const pulse = Math.sin(frame / 30) * 0.1 + 0.9;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, -apple-system, system-ui, sans-serif",
      }}
    >
      {/* Glow */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "600px",
          height: "200px",
          transform: \`translate(-50%, -50%) scale(\${pulse})\`,
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.15) 0%, transparent 70%)",
          filter: "blur(40px)",
          opacity: fadeIn,
        }}
      />

      {/* Apple Button */}
      <button
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          background: "black",
          color: "white",
          border: "none",
          borderRadius: "100px",
          padding: "24px 120px",
          fontSize: "32px",
          fontWeight: 500,
          cursor: "pointer",
          opacity: fadeIn,
          transform: \`scale(\${interpolate(buttonScale, [0, 1], [0.9, 1])})\`,
          boxShadow: \`0 \${shadowSize}px \${shadowSize * 2}px rgba(0, 0, 0, 0.1)\`,
          transition: "box-shadow 0.3s ease",
        }}
      >
        <svg viewBox="0 0 384 512" width="32" height="32" fill="currentColor">
          <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
        </svg>
        Sign in with Apple
      </button>
    </AbsoluteFill>
  );
}`
  },
  {
    id: 'aicoding',
    name: 'AI Coding',
    duration: 180, // 6 seconds
    component: AICoding,
    getCode: () => `import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';

export default function AICoding() {
  const frame = useCurrentFrame();

  const codeLines = [
    { text: "export const Animation: React.FC = () => {", indent: 0, delay: 0 },
    { text: "const frame = useCurrentFrame();", indent: 1, delay: 10 },
    { text: "return (", indent: 1, delay: 20 },
    { text: "<Series>", indent: 2, delay: 30 },
    { text: "<Series.Sequence durationInFrames={60}>", indent: 3, delay: 40 },
    { text: "<FadeIn>", indent: 4, delay: 50 },
    { text: "const progress = interpolate(", indent: 5, delay: 60 },
    { text: "frame,", indent: 6, delay: 70 },
    { text: "[0, 30],", indent: 6, delay: 80 },
    { text: "[0, 1],", indent: 6, delay: 90 },
    { text: ");", indent: 5, delay: 100 },
    { text: "</FadeIn>", indent: 4, delay: 110 },
    { text: "</Series.Sequence>", indent: 3, delay: 120 },
    { text: "</Series>", indent: 2, delay: 130 },
    { text: ");", indent: 1, delay: 140 },
    { text: "}", indent: 0, delay: 145 },
  ];

  const containerOpacity = interpolate(
    frame,
    [0, 10],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  function CodeLine({ text, delay, indent }) {
    const charCount = Math.floor(
      interpolate(frame - delay, [0, 20], [0, text.length], {
        extrapolateRight: "clamp",
      })
    );

    const opacity = interpolate(frame - delay, [0, 5], [0, 1], {
      extrapolateRight: "clamp",
    });

    const colorizeToken = (token) => {
      if (token.match(/^(Sequence|Series|interpolate|useCurrentFrame|spring)$/)) {
        return "#FF92FF";
      } else if (token.match(/^[A-Z]\\w+/)) {
        return "#00FFFF";
      } else if (token.match(/^['"""].*['"""]$/)) {
        return "#50FA7B";
      } else if (token.match(/^[{}\\[\\](),;]$/)) {
        return "#F8F8F2";
      } else if (token.match(/^\\d+$/)) {
        return "#FF79C6";
      } else if (token.match(/^[\\w]+(?=\\()/)) {
        return "#00B4FF";
      } else if (token.match(/^\\.[\\w]+/)) {
        return "#BD93F9";
      }
      return "#F8F8F2";
    };

    return (
      <div
        style={{
          fontFamily: "SF Mono, monospace",
          fontSize: "24px",
          marginLeft: \`\${indent * 24}px\`,
          opacity,
          height: "36px",
          display: "flex",
          alignItems: "center",
          color: "#F8F8F2",
        }}
      >
        {text.slice(0, charCount).split(/([{}\\[\\](),;.]|\\s+)/).map((token, i) => {
          if (token.trim() === "") return token;
          const color = colorizeToken(token);
          return (
            <span key={i} style={{ color }}>
              {token}
            </span>
          );
        })}
        {frame >= delay && frame < delay + 20 && (
          <span
            style={{
              width: "2px",
              height: "24px",
              background: "#00FFFF",
              display: "inline-block",
              marginLeft: "2px",
            }}
          />
        )}
      </div>
    );
  }

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #0D1117 0%, #161B22 100%)",
        padding: "40px",
        opacity: containerOpacity,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#1C2128",
          borderRadius: "12px",
          padding: "32px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          border: "1px solid #30363D",
          maxWidth: "900px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            color: "#7C3AED",
            fontSize: "20px",
            fontFamily: "SF Mono, monospace",
            marginBottom: "24px",
            opacity: 0.8,
          }}
        >
          // AI-Generated Animation Code
        </div>

        {codeLines.map((line, i) => (
          <CodeLine key={i} {...line} />
        ))}
      </div>
    </AbsoluteFill>
  );
}`
  },
  {
    id: 'promptintro',
    name: 'Prompt Intro',
    duration: 90, // 3 seconds
    component: PromptIntro,
    getCode: () => `import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
} from "remotion";
import React from "react";

const InputBar: React.FC<{
  text: string;
  placeholder: string;
  showButton: boolean;
  scale: number;
  opacity: number;
}> = ({ text, placeholder, showButton, scale, opacity }) => {
  const frame = useCurrentFrame();
  const cursorVisible = Math.floor(frame / 15) % 2 === 0;
  const buttonScale = spring({
    frame: frame - 45,
    fps: 30,
    config: {
      damping: 12,
      stiffness: 200,
    },
  });

  return (
    <div
      style={{
        position: "relative",
        width: "800px",
        height: "64px",
        background: "rgba(255, 255, 255, 0.1)",
        borderRadius: "9999px",
        display: "flex",
        alignItems: "center",
        padding: "0 32px",
        transform: \`scale(\${scale})\`,
        opacity,
        boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.1)",
      }}
    >
      <div
        style={{
          flex: 1,
          fontSize: "24px",
          fontFamily: "Inter, system-ui, sans-serif",
          color: text ? "#FFFFFF" : "#AAAAAA",
        }}
      >
        {text || placeholder}
        {text && cursorVisible && (
          <span
            style={{
              borderRight: "2px solid #FFFFFF",
              marginLeft: "2px",
              height: "24px",
              display: "inline-block",
            }}
          />
        )}
      </div>
      {showButton && (
        <div
          style={{
            width: "40px",
            height: "40px",
            background: "rgba(255, 255, 255, 0.1)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: \`scale(\${buttonScale})\`,
            cursor: "pointer",
          }}
        >
          ✨
        </div>
      )}
    </div>
  );
};

const GlowEffect: React.FC<{
  intensity: number;
}> = ({ intensity }) => {
  const frame = useCurrentFrame();
  const pulse = Math.sin(frame / 30) * 0.1 + 0.9;

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        width: "900px",
        height: "200px",
        transform: \`translate(-50%, -50%) scale(\${pulse})\`,
        background: \`radial-gradient(
          ellipse at center,
          rgba(255, 140, 0, \${0.3 * intensity}) 0%,
          rgba(255, 105, 180, \${0.2 * intensity}) 50%,
          rgba(147, 112, 219, \${0.1 * intensity}) 100%
        )\`,
        filter: "blur(40px)",
        opacity: intensity,
      }}
    />
  );
};

export default function PromptIntro() {
  const frame = useCurrentFrame();
  const text = "Create incredible motion graphics for your app with Bazaar";
  const TYPING_START = 0;
  const TYPING_DURATION = 45;
  const BUTTON_SHOW = 45;
  const CLICK_START = 60;

  const charCount = Math.floor(
    interpolate(
      frame - TYPING_START,
      [0, TYPING_DURATION],
      [0, text.length],
      { extrapolateRight: "clamp" }
    )
  );

  const scale = spring({
    frame: frame - CLICK_START,
    fps: 30,
    config: {
      damping: 15,
      stiffness: 80,
    },
  });

  const finalScale = interpolate(scale, [0, 1], [1, 0.6]);

  const glowIntensity = interpolate(
    frame,
    [0, 5, CLICK_START, CLICK_START + 15],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        background: "#000000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <GlowEffect intensity={glowIntensity} />
      <InputBar
        text={text.slice(0, charCount)}
        placeholder="Ask Bazaar to create..."
        showButton={frame >= BUTTON_SHOW}
        scale={finalScale}
        opacity={interpolate(
          frame,
          [0, 5, CLICK_START + 15, CLICK_START + 30],
          [0, 1, 1, 0],
          { extrapolateRight: "clamp" }
        )}
      />
    </AbsoluteFill>
  );
}`
  },
  {
    id: 'growthgraph',
    name: 'Growth Graph',
    duration: 150, // 5 seconds
    component: GrowthGraph,
    getCode: () => `import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from "remotion";
import React from "react";

export default function GrowthGraph() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cameraProgress = spring({
    frame,
    fps,
    config: { damping: 30, stiffness: 60 },
  });

  const data = [
    {
      year: "2025",
      value: 10,
      gradient: ["#F56040", "#F77737"],
    },
    {
      year: "2026",
      value: 30,
      gradient: ["#833AB4", "#405DE6"],
    },
    {
      year: "2027",
      value: 85,
      gradient: ["#405DE6", "#00C4CC"],
    },
  ];

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)",
        transform: \`scale(\${interpolate(cameraProgress, [0, 1], [1.08, 1])})\`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 60,
        paddingBottom: 40,
        justifyContent: "flex-start",
      }}
    >
      {/* Title Block */}
      <div
        style={{
          textAlign: "center",
          color: "white",
          fontFamily: "Inter, sans-serif",
          marginBottom: 60,
          transform: \`scale(\${spring({ frame, fps, config: { damping: 12, stiffness: 200 } })})\`,
        }}
      >
        <h1 style={{ fontSize: 52, fontWeight: 700, margin: 0 }}>
          Bazaar Revenue Growth by Year
        </h1>
        <p style={{ fontSize: 22, opacity: 0.7, marginTop: 12 }}>
          Europe's Fastest Growing Startup
        </p>
      </div>

      {/* Bar Section */}
      {data.map((item, i) => {
        const progress = spring({
          frame: frame - i * 15,
          fps,
          config: { damping: 12, stiffness: 80 },
        });

        const valueSpring = spring({
          frame: frame - i * 15 - 10,
          fps,
          config: { damping: 12, stiffness: 100 },
        });

        const width = interpolate(progress, [0, 1], [0, (item.value / 100) * 800]);
        const shimmerX = interpolate(frame - i * 15, [0, 60], [-100, 100], {
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={item.year}
            style={{
              marginBottom: 56,
              position: "relative",
              width: 800,
            }}
          >
            <div
              style={{
                color: "white",
                fontSize: 24,
                fontWeight: 700,
                fontFamily: "Inter, sans-serif",
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              {item.year}
            </div>

            <div
              style={{
                width: "100%",
                height: 48,
                background: "#333",
                borderRadius: 32,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width,
                  height: "100%",
                  background: \`linear-gradient(90deg, \${item.gradient.join(", ")})\`,
                  borderRadius: 32,
                  boxShadow: \`0 0 20px \${item.gradient[1]}\`,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: \`\${shimmerX}%\`,
                    width: 150,
                    height: "100%",
                    background:
                      "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)",
                    transform: "skewX(-20deg)",
                  }}
                />
              </div>

              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: width,
                  transform: \`translate(16px, -50%) scale(\${valueSpring})\`,
                  opacity: valueSpring,
                  background: "white",
                  color: "#1a1a1a",
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 700,
                  fontSize: 20,
                  padding: "8px 16px",
                  borderRadius: 16,
                  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.15)",
                  whiteSpace: "nowrap",
                }}
              >
                $\${item.value}M
              </div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
}`
  },
  {
    id: 'fintechui',
    name: 'Fintech UI',
    duration: 150, // 5 seconds
    component: FintechUI,
    getCode: () => `//src/templates/FintechUI.tsx
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, spring } from "remotion";

const ChatMessage = ({ text, isUser, delay }) => {
  const frame = useCurrentFrame();
  const progress = spring({ frame: frame - delay, fps: 30, config: { damping: 12, stiffness: 200 } });

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        opacity: progress,
        transform: \`translateY(\${interpolate(progress, [0, 1], [20, 0])}px)\`,
        marginBottom: 24,
      }}
    >
      <div
        style={{
          maxWidth: "80%",
          padding: "16px 20px",
          borderRadius: 20,
          background: isUser ? "#007AFF" : "#E9ECEF",
          color: isUser ? "white" : "#212529",
          fontFamily: "sans-serif",
          fontSize: 16,
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
          lineHeight: 1.5,
        }}
      >
        {text}
      </div>
    </div>
  );
};

export default function FintechUI() {
  const frame = useCurrentFrame();
  const progress = spring({ frame, fps: 30, config: { damping: 20, stiffness: 80 } });
  const messages = [
    { text: "I need help designing a landing page for my AI fintech startup.", isUser: true, delay: 0 },
    { text: "Sure! What's the core message you want to highlight?", isUser: false, delay: 15 },
    { text: "AI + Finance. We want it to feel smart but friendly.", isUser: true, delay: 30 },
    { text: "Here's a layout with bold headlines and a dashboard.", isUser: false, delay: 45 },
    { text: "This is 🔥🔥🔥", isUser: true, delay: 60 },
  ];
  
  return (
    <AbsoluteFill style={{ background: "#F8F9FA" }}>
      <div style={{ display: "flex", height: "100%", padding: 32, gap: 32 }}>
        <div style={{ width: "30%", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, overflowY: "auto", paddingRight: 20 }}>
            {messages.map((msg, i) => <ChatMessage key={i} {...msg} />)}
          </div>
        </div>
        <div style={{ width: "70%" }}>
          <div style={{ background: "linear-gradient(135deg, #1E1E2E 0%, #2D2D44 100%)", borderRadius: 16, padding: 24, color: "white", fontFamily: "sans-serif" }}>
            <h1 style={{ fontSize: 56, textAlign: "center", fontWeight: 700 }}>AI Financial Insights</h1>
            <p style={{ fontSize: 22, color: "#AAA", textAlign: "center" }}>Make smarter investments with predictive analytics.</p>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}`
  },
  {
    id: 'aidialogue',
    name: 'AI Dialogue',
    duration: 240, // 8 seconds
    component: AIDialogue,
    getCode: () => `//src/templates/AIDialogue.tsx
import { AbsoluteFill, interpolate, useCurrentFrame, spring } from 'remotion';

const messages = [
  { text: "Hey, I want to generate a motion graphic video for my product.", isUser: true, delay: 0 },
  { text: "Awesome! What kind of visuals or layout are you thinking?", isUser: false, delay: 10 },
  { text: "Let's go for a product demo vibe. Bold headline, clean interface.", isUser: true, delay: 20 },
  { text: "Got it. Should I include animated metrics and a button CTA?", isUser: false, delay: 30 },
  { text: "Yes, with green numbers for growth and a glowing effect on CTA.", isUser: true, delay: 40 },
  { text: "Done. Preview now includes everything and looks polished.", isUser: false, delay: 50 },
  { text: "Perfect. This is exactly what I envisioned using Bazaar.", isUser: true, delay: 60 },
  { text: "Thanks, this is exactly what I needed! Let's export", isUser: false, delay: 70 },
];

const ChatMessage = ({ text, isUser, delay }) => {
  const frame = useCurrentFrame();
  const opacity = spring({
    frame: frame - delay,
    fps: 30,
    config: { damping: 12, stiffness: 200 },
  });

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        padding: '12px 24px',
        opacity,
      }}
    >
      <div
        style={{
          maxWidth: '520px',
          fontSize: 16,
          fontFamily: 'sans-serif',
          background: isUser ? '#007AFF' : '#F1F1F1',
          color: isUser ? 'white' : '#111',
          padding: '16px 20px',
          borderRadius: 24,
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
        }}
      >
        {text}
      </div>
    </div>
  );
};

export default function AIDialogue() {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#F8F9FA',
        display: 'flex',
        flexDirection: 'column',
        padding: '48px 0 80px 0',
        justifyContent: 'flex-start',
      }}
    >
      {messages.map((msg, i) => (
        <ChatMessage key={i} {...msg} />
      ))}
    </AbsoluteFill>
  );
}`
  },
  {
    id: 'bubblezoom',
    name: 'Bubble Zoom',
    duration: 90, // 3 seconds
    component: BubbleZoom,
    getCode: () => `//src/templates/BubbleZoom.tsx
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

  const zoomProgress = spring({
    frame,
    fps: 30,
    config: { damping: 20, stiffness: 45, mass: 1.8 },
  });

  const scale = interpolate(zoomProgress, [0, 1], [1, 4.5], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: "#faf9f6" }}>
      <div
        style={{
          transform: \`scale(\${scale})\`,
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
                opacity: isCenter ? 1 : interpolate(frame, [17, 27], [1, 0], { extrapolateRight: "clamp" }),
                transform: \`translate(-50%, -50%) scale(\${bubbleScale * pulse})\`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isCenter && (
                <div
                  style={{
                    color: "white",
                    fontSize: 24,
                    fontFamily: "sans-serif",
                    fontWeight: 600,
                    textAlign: "center",
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
}`
  },
  {
    id: 'knowscode',
    name: 'Knows Code',
    duration: 120, // 4 seconds
    component: KnowsCode,
    getCode: () => `//src/templates/KnowsCode.tsx
import { AbsoluteFill, interpolate, useCurrentFrame, spring } from 'remotion';

export default function KnowsCode() {
  const frame = useCurrentFrame();

  const BRACE_START = 1;
  const TEXT_START = 5;

  const braceScale = spring({
    frame: frame - BRACE_START,
    fps: 30,
    config: { damping: 12 },
  });

  const GradientBrace = ({ isLeft, scale }) => {
    return (
      <div
        style={{
          fontSize: '120px',
          lineHeight: '120px',
          fontFamily: 'SF Pro Display, system-ui, sans-serif',
          background: 'linear-gradient(180deg, #FF8DC7 0%, #86A8E7 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          transform: \`scale(\${scale})\`,
        }}
      >
        {isLeft ? '{' : '}'}
      </div>
    );
  };

  const TypewriterText = ({ text, startFrame }) => {
    const charCount = Math.floor(
      interpolate(Math.max(0, frame - startFrame), [0, 30], [0, text.length], {
        extrapolateRight: 'clamp',
      })
    );

    const cursorVisible = Math.floor((frame - startFrame) / 15) % 2 === 0;

    return (
      <div
        style={{
          fontSize: '80px',
          lineHeight: '80px',
          fontFamily: 'SF Pro Display, system-ui, sans-serif',
          fontWeight: 'bold',
        }}
      >
        {text.slice(0, charCount)}
        <span
          style={{
            opacity: cursorVisible ? 1 : 0,
            borderRight: '3px solid black',
            marginLeft: '2px',
            height: '80px',
            display: 'inline-block',
          }}
        />
      </div>
    );
  };

  return (
    <AbsoluteFill
      style={{
        background: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <GradientBrace isLeft={true} scale={braceScale} />
        <TypewriterText text="Software is eating the world" startFrame={TEXT_START} />
        <GradientBrace isLeft={false} scale={braceScale} />
      </div>
    </AbsoluteFill>
  );
}`
  },
  {
    id: 'dotripple',
    name: 'Dot Ripple',
    duration: 120, // 4 seconds
    component: DotRipple,
    getCode: () => `//src/templates/DotRipple.tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

export default function DotRipple() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const dotSpacing = 14;
  const dotRadius = 1.5;
  const centerX = width / 2;
  const centerY = height / 2;

  const rows = Math.ceil(height / dotSpacing);
  const cols = Math.ceil(width / dotSpacing);

  const rippleFrequency = 0.15;
  const rippleSpeed = 4;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0f172a",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <svg width="100%" height="100%">
        {Array.from({ length: rows * cols }).map((_, i) => {
          const x = (i % cols) * dotSpacing;
          const y = Math.floor(i / cols) * dotSpacing;

          const dx = x - centerX;
          const dy = y - centerY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          const phase = (frame - distance / rippleSpeed) * rippleFrequency;
          const alpha = 0.5 + 0.5 * Math.sin(phase);

          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={dotRadius}
              fill="#6ee7b7"
              fillOpacity={alpha}
            />
          );
        })}
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,0.9) 100%)",
        }}
      />
    </AbsoluteFill>
  );
}`
  },
  {
    id: 'gradienttext',
    name: 'Gradient Text',
    duration: 240, // 8 seconds
    component: GradientText,
    getCode: () => `//src/templates/GradientText.tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

export default function GradientText() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const loopDuration = fps * 8;
  const hueBase = (frame % loopDuration) * (360 / loopDuration);
  const getHue = (offset) => \`hsl(\${(hueBase + offset) % 360}, 100%, 60%)\`;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#ffffff",
        justifyContent: "center",
        alignItems: "center",
        display: "flex",
      }}
    >
      <svg width="1000" height="150" viewBox="0 0 1000 150">
        <defs>
          <linearGradient id="text-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={getHue(0)} />
            <stop offset="20%" stopColor={getHue(60)} />
            <stop offset="40%" stopColor={getHue(120)} />
            <stop offset="60%" stopColor={getHue(180)} />
            <stop offset="80%" stopColor={getHue(240)} />
            <stop offset="100%" stopColor={getHue(300)} />
          </linearGradient>
        </defs>

        <text x="100" y="100" fill="#000" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="72">
          Design
        </text>

        <text x="370" y="100" fill="url(#text-gradient)" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="72">
          without
        </text>

        <text x="655" y="100" fill="#000" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="72">
          Limits
        </text>
      </svg>
    </AbsoluteFill>
  );
}`
  },
  {
    id: 'bluegradienttext',
    name: 'Blue Gradient Text',
    duration: 240, // 8 seconds
    component: BlueGradientText,
    getCode: () => `//src/templates/BlueGradientText.tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

export default function BlueGradientText() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const loopDuration = fps * 8;
  const hueShift = (frame % loopDuration) * (360 / loopDuration) * 1.5;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#ffffff",
        justifyContent: "center",
        alignItems: "center",
        display: "flex"
      }}
    >
      <svg width="1000" height="150" viewBox="0 0 1000 150">
        <defs>
          <linearGradient
            id="blue-gradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
            gradientTransform={\`rotate(\${360 - hueShift}, 0.5, 0.5)\`}
          >
            <stop offset="0%" stopColor="hsl(200, 100%, 60%)" />
            <stop offset="20%" stopColor="hsl(210, 100%, 60%)" />
            <stop offset="40%" stopColor="hsl(220, 100%, 60%)" />
            <stop offset="60%" stopColor="hsl(230, 100%, 60%)" />
            <stop offset="80%" stopColor="hsl(240, 100%, 60%)" />
            <stop offset="100%" stopColor="hsl(200, 100%, 60%)" />
          </linearGradient>
        </defs>

        <text x="100" y="100" fill="#000" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="72">
          Create
        </text>

        <text x="370" y="100" fill="url(#blue-gradient)" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="72">
          without
        </text>

        <text x="655" y="100" fill="#000" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="72">
          Limits
        </text>
      </svg>
    </AbsoluteFill>
  );
}`
  }
]; 
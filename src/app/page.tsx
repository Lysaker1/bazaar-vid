// src/app/page.tsx
"use client";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { api } from "~/trpc/react";
import LoginPage from "./login/page";
import { Player } from "@remotion/player";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
} from "remotion";

// Custom hook for typewriter effect
const useTypewriterPrompt = (
  staticPrefix: string, 
  prompts: string[], 
  typeSpeed = 50, 
  deleteSpeed = 30, 
  pauseTime = 2000
): string => {
  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [promptIndex, setPromptIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    // If we're in the pause state
    if (isPaused) {
      timer = setTimeout(() => {
        setIsPaused(false);
        setIsDeleting(true);
      }, pauseTime);
      return () => clearTimeout(timer);
    }

    const currentPrompt = prompts[promptIndex] ?? '';
    
    // Handle deletion
    if (isDeleting) {
      timer = setTimeout(() => {
        setCurrentText(prev => prev.substring(0, prev.length - 1));
        if (currentText === '') {
          setIsDeleting(false);
          setPromptIndex((promptIndex + 1) % prompts.length);
        }
      }, deleteSpeed);
    } 
    // Handle typing
    else {
      if (currentText === currentPrompt) {
        setIsPaused(true);
      } else {
        timer = setTimeout(() => {
          setCurrentText(currentPrompt.substring(0, currentText.length + 1));
        }, typeSpeed);
      }
    }
    
    return () => clearTimeout(timer);
  }, [currentText, isDeleting, promptIndex, isPaused, prompts, typeSpeed, deleteSpeed, pauseTime]);
  
  return staticPrefix + currentText;
};

// Code animation component for the React, Rendered section
const CodeDemoComposition = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#1a1a1a', padding: '40px' }}>
      <CodeLine text="import { useCurrentFrame, interpolate } from 'remotion';" delay={0} indent={0} />
      <CodeLine text="import React from 'react';" delay={15} indent={0} />
      <CodeLine text="" delay={30} indent={0} />
      <CodeLine text="export const BazaarScene = () => {" delay={45} indent={0} />
      <CodeLine text="// Animation logic generated from your prompt" delay={60} indent={1} />
      <CodeLine text="const frame = useCurrentFrame();" delay={75} indent={1} />
      <CodeLine text="const opacity = Math.min(1, frame / 30);" delay={90} indent={1} />
      <CodeLine text="" delay={105} indent={0} />
      <CodeLine text="return (" delay={120} indent={1} />
      <CodeLine text="<div style={{" delay={135} indent={2} />
      <CodeLine text="opacity," delay={150} indent={3} />
      <CodeLine text="transform: `translateY(${frame / 10}px)`" delay={165} indent={3} />
      <CodeLine text="}}>>" delay={180} indent={2} />
      <CodeLine text="<h1 className='title'>Your video is ready</h1>" delay={195} indent={3} />
      <CodeLine text="</div>" delay={210} indent={2} />
      <CodeLine text=");" delay={225} indent={1} />
      <CodeLine text="};" delay={240} indent={0} />
    </AbsoluteFill>
  );
};

// CodeLine component that creates a typing animation effect
const CodeLine: React.FC<{
  text: string;
  delay: number;
  indent: number;
}> = ({ text, delay, indent }) => {
  const frame = useCurrentFrame();
  
  const charCount = Math.floor(
    interpolate(
      frame - delay,
      [0, 20],
      [0, text.length],
      { extrapolateRight: "clamp" }
    )
  );
  
  const opacity = interpolate(
    frame - delay,
    [0, 5],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  // Enhanced syntax highlighting with more vibrant colors
  const colorizeToken = (token: string): string => {
    // Keywords with bright purple
    if (token.match(/^(import|from|interpolate|useCurrentFrame|const|React|export|return)$/)) {
      return "#FF92FF"; // Vibrant purple for keywords
    }
    // Component names with electric blue
    else if (token.match(/^[A-Z]\w+/)) {
      return "#00FFFF"; // Cyan for components
    }
    // String literals with emerald green
    else if (token.match(/^['"].*['"]$/)) {
      return "#50FA7B"; // Bright green for strings
    }
    // Punctuation with soft silver
    else if (token.match(/^[{}\[\](),;]$/)) {
      return "#F8F8F2"; // Bright silver for punctuation
    }
    // Numbers with coral pink
    else if (token.match(/^\d+$/)) {
      return "#FF79C6"; // Coral pink for numbers
    }
    // Function calls with bright blue
    else if (token.match(/^[\w]+(?=\()/)) {
      return "#00B4FF"; // Bright blue for functions
    }
    // Properties with lavender
    else if (token.match(/^\.[\w]+/)) {
      return "#BD93F9"; // Lavender for properties
    }
    // Default to soft white for other identifiers
    return "#F8F8F2";
  };

  // Simple syntax highlighting
  const renderText = () => {
    if (text === '') return <span>&nbsp;</span>;

    const displayedText = text.substring(0, charCount);
    
    // Split by tokens for syntax highlighting
    const tokens = displayedText.split(/([{}()[\],;.'"`]|\s+|\/\/)/g).filter(Boolean);
    
    return tokens.map((token, i) => {
      if (token.match(/^\s+$/)) return <span key={i}>&nbsp;</span>;
      
      return (
        <span key={i} style={{ color: colorizeToken(token) }}>
          {token}
        </span>
      );
    });
  };

  return (
    <div
      style={{
        fontFamily: "SF Mono, monospace",
        fontSize: "14px",
        marginLeft: `${indent * 20}px`,
        opacity,
        height: "24px",
        display: "flex",
        alignItems: "center",
        color: "#F8F8F2",
      }}
    >
      {renderText()}
    </div>
  );
};

// Re-implementing the GlowEffect component for styling
const GlowEffect = ({ intensity }: { intensity: number }) => {
  const frame = useCurrentFrame();
  
  // Subtle pulse animation
  const pulse = Math.sin(frame / 30) * 0.1 + 0.9;
  
  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        width: "1620px",
        height: "360px",
        transform: `translate(-50%, -50%) scale(${pulse})`,
        background: `radial-gradient(
          ellipse at center,
          rgba(255, 140, 0, ${0.3 * intensity}) 0%,
          rgba(255, 105, 180, ${0.2 * intensity}) 50%,
          rgba(147, 112, 219, ${0.1 * intensity}) 100%
        )`,
        filter: "blur(72px)",
        opacity: intensity,
      }}
    />
  );
};

// Updated editable text component with original styling
const EditableTextDemo = ({ customText }: { customText: string }) => {
  const frame = useCurrentFrame();
  
  // Animation timing - balanced for smoothness and visual appeal
  const typingStartFrame = 0;
  const typingDuration = 60;
  const buttonShowFrame = 60;
  const zoomStartFrame = 120;
  
  // Text typing animation
  const displayedText = customText.slice(0, Math.floor(
    interpolate(
      frame - typingStartFrame,
      [0, typingDuration],
      [0, customText.length],
      { extrapolateRight: "clamp" }
    )
  ));
  
  // Cursor blink animation
  const cursorVisible = Math.floor(frame / 15) % 2 === 0;
  
  // Button scale animation
  const buttonScale = spring({
    frame: frame - 45,
    fps: 30,
    config: {
      damping: 12,
      stiffness: 200,
    },
  });
  
  // Glow intensity animation
  const glowIntensity = interpolate(
    frame,
    [0, 15, zoomStartFrame, zoomStartFrame + 30],
    [0, 1, 1, 0.8],
    { extrapolateRight: "clamp" }
  );
  
  // Input container scale animation
  const scale = spring({
    frame: frame - zoomStartFrame,
    fps: 30,
    config: { damping: 15, stiffness: 80 },
  });
  
  const inputScale = interpolate(scale, [0, 1], [1, 0.85], { 
    extrapolateRight: "clamp" 
  });
  
  const inputOpacity = interpolate(
    frame,
    [0, 15, zoomStartFrame + 15, zoomStartFrame + 30],
    [0, 1, 1, 0.95],
    { extrapolateRight: "clamp" }
  );
  
  return (
    <AbsoluteFill
      style={{
        background: "#000000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden", // Prevent any overflow issues
      }}
    >
      <GlowEffect intensity={glowIntensity} />
      
      {/* Input box styled exactly like the original */}
      <div
        style={{
          position: "relative",
          width: "1440px",
          height: "115px",
          background: "rgba(255, 255, 255, 0.1)",
          borderRadius: "9999px",
          display: "flex",
          alignItems: "center",
          padding: "0 57px",
          transform: `scale(${inputScale})`,
          opacity: inputOpacity,
          boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.1)",
        }}
      >
        <div
          style={{
            flex: 1,
            fontSize: "44px",
            fontFamily: "SF Pro Display, system-ui, sans-serif",
            color: displayedText ? "#FFFFFF" : "#AAAAAA",
          }}
        >
          {displayedText || "Ask Bazaar to create..."}
          {displayedText && cursorVisible && (
            <span
              style={{
                borderRight: "3px solid #FFFFFF",
                marginLeft: "3px",
                height: "44px",
                display: "inline-block",
              }}
            />
          )}
        </div>
        
        {/* Spark button */}
        {frame >= buttonShowFrame && (
          <div
            style={{
              width: "72px",
              height: "72px",
              background: "rgba(255, 255, 255, 0.1)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${buttonScale})`,
              cursor: "pointer",
              fontSize: "36px",
            }}
          >
            ✨
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

export default function HomePage() {
  const { data: session, status } = useSession();
  const [prompt, setPrompt] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const router = useRouter();
  const createProject = api.project.create.useMutation();
  
  // Example prompts for rotation
  const examplePrompts = [
    "a scene where bold white text saying 'Launch Day' pulses over a shifting pink-to-purple gradient with sparkles trailing off",
    "a scene with a dark terminal-style background and green monospaced code being typed out line-by-line, Matrix-style",
    "a product feature appearing one by one in 3D-style cards that fade in and float upward with a spring motion",
    "a scene that zooms into a phone screen while a hand scrolls through an app, with UI elements bouncing softly",
    "a typewriter-style text effect introducing 'Introducing FlowSync', with a glitch transition revealing the app logo",
    "a looping animation of fireworks exploding in sync with sound pulses on a midnight blue background",
    "a scene where 3 floating avatars rotate in 3D space while chat bubbles fade in above them",
    "a kinetic typography scene where the phrase 'Speed. Style. Simplicity.' slams onto the screen in sync with bass hits",
    "a scene with a sunrise horizon behind mountains, as the product name rises with the sun using smooth motion blur"
  ];
  
  // Rotating placeholder using the typewriter effect
  const placeholderText = useTypewriterPrompt("Create ", examplePrompts);

  // State for the interactive playground - simplified
  const [customAnimationText, setCustomAnimationText] = useState("Or choose templates from our library and just change the content");
  const [inputText, setInputText] = useState("Or choose templates from our library and just change the content");
  
  // Handler to update the animation with new text
  const handleUpdateAnimation = () => {
    if (inputText.length > 0 && inputText.length <= 65) {
      setCustomAnimationText(inputText);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    if (status === "authenticated" && session?.user) {
      // Create project with initial prompt as message
      const project = await createProject.mutateAsync({
        initialMessage: prompt,
      });
      if (project?.projectId) {
        router.push(`/projects/${project.projectId}/edit`);
      }
    } else {
      setShowLogin(true);
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // This would connect to an API endpoint to store the email
    console.log("Email submitted:", email);
    // Reset form or show success message
    setEmail("");
    // Could add a toast notification or success message here
  };

  const toggleFaq = (id: string) => {
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  // Example video cards data
  const exampleCards = [
    {
      prompt: "Create a line-by-line animation of code being generated",
      videoUrl: "https://dnauvvkfpmtquaysfdvm.supabase.co/storage/v1/object/public/animations//aiCoding.mp4",
    },
    {
      prompt: "Create a prompt input box with type writer effect",
      videoUrl: "https://dnauvvkfpmtquaysfdvm.supabase.co/storage/v1/object/public/animations//Prompt%20input.mp4",
    },
    {
      prompt: "Create exploding fireworks",
      videoUrl: "https://dnauvvkfpmtquaysfdvm.supabase.co/storage/v1/object/public/animations//firework.mp4",
    },
  ];

  // FAQ data
  const faqs = [
    {
      id: "cost",
      question: "How much does it cost?",
      answer: "During beta, it's completely free."
    },
    {
      id: "how-it-works",
      question: "How does it work?",
      answer: "Write a description of each scene you want to make and press \"Create.\" We'll generate the code. You can then refine every scene in the editor using natural language."
    },
    {
      id: "save",
      question: "How do I save it?",
      answer: "We haven't implemented that yet — but it's coming soon. For now, we recommend screen recording. Your scenes will be saved to your account and rendering/exporting will be available in the next few days. Make sure you're signed up for updates to know when it goes live."
    },
    {
      id: "mobile",
      question: "Can I make it in a mobile-friendly format?",
      answer: "Yes, just prompt the box to make it vertical, square, horizontal—whatever you want."
    },
    {
      id: "figma",
      question: "Can I import my Figma file?",
      answer: "That feature is coming soon. Enter your email below to get notified."
    },
    {
      id: "contact",
      question: "How can I contact you?",
      answer: "Email us at hello@bazaar.it."
    },
    {
      id: "what-is",
      question: "WTF is Bazaar?",
      answer: "Bazaar is a fine-tuned LLM for converting text descriptions into motion graphic videos."
    },
    {
      id: "music",
      question: "Can I add music?",
      answer: "That feature is coming soon."
    }
  ];

  // Company logos for credibility section
  const companyLogos = [
    { name: "Google", path: "https://egvuknlirjkhhhoooecl.supabase.co/storage/v1/object/public/bazaar-vid//Format=Wordmark.svg" },
    { name: "Adobe", path: "https://egvuknlirjkhhhoooecl.supabase.co/storage/v1/object/public/bazaar-vid//Adobe.svg" },
    { name: "Uber", path: "https://egvuknlirjkhhhoooecl.supabase.co/storage/v1/object/public/bazaar-vid//Uber.svg" },
    { name: "Airbnb", path: "https://egvuknlirjkhhhoooecl.supabase.co/storage/v1/object/public/bazaar-vid//Airbnb.svg" },
    { name: "Github", path: "https://egvuknlirjkhhhoooecl.supabase.co/storage/v1/object/public/bazaar-vid//Github.svg" },
    { name: "Netflix", path: "https://egvuknlirjkhhhoooecl.supabase.co/storage/v1/object/public/bazaar-vid//netflix.svg" },
    { name: "Slack", path: "https://egvuknlirjkhhhoooecl.supabase.co/storage/v1/object/public/bazaar-vid//slack.svg" },
    { name: "Twilio", path: "https://egvuknlirjkhhhoooecl.supabase.co/storage/v1/object/public/bazaar-vid//twilio.svg" },
    { name: "Vercel", path: "https://egvuknlirjkhhhoooecl.supabase.co/storage/v1/object/public/bazaar-vid//Vercel.svg" },
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="w-full h-20 border-b shadow-sm flex items-center px-12 justify-between bg-white z-10">
        <div className="flex items-end gap-2">
          <Image 
            src="https://egvuknlirjkhhhoooecl.supabase.co/storage/v1/object/public/bazaar-vid//Bazaar%20BETA%20V1.png" 
            alt="Bazaar Logo" 
            width={120} 
            height={120} 
            priority 
          />
        </div>
        <div className="flex gap-4 items-center">
          {status === "authenticated" ? (
            <span className="text-base">Logged in as <b>{session.user?.name ?? session.user?.email}</b></span>
          ) : (
            <>
              <button className="text-base px-4 py-2 rounded hover:bg-gray-100 transition" onClick={() => setShowLogin(true)}>Login</button>
              <button className="text-base px-4 py-2 font-semibold rounded bg-black text-white hover:bg-gray-900 transition" onClick={() => setShowLogin(true)}>Sign Up</button>
            </>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 max-w-6xl mx-auto w-full">
        <div className="mb-16 w-full text-center">
          <h1 className="text-6xl font-extrabold mb-6">Motion Graphics, Made Simple</h1>
          <p className="text-xl text-gray-600">Create stunning motion graphic scenes from a simple prompt</p>
        </div>
        
        <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto" autoComplete="off">
          <div 
            style={{
              position: 'relative',
              padding: '2px',
              borderRadius: '0.75rem',
              background: 'linear-gradient(90deg, #ff3366, #ff9933, #ffff00, #33cc33, #3399ff, #cc33ff, #ff3366)',
              backgroundSize: '400% 100%',
              boxShadow: '0 0 15px 2px rgba(255, 51, 102, 0.3), 0 0 25px 5px rgba(51, 153, 255, 0.25)'
            }}
          >
            <div
              style={{
                animation: 'rainbowMove 8s linear infinite',
                position: 'absolute',
                inset: 0,
                background: 'inherit',
                borderRadius: 'inherit',
                backgroundSize: 'inherit',
              }}
            />
            <style jsx>{`
              @keyframes rainbowMove {
                0% { background-position: 0% 50%; }
                100% { background-position: 100% 50%; }
              }
            `}</style>

            <div style={{
              background: 'white',
              borderRadius: 'calc(0.75rem - 2px)',
              overflow: 'hidden',
              position: 'relative',
              zIndex: 1
            }}>
              <textarea
                placeholder={placeholderText}
                aria-label="Video idea prompt"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                className="w-full px-6 py-6 focus:outline-none focus:ring-0 text-black min-h-[180px] resize-none pb-20"
                style={{
                  border: 'none',
                  background: 'white'
                }}
                disabled={createProject.isPending}
                autoFocus
              />
              <button
                type="submit"
                className="absolute bottom-5 right-5 bg-black text-white px-6 py-3 rounded-md font-semibold hover:bg-gray-800 transition"
                disabled={createProject.isPending || !prompt.trim()}
              >
                {createProject.isPending ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </form>
        
        {/* Example videos section */}
        <section className="mt-20 w-full">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">Create anything</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
            {exampleCards.map((card, index) => (
              <div key={index} className="flex flex-col bg-white rounded-lg shadow-lg overflow-hidden transition-transform hover:scale-[1.02] hover:shadow-xl">
                <div className="aspect-video w-full bg-black overflow-hidden">
                  <video
                    src={card.videoUrl}
                    className="w-full h-full object-cover"
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-center mb-2">
                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xs">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <p className="ml-2 text-sm font-medium text-gray-400">Prompt</p>
                  </div>
                  <h3 className="font-medium text-base text-gray-900">
                    "{card.prompt}"
                  </h3>
                </div>
              </div>
            ))}
          </div>
        </section>
        
        {/* How it Works Section */}
        <section className="mt-24 w-full">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">How it Works</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-16 max-w-7xl mx-auto px-4">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center p-8 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-black text-white rounded-full flex items-center justify-center text-xl font-bold mb-6">1</div>
              <h3 className="text-xl font-semibold mb-4">Describe</h3>
              <p className="text-gray-600">Describe exactly what you want to create in a scene — the more detail the better</p>
            </div>
            
            {/* Step 2 */}
            <div className="flex flex-col items-center text-center p-8 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-black text-white rounded-full flex items-center justify-center text-xl font-bold mb-6">2</div>
              <h3 className="text-xl font-semibold mb-4">Generate</h3>
              <p className="text-gray-600">Generate motion graphics instantly with AI.</p>
            </div>
            
            {/* Step 3 */}
            <div className="flex flex-col items-center text-center p-8 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-black text-white rounded-full flex items-center justify-center text-xl font-bold mb-6">3</div>
              <h3 className="text-xl font-semibold mb-4">Refine</h3>
              <p className="text-gray-600">Refine each scene using natural language prompts — iterate until it's perfect.</p>
            </div>
          </div>
        </section>
        
        {/* React, Rendered Section */}
        <section className="mt-24 w-full py-16 bg-white">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Left Side - Text Content */}
              <div className="flex flex-col">
                <h2 className="text-4xl md:text-5xl font-extrabold mb-6">React, Rendered.</h2>
                <p className="text-xl text-gray-600 mb-8">
                  Bazaar turns prompts into product demo videos using React and Remotion
                </p>
                <div className="flex flex-wrap gap-4">
                  <button 
                    className="px-8 py-3 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition"
                    onClick={() => {
                      const promptTextarea = document.querySelector('textarea');
                      if (promptTextarea) {
                        promptTextarea.focus();
                        window.scrollTo({
                          top: promptTextarea.getBoundingClientRect().top + window.scrollY - 200,
                          behavior: 'smooth'
                        });
                      }
                    }}
                  >
                    Try it now
                  </button>
                </div>
              </div>
              
              {/* Right Side - Visual Element */}
              <div className="relative">
                <div className="rounded-xl overflow-hidden shadow-xl bg-gray-900 p-0 w-full aspect-video relative">
                  <Player
                    component={CodeDemoComposition}
                    durationInFrames={300}
                    compositionWidth={600}
                    compositionHeight={400}
                    fps={30}
                    style={{
                      width: '100%',
                      height: '100%',
                    }}
                    loop
                    autoPlay
                    controls={false}
                    showPosterWhenPaused={false}
                  />
                </div>
                
                {/* Visual flourish - glow effect */}
                <div className="absolute -inset-x-6 -inset-y-6 z-[-1] bg-gradient-to-r from-blue-100 via-blue-200 to-teal-100 rounded-2xl opacity-20 blur-xl" />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Interactive Code Playground Section - Moved outside main for full-width */}
      <section className="w-full py-16 bg-gray-50">
        <div className="w-full text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-10">Customize Hundreds of Templates.</h2>
          <p className="text-xl text-gray-600 mb-12">
            Edit the animation text below and see your changes come to life
          </p>
        </div>
        
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Side - Remotion Player */}
            <div className="rounded-xl overflow-hidden shadow-xl bg-black aspect-video relative order-2 lg:order-1">
              <Player
                component={EditableTextDemo}
                durationInFrames={120}
                compositionWidth={1920}
                compositionHeight={1080}
                fps={30}
                style={{
                  width: '100%',
                  height: '100%',
                }}
                loop
                autoPlay
                controls={false}
                showPosterWhenPaused={false}
                inputProps={{ customText: customAnimationText }}
              />
              <div className="absolute -inset-x-4 -inset-y-4 z-[-1] bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 rounded-2xl opacity-50 blur-xl" />
            </div>
            
            {/* Right Side - Text Input */}
            <div className="flex flex-col order-1 lg:order-2">
              <div className="flex flex-col items-center w-full">
                <div className="w-full mb-4">
                  <input 
                    type="text" 
                    value={inputText}
                    onChange={(e) => {
                      // Limit to 65 characters
                      if (e.target.value.length <= 65) {
                        setInputText(e.target.value);
                      }
                    }}
                    placeholder="Enter your custom text (max 65 characters)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-black"
                  />
                  <div className="text-xs text-gray-500 mt-1 text-left">
                    {inputText.length}/65 characters
                  </div>
                </div>
                <button
                  onClick={handleUpdateAnimation}
                  disabled={inputText.length === 0 || inputText.length > 65}
                  className="px-6 py-3 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Update Animation
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Full width credibility section with auto-scrolling logos */}
      <section className="w-full py-16 bg-gray-50 overflow-hidden">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">Used by teams at:</h2>
        </div>

        <style jsx global>{`
          @keyframes scroll {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(-50%);
            }
          }
        `}</style>

        <div className="relative w-full">
          <div className="overflow-hidden w-full whitespace-nowrap">
            <div className="inline-block animate-[scroll_25s_linear_infinite]">
              {companyLogos.map((logo) => (
                <div key={`first-${logo.name}`} className="inline-block mx-8 align-middle">
                  <div className="w-48 h-16 relative flex items-center justify-center">
                    <Image
                      src={logo.path}
                      alt={`${logo.name} logo`}
                      width={192}
                      height={72}
                      style={{ objectFit: 'contain' }}
                      className="max-h-16 w-auto grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="inline-block animate-[scroll_25s_linear_infinite]">
              {companyLogos.map((logo) => (
                <div key={`second-${logo.name}`} className="inline-block mx-8 align-middle">
                  <div className="w-48 h-16 relative flex items-center justify-center">
                    <Image
                      src={logo.path}
                      alt={`${logo.name} logo`}
                      width={192}
                      height={72}
                      style={{ objectFit: 'contain' }}
                      className="max-h-16 w-auto grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="w-full py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 flex items-center justify-center gap-3">
            <span className="text-2xl">📚</span> FAQs
          </h2>
          
          <div className="space-y-4">
            {faqs.map((faq) => (
              <div 
                key={faq.id} 
                className="border border-gray-200 rounded-lg overflow-hidden transition-all duration-200"
              >
                <button
                  onClick={() => toggleFaq(faq.id)}
                  className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-gray-50 focus:outline-none"
                >
                  <span className="font-medium text-lg">{faq.question}</span>
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className={`transition-transform duration-200 ${expandedFaq === faq.id ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                <div 
                  className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${
                    expandedFaq === faq.id ? 'max-h-60 py-4' : 'max-h-0 py-0'
                  }`}
                >
                  <p className="text-gray-600">{faq.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Email Sign-Up Section */}
      <section className="w-full py-16 bg-gray-50">
        <div className="max-w-lg mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-8 flex items-center justify-center gap-3">
            <span className="text-2xl">✉️</span> Sign up for updates
          </h2>
          
          <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row gap-3 mb-3">
            <input
              type="email"
              placeholder="Your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
              required
            />
            <button
              type="submit"
              className="px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition whitespace-nowrap"
            >
              Sign up
            </button>
          </form>
          <p className="text-sm text-gray-500">
            Be the first to know when new features launch.
          </p>
        </div>
      </section>

      {/* Login Modal Overlay - Updated to be more compact */}
      {showLogin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl overflow-hidden w-auto max-w-sm relative">
            <button 
              className="absolute top-3 right-3 z-10 text-gray-500 hover:text-black w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors" 
              onClick={() => setShowLogin(false)}
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <LoginPage />
          </div>
        </div>
      )}
    </div>
  );
}
// src/app/page.tsx
"use client";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import LoginPage from "./login/page";
import { Player } from "@remotion/player";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
} from "remotion";



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
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  // State for the interactive playground - simplified
  const [customAnimationText, setCustomAnimationText] = useState("Or choose templates from our library and just change the content");
  const [inputText, setInputText] = useState("Or choose templates from our library and just change the content");
  
  // Handler to update the animation with new text
  const handleUpdateAnimation = () => {
    if (inputText.length > 0 && inputText.length <= 65) {
      setCustomAnimationText(inputText);
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



  // FAQ data - completely overhauled
  const faqs = [
    {
      id: "cost",
      question: "How much does it cost?",
      answer: "During beta, it's completely free."
    },
    {
      id: "how-it-works",
      question: "How does it work?",
      answer: "Write a description of what you want to make and press \"Create.\" We'll generate the React code for your motion graphic in ~7 seconds. You can then refine every scene in the editor using natural language."
    },
    {
      id: "what-is",
      question: "What is Bazaar?",
      answer: "Bazaar is our vision of a code-to-content tool. We want to democratize video creation by making it as simple as writing a prompt."
    },
    {
      id: "beta-features",
      question: "What features are in Beta V1?",
      answer: "Right now you can create individual motion graphic scenes with AI. We haven't built saving, exporting, or multi-scene projects yet - but they're coming soon!"
    },
    {
      id: "roadmap",
      question: "What new features are you working on?",
      answer: "We're working on saving/exporting videos, multi-scene projects, music integration, Figma imports, and much more. Sign up below to get notified when they launch."
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
        {/* Announcement Badge */}
        <div className="mb-8">
          <div className="inline-flex items-center bg-white border border-gray-200 rounded-full px-3 py-1 shadow-sm">
            <span className="bg-black text-white text-xs font-medium px-2 py-1 rounded-full mr-2">
              Just Launched
            </span>
            <span className="text-sm text-gray-600">
              Beta Version 1 is Live Now!
            </span>
          </div>
        </div>

        {/* Hero Section */}
        <div className="w-full text-center mb-20">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-extrabold mb-8 text-black leading-tight">
              Motion Graphics, Made Simple
            </h1>
            <p className="text-xl md:text-2xl text-black mb-12 max-w-3xl mx-auto leading-relaxed">
              Bazaar is an AI-powered video generator that turns a description into an animated motion graphic — in seconds.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <button 
                className="px-8 py-4 bg-black text-white text-lg font-semibold rounded-xl hover:bg-gray-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                onClick={() => setShowLogin(true)}
              >
                Try for Free
              </button>
            </div>

            {/* Feature Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="flex flex-col items-center p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-4a2 2 0 012-2h2.5" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No learning curve</h3>
                <p className="text-gray-600 text-center">Just Prompt in, video out</p>
              </div>

              <div className="flex flex-col items-center p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Lightning Fast</h3>
                <p className="text-gray-600 text-center">Generate animations in ~7 seconds</p>
              </div>

              <div className="flex flex-col items-center p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Powered</h3>
                <p className="text-gray-600 text-center">No editing skills neccessary. Just describe your vision and AI brings it to life</p>
              </div>
            </div>
          </div>
        </div>
        
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
                    onClick={() => setShowLogin(true)}
                  >
                    Try for Free
                  </button>
                </div>
              </div>
              
              {/* Right Side - Visual Element */}
              <div className="relative">
                <div className="rounded-xl overflow-hidden shadow-xl bg-black p-0 w-full aspect-video relative">
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

      {/* Create Now CTA Section */}
      <section className="w-full py-16 bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to create?</h2>
          <p className="text-gray-600 mb-8">Start making motion graphics with AI in seconds</p>
          <button 
            className="px-8 py-4 bg-black text-white text-lg font-semibold rounded-xl hover:bg-gray-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            onClick={() => setShowLogin(true)}
          >
            Create Now
          </button>
        </div>
      </section>

      {/* Email Sign-Up Section */}
      <section className="w-full py-16 bg-white">
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
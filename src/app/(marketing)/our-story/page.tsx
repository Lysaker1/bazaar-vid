'use client';

import { HoverImageGallery } from '~/components/ui/HoverImageGallery';
import { useSession } from 'next-auth/react';
import { useState, lazy, Suspense } from 'react';

// Lazy load the login modal
const LoginModal = lazy(() => import("../login/page"));

export default function OurStoryPage() {
  const { data: session, status } = useSession();
  const [showLogin, setShowLogin] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Header - Same as homepage */}
      <header className="w-full h-20 border-b shadow-sm flex items-center px-12 justify-between bg-white z-10">
        <div className="flex items-end gap-2">
          <a href="/" className="flex items-baseline gap-2 font-inter hover:opacity-80 transition-opacity">
            <span className="text-3xl font-semibold text-black">Bazaar</span>
            <span className="text-base font-medium text-gray-600">V3</span>
          </a>
        </div>
        <div className="flex gap-4 items-center">
          {status === "authenticated" ? (
            <span className="text-base">Logged in as <b>{session?.user?.name ?? session?.user?.email}</b></span>
          ) : (
            <>
              <button className="text-base px-4 py-2 rounded hover:bg-gray-100 transition" onClick={() => setShowLogin(true)}>Login</button>
              <button className="text-base px-4 py-2 font-semibold rounded bg-black text-white hover:bg-gray-900 transition" onClick={() => setShowLogin(true)}>Sign Up</button>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-16 items-start">
          {/* Left Column - Text Content */}
          <div className="lg:col-span-3">
            <h1 className="text-6xl font-bold text-black mb-16">
              Our Story
            </h1>
            
            <div className="space-y-8 text-xl leading-relaxed">
              <p className="text-gray-600">
                Bazaar was founded by <a href="https://www.linkedin.com/in/jack-modmo" target="_blank" rel="noopener noreferrer" className="text-black underline font-medium">Jack</a> and <a href="https://www.linkedin.com/in/markus-l-hogne" target="_blank" rel="noopener noreferrer" className="text-black underline font-medium">Markus</a>—two techno-optimists who met on a Vietnamese tropical island on Christmas Day, 2023. Markus had hitchhiked from Norway and Jack was recovering from his previous startup, <a href="https://modmo.io/" target="_blank" rel="noopener noreferrer" className="text-black underline font-medium">Modmo</a>.
              </p>

              <p className="text-gray-600">
                After a few months of traveling together and dreaming up ideas, we started working on an <span className="text-black font-bold">AI-powered CAD tool</span>. But we quickly hit a wall—building the tool was one thing, creating viral content for it was <span className="text-black font-bold">another</span>.
              </p>

              <p className="text-gray-600">
                <span className="text-black font-bold">AI video generators</span> like <span className="text-black font-medium">Sora</span> and <span className="text-black font-medium">Veo</span> were <span className="text-black font-bold">mind-blowing</span>, but none had the pixel-perfect accuracy needed for software demo videos.
              </p>

              <p className="text-black-600 text-3xl font-bold text-black leading-tight">
                So we asked ourselves: what if we could combine the precision of AI-Code with the creativity of AI-Video?
              </p>

              <p className="text-gray-600">
                That question became the seed for <span className="text-black font-bold">Bazaar</span>.
              </p>

              <p className="text-gray-600">
                <span className="text-black font-bold">Within hours, we'd hacked together a MVP</span> using the latest AI models—turning screenshots into code and making them animate however we imagined. <span className="text-black font-bold">1-month later</span>, <span className="text-black font-bold">in June 2025, we launched Beta V1</span>.
              </p>

              <p className="text-gray-600">
                Now, we're <span className="text-black font-bold">shipping new features daily</span>—furiously building a tool that makes it possible for anyone to <span className="text-black font-bold">create scroll-stopping, viral content</span> for their app from a single prompt. Motion graphics used to take <span className="text-black font-bold">hours</span>. Now it takes <span className="text-black font-bold">seconds</span>. And <span className="text-black font-bold">this is just the beginning</span>.
              </p>
            </div>
          </div>

          {/* Right Column - Image Gallery */}
          <div className="lg:col-span-2 flex flex-col items-center lg:items-end">
            <HoverImageGallery />
            <p className="text-gray-500 text-sm mt-4 text-center italic">
              When we're not building, we're winning Ultra-marathons.
            </p>
          </div>
        </div>
      </div>

      {/* Login Modal Overlay */}
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
            <Suspense fallback={<div className="p-8">Loading...</div>}>
              <LoginModal redirectTo='/our-story' />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
} 
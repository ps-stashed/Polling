"use client";

import React, { useState, useEffect } from "react";

export default function InteractiveLoader() {
  const [bubbles, setBubbles] = useState([]);
  const [score, setScore] = useState(0);

  // Spawn bubbles periodically
  useEffect(() => {
    let animationFrameId;
    const spawnBubble = () => {
      setBubbles((prev) => {
        // Keep a max of 20 bubbles on screen
        if (prev.length > 20) return prev;
        const size = Math.random() * 40 + 30; // 30px to 70px
        const newBubble = {
          id: Date.now() + Math.random(),
          left: Math.random() * 80 + 10 + "%",
          size: size,
          color: ["#FF8D41", "#FFC266", "#FF5722", "#F97316", "#ff9800"][Math.floor(Math.random() * 5)],
          speed: Math.random() * 4 + 3, // 3s to 7s to float up
        };
        return [...prev, newBubble];
      });
    };

    const interval = setInterval(spawnBubble, 450);
    return () => clearInterval(interval);
  }, []);

  // Cleanup bubbles that have floated away
  useEffect(() => {
    const cleanup = setInterval(() => {
      setBubbles((prev) => prev.filter((b) => Date.now() - b.id < b.speed * 1000 + 1000));
    }, 2000);
    return () => clearInterval(cleanup);
  }, []);

  const handlePop = (id, e) => {
    // Prevent default to avoid selection/ghost clicks
    if (e) e.preventDefault();
    
    // Play a tiny haptic feedback if supported
    if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
      try {
        window.navigator.vibrate(15);
      } catch (err) {}
    }

    setBubbles((prev) => prev.filter((b) => b.id !== id));
    setScore((s) => s + 1);
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-[#fafafa]">
      
      {/* Dynamic Animated Background Mesh */}
      <div className="absolute inset-0 z-0 opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-orange-200/50 rounded-full blur-3xl animate-[pulse_6s_infinite]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-orange-100/50 rounded-full blur-3xl animate-[pulse_8s_infinite_reverse]"></div>
      </div>

      {/* Floating Interactive Orbs */}
      {bubbles.map((bubble) => (
        <div
          key={bubble.id}
          onPointerDown={(e) => handlePop(bubble.id, e)}
          className="absolute rounded-full cursor-pointer transition-all duration-300 transform hover:scale-110 active:scale-75 active:opacity-0 shadow-[0_8px_32px_rgba(255,141,65,0.15)]"
          style={{
            left: bubble.left,
            bottom: "-20%",
            width: bubble.size,
            height: bubble.size,
            background: `radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.9), ${bubble.color} 60%, rgba(0,0,0,0.1) 100%)`,
            animation: `floatUp ${bubble.speed}s cubic-bezier(0.4, 0, 0.2, 1) forwards`,
            opacity: 0.9,
            touchAction: "none",
            boxShadow: `inset -5px -5px 15px rgba(0,0,0,0.1), inset 5px 5px 15px rgba(255,255,255,0.7), 0 10px 20px rgba(0,0,0,0.05)`,
            border: '1px solid rgba(255,255,255,0.4)',
            backdropFilter: 'blur(4px)',
          }}
        >
          {/* Super realistic glass reflection */}
          <div className="absolute top-[10%] left-[15%] w-[40%] h-[25%] bg-gradient-to-b from-white to-transparent opacity-60 rounded-full transform -rotate-12" />
        </div>
      ))}

      {/* Center Glassmorphism Content */}
      <div className="z-10 flex flex-col items-center bg-white/40 backdrop-blur-3xl border border-white/60 px-12 py-10 rounded-[2.5rem] shadow-[0_24px_60px_-12px_rgba(255,141,65,0.2)] pointer-events-none transition-all duration-300">
        
        <div className="flex items-end gap-3 mb-8 h-[50px]">
          <div className="vote-bar bg-gradient-to-t from-orange-500 to-orange-300" style={{ animationDelay: "0ms", height: "30px" }}></div>
          <div className="vote-bar bg-gradient-to-t from-orange-500 to-orange-300" style={{ animationDelay: "200ms", height: "45px" }}></div>
          <div className="vote-bar bg-gradient-to-t from-orange-500 to-orange-300" style={{ animationDelay: "400ms", height: "60px" }}></div>
          <div className="vote-bar bg-gradient-to-t from-orange-500 to-orange-300" style={{ animationDelay: "600ms", height: "40px" }}></div>
        </div>
        
        <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-orange-400 mb-2 tracking-tight">
          Picapool
        </h2>
        
        <p className="text-gray-500/80 text-[11px] font-bold tracking-[0.2em] uppercase animate-pulse">
          Loading Live Polls
        </p>

        {/* Premium Score Indicator */}
        <div className="mt-8 h-10 flex items-center justify-center">
          {score > 0 ? (
            <div className="flex items-center gap-2 bg-orange-50 px-4 py-2 rounded-full border border-orange-100 shadow-sm animate-[popIn_0.3s_ease-out]">
              <span className="text-orange-400 text-sm font-semibold">Orbs Popped</span>
              <span className="text-orange-600 font-extrabold text-lg w-6 text-center">{score}</span>
            </div>
          ) : (
            <div className="px-4 py-2 rounded-full bg-black/5 backdrop-blur-sm border border-black/5">
              <p className="text-gray-500 text-xs font-medium tracking-wide">
                Tap the floating orbs while you wait
              </p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes floatUp {
          0% {
            transform: translateY(0) scale(0.6) rotate(0deg);
            opacity: 0;
          }
          10% {
            transform: translateY(-5vh) scale(1) rotate(5deg);
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            transform: translateY(-110vh) scale(1.1) rotate(45deg);
            opacity: 0;
          }
        }
        @keyframes popIn {
          0% { transform: scale(0.8); opacity: 0; }
          60% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

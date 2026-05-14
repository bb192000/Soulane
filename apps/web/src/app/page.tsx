import React from 'react';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F7] font-sans selection:bg-[#39FF14]/30">
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#39FF14]/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#39FF14]/5 blur-[120px] rounded-full" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex justify-between items-center px-8 py-6 max-w-7xl mx-auto">
        <div className="text-2xl font-black tracking-tighter text-[#39FF14]">SOULANE</div>
        <div className="flex gap-8 text-sm font-bold tracking-widest text-[#8E8E93]">
          <Link href="/about" className="hover:text-[#39FF14] transition-colors">ABOUT</Link>
          <Link href="/manifesto" className="hover:text-[#39FF14] transition-colors">MANIFESTO</Link>
          <Link href="/login" className="bg-[#1C1C1E] px-6 py-2 rounded-full border border-[#2C2C2E] hover:border-[#39FF14] transition-all">CONNECT</Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="relative z-10 flex flex-col items-center justify-center pt-32 px-6 text-center max-w-4xl mx-auto">
        <div className="inline-block px-4 py-1 mb-8 rounded-full bg-[#1C1C1E] border border-[#2C2C2E] text-[10px] font-black tracking-[0.3em] text-[#39FF14] animate-pulse">
          PHASE 3: WEB SYNC ACTIVE
        </div>
        
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] mb-8">
          The Universe <br /> 
          <span className="text-[#39FF14]">is Out of Sync.</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-[#8E8E93] font-medium max-w-2xl leading-relaxed mb-12">
          Experience emotional synchronization. Listen together across devices, across platforms, across the void.
        </p>

        <div className="flex flex-col md:row gap-6 w-full max-w-md">
          <Link href="/rooms/create" className="group relative bg-[#39FF14] text-[#0A0A0A] px-12 py-5 rounded-2xl font-black text-lg tracking-tight hover:scale-[1.02] transition-all overflow-hidden">
            <span className="relative z-10">OPEN A NEW LANE</span>
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          </Link>
          
          <Link href="/download" className="bg-[#1C1C1E] border border-[#2C2C2E] text-[#F5F5F7] px-12 py-5 rounded-2xl font-black text-lg tracking-tight hover:bg-[#2C2C2E] transition-all">
            GET THE MOBILE APP
          </Link>
        </div>

        {/* Feature Grid Preview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-32 w-full text-left">
          <div className="p-8 rounded-3xl bg-[#1C1C1E]/50 border border-[#2C2C2E] backdrop-blur-xl">
            <div className="w-12 h-12 rounded-xl bg-[#39FF14]/10 flex items-center justify-center mb-6">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#39FF14" strokeWidth="3"><path d="M12 2v20M2 12h20" /></svg>
            </div>
            <h3 className="text-xl font-bold mb-3">Millisecond Precision</h3>
            <p className="text-[#8E8E93] text-sm leading-relaxed">Proprietary drift correction keeps your group in perfect emotional alignment.</p>
          </div>
          
          <div className="p-8 rounded-3xl bg-[#1C1C1E]/50 border border-[#2C2C2E] backdrop-blur-xl">
            <div className="w-12 h-12 rounded-xl bg-[#39FF14]/10 flex items-center justify-center mb-6">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#39FF14" strokeWidth="3"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
            </div>
            <h3 className="text-xl font-bold mb-3">Multi-Platform Flux</h3>
            <p className="text-[#8E8E93] text-sm leading-relaxed">Start on your phone. Finish on your laptop. The session never breaks.</p>
          </div>

          <div className="p-8 rounded-3xl bg-[#1C1C1E]/50 border border-[#2C2C2E] backdrop-blur-xl">
            <div className="w-12 h-12 rounded-xl bg-[#39FF14]/10 flex items-center justify-center mb-6">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#39FF14" strokeWidth="3"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            </div>
            <h3 className="text-xl font-bold mb-3">The Shadow Security</h3>
            <p className="text-[#8E8E93] text-sm leading-relaxed">Enterprise-grade encryption for your shared listening sessions.</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-32 py-12 border-t border-[#1C1C1E] text-center">
        <p className="text-[#3C3C3E] text-[10px] font-black tracking-[0.5em] uppercase">© 2026 Soulane Autonomous Task Force</p>
      </footer>
    </div>
  );
}

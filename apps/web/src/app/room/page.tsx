"use client";

import React, { useState, useEffect } from 'react';
import { SyncEngine, RoomState, SyncTelemetry } from '@soulane/shared';

export default function RoomPage() {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [telemetry, setTelemetry] = useState<SyncTelemetry | null>(null);

  // Mocking the sync loop for Phase 3 visualization
  useEffect(() => {
    const timer = setInterval(() => {
      if (room?.isPlaying) {
        setTelemetry(prev => ({
          positionMs: (prev?.positionMs || 0) + 1000,
          timestamp: Date.now(),
          confidence: 0.95,
          isReconciling: false
        }));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [room?.isPlaying]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F7] p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-16">
          <div className="text-xl font-black text-[#39FF14] tracking-tighter">SOULANE ROOM</div>
          <div className="flex items-center gap-4">
            <div className={`w-2 h-2 rounded-full ${telemetry?.confidence && telemetry.confidence > 0.8 ? 'bg-[#39FF14]' : 'bg-orange-500'} animate-pulse`} />
            <span className="text-[10px] font-black tracking-widest text-[#8E8E93]">SYNC STATUS: {telemetry?.confidence ? 'LOCKED' : 'CONNECTING'}</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Track Info (Left/Center) */}
          <div className="lg:col-span-2">
            <div className="aspect-square w-full max-w-md rounded-3xl bg-[#1C1C1E] border border-[#2C2C2E] mb-8 overflow-hidden relative shadow-2xl">
              {room?.currentTrack?.albumArt ? (
                <img src={room.currentTrack.albumArt} alt="Album Art" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-[#39FF14]/5 border border-[#39FF14]/20 animate-ping" />
                </div>
              )}
            </div>
            
            <h1 className="text-4xl font-black tracking-tight mb-2">{room?.currentTrack?.name || 'Waiting for the Vibe...'}</h1>
            <p className="text-[#8E8E93] text-xl font-medium mb-12">{room?.currentTrack?.artists.join(', ') || 'Connect a Spotify source to begin.'}</p>

            {/* Progress */}
            <div className="space-y-4 mb-12">
              <div className="h-2 w-full bg-[#1C1C1E] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#39FF14] shadow-[0_0_15px_#39FF14] transition-all duration-1000" 
                  style={{ width: `${(telemetry?.positionMs || 0) / (room?.currentTrack?.durationMs || 100000) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-black tracking-widest text-[#4C4C4E]">
                <span>{Math.floor((telemetry?.positionMs || 0) / 1000)}s</span>
                <span>{Math.floor((room?.currentTrack?.durationMs || 100000) / 1000)}s</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-8">
              <button className="w-16 h-16 rounded-full bg-[#1C1C1E] border border-[#2C2C2E] flex items-center justify-center hover:border-[#39FF14] transition-all group">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="group-hover:text-[#39FF14]"><path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" /></svg>
              </button>
              
              <button 
                onClick={() => setRoom(prev => prev ? {...prev, isPlaying: !prev.isPlaying} : null)}
                className="w-24 h-24 rounded-full bg-[#39FF14] flex items-center justify-center hover:scale-105 transition-all shadow-[0_0_30px_rgba(57,255,20,0.3)]"
              >
                <div className="text-[#0A0A0A]">
                  {room?.isPlaying ? (
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                  ) : (
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="ml-2"><path d="M8 5v14l11-7z"/></svg>
                  )}
                </div>
              </button>

              <button className="w-16 h-16 rounded-full bg-[#1C1C1E] border border-[#2C2C2E] flex items-center justify-center hover:border-[#39FF14] transition-all group">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="group-hover:text-[#39FF14]"><path d="M13 17l5-5-5-5M6 17l5-5-5-5" /></svg>
              </button>
            </div>
          </div>

          {/* Sidebar (Listeners & Chat) */}
          <div className="space-y-12">
            <div>
              <h2 className="text-[10px] font-black tracking-[0.3em] text-[#8E8E93] mb-6 uppercase">Souls in Sync</h2>
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-[#1C1C1E]/50 border border-[#2C2C2E]">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#39FF14] to-[#1C1C1E]" />
                    <div className="flex-1">
                      <div className="text-sm font-bold">Listener_{i}</div>
                      <div className="text-[10px] text-[#39FF14] font-black tracking-widest uppercase">Sync Locked</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 rounded-3xl bg-[#1C1C1E] border border-[#2C2C2E] relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4">
                <div className="px-2 py-1 rounded-md bg-[#39FF14]/10 text-[#39FF14] text-[8px] font-black">ENCRYPTED</div>
              </div>
              <h3 className="text-lg font-bold mb-4 italic">"The music is the bridge."</h3>
              <p className="text-sm text-[#8E8E93] leading-relaxed">Your session is being guarded by The Shadow. All emotional telemetry is end-to-end encrypted.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

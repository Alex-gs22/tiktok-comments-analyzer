"use client";

import Sidebar from './Sidebar';
import { SidebarStateProvider } from './SidebarStateContext';
import { VideoAnalysisProvider } from './VideoAnalysisContext';

export default function AppShell({ children }) {
  return (
    <SidebarStateProvider>
      <VideoAnalysisProvider>
        <Sidebar />
        <main className="flex-1 h-screen overflow-y-scroll relative">
          {children}
        </main>
      </VideoAnalysisProvider>
    </SidebarStateProvider>
  );
}

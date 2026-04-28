"use client";

import Sidebar from './Sidebar';
import { SidebarStateProvider } from './SidebarStateContext';

export default function AppShell({ children }) {
  return (
    <SidebarStateProvider>
      <Sidebar />
      <main className="flex-1 h-screen overflow-y-scroll relative">
        {children}
      </main>
    </SidebarStateProvider>
  );
}
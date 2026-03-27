"use client";

import { ZkLoginProvider } from "@/context/ZkLoginContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <ZkLoginProvider>{children}</ZkLoginProvider>;
}

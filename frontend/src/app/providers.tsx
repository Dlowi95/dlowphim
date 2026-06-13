"use client";

import { HeroUIProvider } from "@heroui/react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthContextProvider } from "@/context/AuthContext";

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthContextProvider>
        <HeroUIProvider>
          {children}
        </HeroUIProvider>
      </AuthContextProvider>
    </GoogleOAuthProvider>
  );
}
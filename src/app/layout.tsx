import type { Metadata } from 'next';
import { Toaster } from "@/components/ui/toaster"

import { SupabaseAuthProvider } from '@/context/SupabaseAuthContext';
import './globals.css';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'BIMCoach Studio',
  description: 'Eine interaktive Plattform für die Analyse von Architekturentwürfen.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Code+Pro&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <Script id="ifcjs-wasm-path" strategy="beforeInteractive">
          {`
            (function(){
              var p = '/wasm/';
              try { window.WEBIFC_PATH = p; } catch(e){}
              try { window.webIfcWasmPath = p; } catch(e){}
              try { window.ifcjsWasmPath = p; } catch(e){}
            })();
          `}
        </Script>
        <SupabaseAuthProvider>
          {children}
          <Toaster />
        </SupabaseAuthProvider>
      </body>
    </html>
  );
}

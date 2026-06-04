import type { Metadata } from "next";
import { Inter, Bungee, Cinzel, Creepster, Permanent_Marker, Pacifico } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import NavbarComponent from "@/components/Navbar";
import FooterComponent from "@/components/Footer";

const inter = Inter({ subsets: ["latin"] });
const bungee = Bungee({ weight: "400", subsets: ["latin"], variable: "--font-bungee" });
const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-cinzel" });
const creepster = Creepster({ weight: "400", subsets: ["latin"], variable: "--font-creepster" });
const marker = Permanent_Marker({ weight: "400", subsets: ["latin"], variable: "--font-marker" });
const pacifico = Pacifico({ weight: "400", subsets: ["latin"], variable: "--font-pacifico" });

export const metadata: Metadata = {
  title: "DlowPhim - Trải Nghiệm Điện Ảnh Premium",
  description: "Website xem phim tốc độ cao, giao diện cinema chuẩn đồ án.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="dark">
      <body className={`${inter.className} ${bungee.variable} ${cinzel.variable} ${creepster.variable} ${marker.variable} ${pacifico.variable} antialiased bg-black text-white min-h-screen flex flex-col`}>
        <Providers>
          <NavbarComponent />
          
          <main className="flex-grow">
            {children}
          </main>
          
          <FooterComponent />
        </Providers>
      </body>
    </html>
  );
}
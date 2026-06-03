import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import NavbarComponent from "@/components/Navbar";
import FooterComponent from "@/components/Footer";

const inter = Inter({ subsets: ["latin"] });

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
      <body className={`${inter.className} antialiased bg-black text-white min-h-screen flex flex-col`}>
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
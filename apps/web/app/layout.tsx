// Root layout for the Next.js app. Wraps every page with the HTML shell and
// global styles. No layout logic — just structure and metadata.
import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });

export const metadata: Metadata = {
  title: "Little Wins",
  description: "Celebrate your small moments and see your progress over time.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${bricolage.variable}`}>
      <body className="mx-auto max-w-2xl px-4 py-10 font-sans text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}

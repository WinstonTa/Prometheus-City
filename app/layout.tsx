import type { Metadata, Viewport } from "next";
import { Chakra_Petch, Orbitron } from "next/font/google";
import "./globals.css";

const orbitron = Orbitron({ subsets: ["latin"], weight: ["500", "700", "900"], variable: "--font-orbitron" });
const chakra = Chakra_Petch({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-chakra" });

export const metadata: Metadata = {
  title: "Prometheus City",
  description: "A floating sci-fi city above a sea of clouds. Explore and chat with up to 10 travelers in real time.",
};

export const viewport: Viewport = {
  themeColor: "#05070d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${orbitron.variable} ${chakra.variable}`}>
      <body>{children}</body>
    </html>
  );
}

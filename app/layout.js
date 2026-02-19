import "./globals.css";
import { Jost } from "next/font/google";

const jost = Jost({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

export const metadata = {
  title: "FAIR TPRM Training Tool",
  description: "Training-only FAIR-based Third Party Risk Management tool",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={jost.variable}>{children}</body>
    </html>
  );
}

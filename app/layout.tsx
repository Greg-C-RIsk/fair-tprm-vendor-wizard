import "./styles.css";

export const metadata = {
  title: "FAIR TPRM Vendor Wizard",
  description: "Guided FAIR-based Third Party Risk Management tool",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

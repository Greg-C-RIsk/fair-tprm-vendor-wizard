export const metadata = {
  title: "FAIR TPRM Training Tool",
  description: "Training-only FAIR-based Third Party Risk Management tool",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

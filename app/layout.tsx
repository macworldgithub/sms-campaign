import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Booran • Loyalty Studio",
  description: "South Morang Hyundai campaign operations",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { Toaster } from "react-hot-toast";
import thryveLogo from "@/app/thryve.png";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "ThryveUp | Productivity & Expense Manager",
  description: "Organize your workflow, schedule events, manage expenses, and track loans seamlessly.",
  icons: {
    icon: thryveLogo.src,
    shortcut: thryveLogo.src,
    apple: thryveLogo.src,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${outfit.variable} font-sans antialiased h-full bg-background text-foreground`}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "hsl(var(--card))",
              color: "hsl(var(--card-foreground))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "12px",
            },
          }}
        />
      </body>
    </html>
  );
}

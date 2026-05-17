import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeToggle } from "@/components/ThemeToggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Crossword Creator",
  description: "Create and solve crossword puzzles with a dense-intersection engine",
};

// Runs synchronously before React hydrates, applying the theme class to <html>
// to prevent a flash of unstyled content. Dark is the default; the user's
// stored preference (if they've used the toggle) overrides it.
const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('crossword-creator-theme');
    var theme = stored || 'dark';
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch (_) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <div className="fixed top-3 right-4 z-50">
          <ThemeToggle />
        </div>
      </body>
    </html>
  );
}

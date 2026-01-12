import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";
import { AuthProvider } from "@/providers/AuthProvider";
import { ThemeProvider } from "next-themes";
import { AppProviders } from "@/providers/AppProviders";
import { LanguageProvider } from "@/providers/LanguageProvider";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
    >
      <head />
      <body
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <LanguageProvider>
            <AuthProvider>
              <AppProviders>
                <NuqsAdapter>{children}</NuqsAdapter>
              </AppProviders>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}

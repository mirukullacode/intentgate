import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { site } from "@/lib/site";
import "./globals.css";

const sans = Geist({ variable: "--font-geist", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const serif = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "IntentGate · Intent enforcement for AI agents",
    template: "%s · IntentGate",
  },
  description: site.tagline,
  openGraph: {
    title: "IntentGate",
    description: site.tagline,
    url: site.url,
    siteName: "IntentGate",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "IntentGate", description: site.tagline },
};

/** Clerk is optional: without a publishable key the site renders exactly the same, minus sign-in. */
export const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function RootLayout({ children }: LayoutProps<"/">) {
  const shell = (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Nav clerk={clerkEnabled} />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
  return clerkEnabled ? (
    <ClerkProvider
      appearance={{
        variables: { colorPrimary: "#a78bfa", colorBackground: "#101016" },
      }}
    >
      {shell}
    </ClerkProvider>
  ) : (
    shell
  );
}

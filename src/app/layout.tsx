import type { Metadata, Viewport } from "next";
import ErrorBoundary from '@/components/ErrorBoundary';
import "./globals.css";

const SITE_URL = "https://altura.com.ec";
const SITE_NAME = "GAIA";
const SITE_TITLE = "GAIA — Sistema de Inspección Territorial SIAP | Mapa Interactivo Manta, Ecuador";
const SITE_DESCRIPTION = "GAIA por altura.com.ec — Sistema de Inspección Territorial SIAP. Mapa interactivo GPU-acelerado para inspectores en Manta, Ecuador. Recorridos en moto y a pie con fotos, videos georreferenciados, panel por inspector y simulación de rutas. Basado en OSIRIS.";

export const viewport: Viewport = {
  themeColor: "#17A7D2",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | OSIRIS Intelligence",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    // OSINT Tools - Primary focus
    "OSINT tools", "free OSINT tools", "online OSINT toolkit", "OSINT framework",
    "nmap online", "nmap scanner online", "free nmap scan", "port scanner online",
    "DNS lookup tool", "WHOIS lookup", "reverse DNS", "DNS records",
    "SSL certificate checker", "certificate transparency", "cert lookup",
    "BGP routing lookup", "ASN lookup", "IP geolocation",
    "threat intelligence", "threat intel lookup", "IP reputation check",
    "network reconnaissance", "recon tools", "penetration testing tools",
    "cybersecurity tools", "infosec tools", "security scanner",
    "linux OSINT tools", "kali linux tools online", "OSINT browser tools",
    
    // Intelligence Platform
    "OSINT", "open source intelligence", "intelligence platform", "global intelligence",
    "geospatial intelligence", "GEOINT", "SIGINT", "real-time tracking",
    "palantir alternative", "open source palantir", "intelligence dashboard",
    
    // Tracking & Data
    "flight tracker", "aircraft tracking", "ADS-B tracker", "live flight radar",
    "satellite tracking", "ISS tracker", "space station tracker",
    "CCTV cameras live", "security cameras worldwide", "live cameras",
    "earthquake monitor", "seismic activity", "USGS earthquake",
    "wildfire tracker", "NASA FIRMS", "active fires",
    "nuclear facilities map", "nuclear power plants",
    "severe weather alerts", "weather radar",
    "cyber threats dashboard", "CVE tracker",
    "space weather", "solar storm", "GPS jamming",
    "defense stocks", "commodities tracker",
    
    // Brand GAIA SIAP
    "gaia", "siap", "altura.com.ec", "manta", "ecuador", "inspeccion territorial",
    "osiris",
  ],
  authors: [{ name: "GAIA SIAP — altura.com.ec", url: SITE_URL }],
  creator: "GAIA SIAP",
  publisher: "altura.com.ec",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/android-chrome-192x192.png", type: "image/png", sizes: "192x192" },
      { url: "/android-chrome-512x512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
    ],
    shortcut: "/favicon.ico",
    other: [
      {
        rel: "apple-touch-icon-precomposed",
        url: "/apple-touch-icon.png",
      },
    ],
  },
  manifest: "/site.webmanifest",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: "GAIA — Sistema de Inspección Territorial SIAP | altura.com.ec",
    description: "GAIA SIAP por altura.com.ec — Mapa interactivo para inspectores en Manta, Ecuador. Recorridos en moto y a pie, fotos y videos georreferenciados, panel por inspector.",
    type: "website",
    siteName: SITE_NAME,
    locale: "es_EC",
    url: SITE_URL,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "GAIA — Sistema de Inspección Territorial SIAP — altura.com.ec",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GAIA SIAP — Inspección Territorial Manta | altura.com.ec",
    description: "Mapa interactivo SIAP: recorridos moto/a pie, evidencias foto/video, panel inspectores. GAIA por altura.com.ec",
    creator: "@altura_ec",
    site: "@altura_ec",
    images: [`${SITE_URL}/og-image.png`],
  },
  category: "technology",
  classification: "Inspección Territorial & OSINT",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "GAIA SIAP",
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#0A1A2E",
    "msapplication-config": "none",
  },
};

// JSON-LD Structured Data
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "GAIA — Sistema de Inspección Territorial SIAP",
  alternateName: ["GAIA", "GAIA SIAP", "altura.com.ec"],
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "MappingApplication",
  operatingSystem: "Web",
  browserRequirements: "Requires a modern web browser",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  },
  featureList: [
    "Recorridos de inspectores SIAP en moto y a pie con simulación en Manta, Ecuador",
    "Puntos de inspección georreferenciados con fotos y videos",
    "Panel por inspector con timeline, impacto y evidencias",
    "Mapa MapLibre GL GPU-acelerado con capas OSINT (vuelos, CCTV, sismos, incendios)",
    "Ruteo Valhalla/OSRM turn-by-turn con elevación",
    "Exportación GeoJSON de áreas inspeccionadas",
    "Capa SIAP con playback de recorrido y marca de progreso",
  ],
  screenshot: `${SITE_URL}/arco-color.png`,
  author: {
    "@type": "Organization",
    name: "altura.com.ec — GAIA SIAP",
    url: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="canonical" href={SITE_URL} />
        
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

      </head>
      <body className="antialiased">
        <ErrorBoundary name="GAIA Core">
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}

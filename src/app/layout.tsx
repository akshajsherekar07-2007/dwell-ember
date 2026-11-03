import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata:Metadata={title:"Dwell Ember — A place for your next chapter",description:"Find a place. Take your time. Thoughtful student housing, protected decision windows, and a fair turn for everyone."};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en" data-scroll-behavior="smooth"><body>{children}</body></html>;
}

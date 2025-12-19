import "./globals.css";
import { Poppins } from "next/font/google";
import Script from "next/script";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"], // Specify the weights you need
});

export const metadata = {
  title: "Picapool - Polling Website",
  description: "At Picapool, we believe in the power of collaboration for bigger savings. Our platform connects people looking for the similar products, allowing them to pool their orders and access exclusive discounts. Join our community of smart shoppers and discover a new way to save. Start maximizing your savings with Picapool today.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <Script
        strategy="afterInteractive"
        src="https://www.googletagmanager.com/gtag/js?id=G-67R15PX4LC"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-67R15PX4LC');`}
      </Script>
      <body
        className={`${poppins.className} bg-white w-screen text-black overflow-x-hidden`}
      >
        {children}
      </body>
    </html>
  );
}
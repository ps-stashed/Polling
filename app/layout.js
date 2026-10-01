import "./globals.css";
import Script from "next/script";

export const metadata = {
  title: "Picapool - Polling Website",
  description: "At Picapool, we believe in the power of collaboration for bigger savings. Our platform connects people looking for the similar products, allowing them to pool their orders and access exclusive discounts. Join our community of smart shoppers and discover a new way to save. Start maximizing your savings with Picapool today.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
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
        className="bg-white w-screen text-black overflow-x-hidden"
      >
        {children}
      </body>
    </html>
  );
}
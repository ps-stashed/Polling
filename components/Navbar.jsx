// components/Navbar.jsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Poppins } from "next/font/google";
import { motion } from "framer-motion";

const poppins = Poppins({
  weight: ["400", "700"],
  subsets: ["latin"],
});

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const toggleDropdown = () => setIsOpen(!isOpen);
  const closeDropdown = () => setIsOpen(false);

  const topLinks = [
    { name: "Home", path: "/" },
    { name: "Polling", path: "/polling" },
    { name: "About Us", path: "/about-us" },
    { name: "Partners", path: "https://partners.picapool.com/" },
    { name: "Picathon", path: "/picathon" },
    { name: "Contact Us", path: "/contact-us" },
  ];

  const bottomLinks = [
    { name: "FAQs and Blogs", path: "./how-it-works" },
    { name: "Policy & Conditions", path: "/privacy-policy" },
  ];

  const router = useRouter();

  return (
    <div className={`fixed w-full z-50 select-none ${poppins.className}`}>
      <div className="navbar sticky top-0 bg-white flex items-center justify-between py-3 shadow-lg px-5 md:px-20">
        {/* Logo */}
        <Link href="/" className="flex items-center cursor-pointer">
          <img className="h-10 ml-6 md:ml-10" alt="Picapool logo" src="/assets/logo.png" />
          <span className="text-[#FF8D41] text-lg md:text-2xl font-bold tracking-wider ml-4">
            Picapool
          </span>
        </Link>

        {/* Mobile toggle */}
        <div className="lg:hidden relative px-2">
          <button
            onClick={toggleDropdown}
            className="btn btn-ghost border-[rgba(255,141,65,0.8)] border-2 rounded-md p-2"
            aria-label="Open navigation"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
            </svg>
          </button>
        </div>

        {/* Mobile dropdown */}
        {isOpen && (
          <div className="absolute top-0 right-0 w-3/5 sm:w-1/2 h-screen bg-white shadow-md py-3 px-5 flex flex-col justify-between p-8">
            <button onClick={closeDropdown} className="absolute top-3 right-5" aria-label="Close menu">
              <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <ul className="flex flex-col mt-14 gap-2">
              {topLinks.map(({ name, path }, i) => (
                <li
                  key={i}
                  className={`cursor-pointer transition-all ${
                    path === router.pathname
                      ? "bg-gray-200 text-black font-semibold rounded-md"
                      : "text-[#1E1E1E] hover:bg-orange-200 hover:text-black rounded-md p-3 w-full"
                  }`}
                >
                  <Link href={path}>{name}</Link>
                </li>
              ))}
            </ul>

            <ul className="flex flex-col mt-auto gap-2">
              {bottomLinks.map(({ name, path }, index) => (
                <li
                  key={index}
                  className={`cursor-pointer transition-all ${
                    path === router.pathname
                      ? "bg-gray-200 text-black font-semibold rounded-md"
                      : "text-[#1E1E1E] hover:bg-orange-200 hover:text-black rounded-md p-3 w-full"
                  }`}
                >
                  <Link href={path}>{name}</Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Desktop links */}
        <div className="hidden lg:flex flex-grow">
          <ul className="flex gap-8 secondary_font text-md tracking-wider items-center ml-auto mr-10">
            {topLinks.map(({ name, path }, index) => {
              if (path === "/livepooling") {
                const active = router.pathname === path;
                return (
                  <li key={index}>
                    <Link
                      href={path}
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full transition-transform transform ${
                        active ? "scale-105" : "hover:scale-105"
                      }`}
                    >
                      <motion.span
                        aria-hidden
                        className="w-2.5 h-2.5 rounded-full bg-[#ff4d4d]"
                        animate={{ scale: [1, 1.5, 1] }}
                        transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
                      />
                      <span className="text-md font-medium text-[#1E1E1E]">Polling</span>
                    </Link>
                  </li>
                );
              }

              const isActive = router.pathname === path;
              return (
                <li
                  key={index}
                  className={`cursor-pointer transition-all hover:scale-105 transform duration-200 ease-in-out ${
                    isActive ? "font-semibold" : ""
                  }`}
                >
                  <Link href={path} className="text-md font-medium text-[#1E1E1E]">
                    {name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Navbar;

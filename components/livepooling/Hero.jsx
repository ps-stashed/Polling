"use client";
import React from "react";
import { motion } from "framer-motion";

/**
 * Hero — simplified, colorful, tasteful motion
 * - large gradient headline
 * - animated underline accent
 * - concise description
 * - two soft badges
 * - single responsive transparent SVG on right (desktop) / below (mobile)
 *
 * Place your file at: public/assets/image123.svg
 */
export default function Hero() {
  return (
    <section
      aria-label="Live Pooling hero"
      className="rounded-2xl p-6 md:p-10 shadow-md bg-gradient-to-br from-white via-[#fff8f0] to-[#fff0fb]"
      style={{
        minHeight: "50vh",
        display: "flex",
        alignItems: "center",
      }}
    >
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* Left Section: Text */}
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight"
            style={{ lineHeight: 1.02 }}
          >
            <span className="block text-slate-900">
              Choose what you want
            </span>
          </motion.h1>

          {/* Gradient underline accent */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.7, delay: 0.12 }}
            style={{ transformOrigin: "left" }}
            className="mt-4 h-1 rounded-full"
          >
            <div
              style={{
                height: 6,
                borderRadius: 999,
                background:
                  "orange",
              }}
            />
          </motion.div>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.28 }}
            className="mt-5 text-lg text-gray-700 max-w-prose"
          >
            Vote for products you love.
            Every vote helps bring the products you love at prices you’ll love more.
          </motion.p>

          {/* Feature badges */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.36 }}
            className="mt-6 flex gap-3 flex-wrap"
          >
            <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm shadow-sm">
              <span className="font-semibold">Vote</span>
            </div>

            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm shadow-sm">
              <span className="font-semibold">Pool</span>
            </div>

            <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm shadow-sm">
              <span className="font-semibold">Save</span>
            </div>
          </motion.div>
        </div>

        {/* Right Section: Transparent SVG image */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="w-full flex items-center justify-center"
        >
          <div className="w-full max-w-md md:max-w-none md:w-80 lg:w-96">
            {/* Transparent background container */}
            <div className="rounded-xl overflow-hidden border border-gray-100 bg-transparent">
              {/* Plain <img> for SVG transparency */}
              <img
                src="/assets/image123.svg"
                alt="Hero visual"
                width={640}
                height={420}
                className="object-contain w-full h-auto"
                loading="eager"
                style={{
                  display: "block",
                  backgroundColor: "transparent",
                }}
              />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

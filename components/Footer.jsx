'use client';
import React from "react";
import { BsFacebook } from "react-icons/bs";
import { BsLinkedin } from "react-icons/bs";
import { BsInstagram } from "react-icons/bs";
import { AiFillTwitterSquare } from "react-icons/ai";
import { BsTwitterX } from "react-icons/bs";

const Footer = () => {
  return (
    <div>
      <footer className="mt-10 px-24 footer footer-center pb-10 bg-[#1E1E1E] text-white flex flex-col md:flex-row md:justify-between p-5 md:py-24 select-none">
        <img
          src="/assets/logo_with_description.svg"
          alt="picapool logo"
          className="w-48 md:-mt-14"
        />
        <span className="border-white/10 border h-[5rem] hidden md:block"></span>
        <div className="text-[.9rem] md:-mt-14">
          <p className="text-white font-semibold text-3xl">Contact us!</p>
          <p>+91 7023425801</p>
          <p>srijan@picapool.com</p>
        </div>
        <span className="border-white/10 border h-[5rem] hidden md:block"></span>
        <div className="flex flex-col gap-2 -mt-2 md:-mt-14 my-10">
          <p className="text-white font-semibold text-2xl">Follow us!</p>
          <div className="flex flex-row gap-3 text-3xl mt-2 my-2">
            <a href="https://www.instagram.com/picapool_/" target="_blank" rel="noopener noreferrer">
              <BsInstagram />
            </a>
            <a href="https://in.linkedin.com/company/picapool" target="_blank" rel="noopener noreferrer">
              <BsLinkedin />
            </a>
            <a href="https://www.facebook.com/people/PicaPool/61561886925334/" target="_blank" rel="noopener noreferrer">
              <BsFacebook />
            </a>
          </div>
        </div>

      </footer>
      <div className="flex flex-col md:flex-row items-center md:justify-center gap-4 bg-[#1E1E1E] text-center px-4 py-4 -mt-16">
        {/* <p className="text-white cursor-pointer hover:underline">Privacy Policy</p> */}
        <a href="/privacy-policy" className="text-white cursor-pointer hover:underline">
          Privacy Policy
        </a>
        <a href="/terms-and-conditions" className="text-white cursor-pointer hover:underline">
          Terms & Conditions
        </a>
        <a
          href="/refund-policy" className="text-white cursor-pointer hover:underline">
          Refund Policy
        </a>

      </div>
      <div className="flex items-center justify-center bg-[#1E1E1E] h-15 text-center px-2">
        <p style={{ color: "rgba(153, 152, 152, 0.89)" }}>
          © 2025 Picapool, Kandi, Sangareddy, Telangana, India. All rights reserved.
        </p>
      </div>

    </div>
  );
};

export default Footer;

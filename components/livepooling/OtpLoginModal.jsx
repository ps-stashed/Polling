"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = "https://api.picapool.com/v2/otp";

export default function OtpLoginModal({
    open,
    onClose,
    onLoginSuccess
}) {
    const [step, setStep] = useState("PHONE"); // PHONE | OTP | NAME
    const [mobile, setMobile] = useState("");
    const [otp, setOtp] = useState("");
    const [name, setName] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [resendTimer, setResendTimer] = useState(0);

    // Focus refs
    const mobileInputRef = useRef(null);
    const otpInputRef = useRef(null);
    const nameInputRef = useRef(null);

    useEffect(() => {
        if (open) {
            setStep("PHONE");
            setMobile("");
            setOtp("");
            setName("");
            setError("");
            setLoading(false);
            setTimeout(() => mobileInputRef.current?.focus(), 100);
        }
    }, [open]);

    useEffect(() => {
        let interval;
        if (resendTimer > 0) {
            interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [resendTimer]);

    // Focus management on step change
    useEffect(() => {
        if (step === "OTP") setTimeout(() => otpInputRef.current?.focus(), 100);
        if (step === "NAME") setTimeout(() => nameInputRef.current?.focus(), 100);
    }, [step]);

    const handleSendOtp = async () => {
        setError("");
        const cleanNum = mobile.replace(/\D/g, "");
        if (cleanNum.length < 10) {
            setError("Please enter a valid mobile number");
            return;
        }

        // Ensure +91 for Indian users if not present, but API might expect just digits or specific format.
        // User request said "+91 fix". Let's assume we send the full number with country code if possible, 
        // or just append 91 if it looks like a 10 digit number.
        let numToSend = cleanNum;
        if (cleanNum.length === 10) {
            numToSend = "91" + cleanNum;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}?mobile=${numToSend}`, { method: "POST" });
            if (!res.ok) throw new Error("Failed to send OTP");

            setStep("OTP");
            setResendTimer(30);
        } catch (err) {
            console.error(err);
            setError("Failed to send OTP. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        setError("");
        if (otp.length < 4) {
            setError("Please enter valid OTP");
            return;
        }

        const cleanNum = mobile.replace(/\D/g, "");
        let numToSend = cleanNum;
        if (cleanNum.length === 10) numToSend = "91" + cleanNum;

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/verify?otp=${otp}&mobile=${numToSend}`);
            const data = await res.json();

            if (data.success) {
                // Check if we already have a name for this user in local storage or if we need to ask
                // For now, per requirements, we ALWAYS ask name if we don't have it. 
                // But since this is a fresh login, let's move to NAME step to be sure, 
                // OR if the API returned a name (unlikely for this simple OTP API), use it.
                // The user request says: "if users name and number is not there then do ask"
                // So we proceed to NAME step.
                setStep("NAME");
            } else {
                setError(data.message || "Invalid OTP");
            }
        } catch (err) {
            console.error(err);
            setError("Verification failed");
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        if (resendTimer > 0) return;
        setError("");
        const cleanNum = mobile.replace(/\D/g, "");
        let numToSend = cleanNum;
        if (cleanNum.length === 10) numToSend = "91" + cleanNum;

        setLoading(true);
        try {
            await fetch(`${API_BASE}/retry?mobile=${numToSend}`);
            setResendTimer(30);
            setError("OTP Resent!");
            setTimeout(() => setError(""), 2000); // Clear success message
        } catch (err) {
            setError("Failed to resend");
        } finally {
            setLoading(false);
        }
    };

    const handleFinalSubmit = () => {
        if (!name.trim()) {
            setError("Please enter your name");
            return;
        }

        const cleanNum = mobile.replace(/\D/g, "");
        let finalNum = cleanNum;
        if (cleanNum.length === 10) finalNum = "+91 " + cleanNum; // Format for display/storage

        onLoginSuccess({ name: name.trim(), number: finalNum });
        onClose();
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-slate-800">
                            {step === "PHONE" && "Login to Continue"}
                            {step === "OTP" && "Verify OTP"}
                            {step === "NAME" && "One last thing"}
                        </h3>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
                    </div>

                    <div className="space-y-4">
                        {step === "PHONE" && (
                            <div className="space-y-4">
                                <p className="text-sm text-slate-600">Enter your mobile number to vote or create polls.</p>
                                <div className="flex items-center border rounded-xl px-3 py-3 bg-slate-50 focus-within:ring-2 ring-blue-500/20 transition-all">
                                    <span className="text-slate-500 font-medium mr-2">+91</span>
                                    <input
                                        ref={mobileInputRef}
                                        value={mobile}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, "");
                                            if (val.length <= 10) setMobile(val);
                                        }}
                                        className="bg-transparent w-full outline-none text-lg font-medium text-slate-800 placeholder:text-slate-400"
                                        placeholder="Mobile Number"
                                        type="tel"
                                        maxLength={10}
                                        autoFocus
                                    />
                                </div>
                                <button
                                    onClick={handleSendOtp}
                                    disabled={mobile.length < 10 || loading}
                                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98]"
                                >
                                    {loading ? "Sending..." : "Send OTP"}
                                </button>
                            </div>
                        )}

                        {step === "OTP" && (
                            <div className="space-y-4">
                                <p className="text-sm text-slate-600">
                                    Enter the 4-digit OTP sent to <span className="font-semibold">+91 {mobile}</span>
                                    <button onClick={() => setStep("PHONE")} className="ml-2 text-blue-600 text-xs font-bold hover:underline">Edit</button>
                                </p>

                                <input
                                    ref={otpInputRef}
                                    value={otp}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, "");
                                        if (val.length <= 4) setOtp(val);
                                    }}
                                    className="w-full text-center text-3xl font-bold tracking-widest py-3 border-b-2 border-slate-200 focus:border-blue-600 outline-none bg-transparent transition-colors"
                                    placeholder="••••"
                                    type="tel"
                                    maxLength={4}
                                    autoFocus
                                />

                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500">Didn't receive code?</span>
                                    <button
                                        onClick={handleResendOtp}
                                        disabled={resendTimer > 0 || loading}
                                        className={`font-semibold ${resendTimer > 0 ? "text-slate-400" : "text-blue-600 hover:text-blue-700"}`}
                                    >
                                        {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
                                    </button>
                                </div>

                                <button
                                    onClick={handleVerifyOtp}
                                    disabled={otp.length < 4 || loading}
                                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98]"
                                >
                                    {loading ? "Verifying..." : "Verify & Login"}
                                </button>
                            </div>
                        )}

                        {step === "NAME" && (
                            <div className="space-y-4">
                                <p className="text-sm text-slate-600">Please enter your name to complete your profile.</p>
                                <input
                                    ref={nameInputRef}
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full border rounded-xl px-4 py-3 bg-slate-50 focus:ring-2 ring-blue-500/20 outline-none text-lg text-slate-800 placeholder:text-slate-400 transition-all"
                                    placeholder="Your Name"
                                    autoFocus
                                />
                                <button
                                    onClick={handleFinalSubmit}
                                    disabled={!name.trim()}
                                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98]"
                                >
                                    Complete
                                </button>
                            </div>
                        )}

                        {error && (
                            <div className="text-red-500 text-sm text-center font-medium bg-red-50 py-2 rounded-lg">
                                {error}
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getPicapoolToken, PICAPOOL_API_BASE } from "@/lib/picapoolAuth";

export default function ReasonModal({
    open,
    onClose,
    onSubmit,
    user, // { name, number } or null
    onLoginSuccess, // (user) => void
    visitorId = null
}) {
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");

    // Login states
    const [step, setStep] = useState("PHONE"); // PHONE | OTP | DETAILS | DONE (if user exists, starts at DETAILS/DONE logic)
    const [mobile, setMobile] = useState("");
    const [otp, setOtp] = useState("");
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);
    const [verified, setVerified] = useState(false);

    const inputRef = useRef(null);
    const otpInputRef = useRef(null);
    const nameInputRef = useRef(null);

    useEffect(() => {
        if (open) {
            setReason("");
            setError("");

            if (user) {
                setStep("DETAILS");
                setVerified(true);
                setMobile(user.number?.replace("+91 ", "") || "");
                setName(user.name || "");
                setTimeout(() => inputRef.current?.focus(), 100);
            } else {
                setStep("PHONE");
                setVerified(false);
                setMobile("");
                setOtp("");
                setName("");
                setLoading(false);
            }
        }
    }, [open, user]);

    useEffect(() => {
        let interval;
        if (resendTimer > 0) {
            interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [resendTimer]);

    const handleSendOtp = async () => {
        setError("");
        const cleanNum = mobile.replace(/\D/g, "");
        if (cleanNum.length < 10) {
            setError("Please enter a valid mobile number");
            return;
        }

        let numToSend = cleanNum;
        if (cleanNum.length === 10) numToSend = "91" + cleanNum;

        setLoading(true);
        try {
            const token = await getPicapoolToken(visitorId);
            const res = await fetch(`${PICAPOOL_API_BASE}/v1/auth/otp/request`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    ...(token ? { Authorization: token } : {}),
                },
                body: JSON.stringify({ phone: numToSend, ttl_seconds: 300 }),
            });
            if (!res.ok) throw new Error("Failed to send OTP");

            setStep("OTP");
            setResendTimer(30);
            setTimeout(() => otpInputRef.current?.focus(), 100);
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
            const token = await getPicapoolToken(visitorId);
            const res = await fetch(`${PICAPOOL_API_BASE}/v1/auth/otp/verify`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    ...(token ? { Authorization: token } : {}),
                },
                body: JSON.stringify({
                    code: otp,
                    device_id: visitorId || "web-visitor",
                    meta_device_data: {},
                    phone: numToSend,
                }),
            });
            const data = await res.json();

            if (data.success) {
                if (data.data?.user?.name) setName(data.data.user.name);
                setVerified(true);
                setStep("DETAILS");
                setTimeout(() => nameInputRef.current?.focus(), 100);
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

    const handleSubmit = () => {
        if (!verified && !user) {
            setError("Please verify your mobile number first");
            return;
        }
        if (!name.trim()) {
            setError("Please enter your name");
            return;
        }

        let currentUser = user;
        // If we just logged in/verified, notify parent
        if (!user && verified) {
            const cleanNum = mobile.replace(/\D/g, "");
            const finalNum = cleanNum.length === 10 ? "+91 " + cleanNum : cleanNum;
            currentUser = { name: name.trim(), number: finalNum };
            onLoginSuccess(currentUser);
        }

        // Reason is optional now
        onSubmit(reason.trim(), currentUser);
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
                            Complete your vote
                        </h3>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
                    </div>

                    <div className="space-y-5">
                        {/* Identity Section (Number + OTP + Name) */}
                        <div className="space-y-4">
                            {/* Mobile Number */}
                            {!user && (
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-700">Mobile Number</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <span className="text-slate-500 font-medium">+91</span>
                                            </div>
                                            <input
                                                value={mobile}
                                                onChange={(e) => {
                                                    if (verified) return;
                                                    const val = e.target.value.replace(/\D/g, "");
                                                    if (val.length <= 10) setMobile(val);
                                                }}
                                                disabled={verified || step === "OTP"}
                                                className={`w-full border rounded-xl pl-12 pr-4 py-3 outline-none transition-all ${verified ? "bg-green-50 border-green-200 text-green-800" : "bg-slate-50 focus:ring-2 ring-blue-500/20"
                                                    }`}
                                                placeholder="Mobile Number"
                                                type="tel"
                                            />
                                            {verified && (
                                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                                    <span className="text-green-600 font-bold">✓</span>
                                                </div>
                                            )}
                                        </div>
                                        {!verified && step === "PHONE" && (
                                            <button
                                                onClick={handleSendOtp}
                                                disabled={mobile.length < 10 || loading}
                                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold rounded-xl transition-colors whitespace-nowrap"
                                            >
                                                {loading ? "..." : "Verify"}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* OTP Section - Responsive Fix */}
                            {!user && step === "OTP" && !verified && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3"
                                >
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-medium text-slate-700">Enter OTP</label>
                                        <button onClick={() => setStep("PHONE")} className="text-xs text-blue-600 font-medium">Change</button>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <input
                                            ref={otpInputRef}
                                            value={otp}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, "");
                                                if (val.length <= 4) setOtp(val);
                                            }}
                                            className="flex-1 border rounded-xl px-4 py-3 bg-white focus:ring-2 ring-blue-500/20 outline-none text-center tracking-widest font-bold text-lg w-full"
                                            placeholder="••••"
                                            maxLength={4}
                                            inputMode="numeric"
                                        />
                                        <button
                                            onClick={handleVerifyOtp}
                                            disabled={otp.length < 4 || loading}
                                            className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold rounded-xl transition-colors"
                                        >
                                            {loading ? "..." : "Confirm"}
                                        </button>
                                    </div>
                                    {resendTimer > 0 ? (
                                        <p className="text-xs text-slate-400 text-center">Resend in {resendTimer}s</p>
                                    ) : (
                                        <button onClick={handleSendOtp} className="text-xs text-blue-600 font-medium w-full text-center hover:underline">Resend OTP</button>
                                    )}
                                </motion.div>
                            )}

                            {/* Name Section - Integrated tightly */}
                            {(verified || user) && (
                                <motion.div
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-2"
                                >
                                    <label className="block text-sm font-medium text-slate-700">Your Name</label>
                                    <input
                                        ref={nameInputRef}
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        disabled={!!user}
                                        className="w-full border rounded-xl px-4 py-3 bg-slate-50 focus:ring-2 ring-blue-500/20 outline-none text-slate-800 placeholder:text-slate-400 transition-all"
                                        placeholder="Enter your name"
                                    />
                                </motion.div>
                            )}
                        </div>

                        {/* Reason Section */}
                        {(verified || user) && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="space-y-2 pt-2 border-t border-slate-100"
                            >
                                <div className="flex justify-between">
                                    <label className="block text-sm font-medium text-slate-700">Reason (Optional)</label>
                                    <span className="text-xs text-slate-400">Optional</span>
                                </div>
                                <textarea
                                    ref={inputRef}
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="w-full border rounded-xl px-4 py-3 bg-slate-50 focus:ring-2 ring-blue-500/20 outline-none text-base text-slate-800 placeholder:text-slate-400 transition-all resize-none"
                                    placeholder="Why did you choose this option?"
                                    rows={3}
                                />
                            </motion.div>
                        )}

                        {error && (
                            <div className="text-red-500 text-sm font-medium text-center bg-red-50 py-2 rounded-lg">
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleSubmit}
                            disabled={(!verified && !user) || !name.trim()}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-blue-600/20"
                        >
                            Submit Vote
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

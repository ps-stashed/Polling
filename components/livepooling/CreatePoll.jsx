"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getPicapoolToken, PICAPOOL_API_BASE } from "@/lib/picapoolAuth";

/**
 * Icons - Using SVGs for those not replaced by assets
 */
const GlobeIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
  </svg>
);

const PlusIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

// Constants
const CREATE_URL = `${PICAPOOL_API_BASE}/v1/Polling`;
const RED_RING = "ring-2 ring-red-500 ring-offset-2";

// Helper: Check image URL (Robust version)
const probeImageUrl = (src) => new Promise((resolve) => {
  if (!src) return resolve({ ok: false, reason: "empty" });
  if (src.includes("vimg")) return resolve({ ok: true, reason: "vimg" }); // Internal check
  try { if (!src.startsWith("data:")) new URL(src); } catch { return resolve({ ok: false, reason: "bad-url" }); }

  const img = new Image();
  //try { img.crossOrigin = "anonymous"; } catch (e) {}
  let settled = false;
  const onLoad = () => { if (settled) return; settled = true; cleanup(); resolve({ ok: true, reason: "loaded" }); };
  const onError = () => { if (settled) return; settled = true; cleanup(); resolve({ ok: false, reason: "load-failed" }); };
  const timeout = setTimeout(() => { if (settled) return; settled = true; cleanup(); resolve({ ok: false, reason: "timeout" }); }, 6000);
  function cleanup() { clearTimeout(timeout); img.onload = null; img.onerror = null; }
  img.onload = onLoad;
  img.onerror = onError;
  img.src = src;
});

// Helper to get placeholders for options
const getOptionPlaceholder = (index) => {
  switch (index) {
    case 0: return "e.g. Yes";
    case 1: return "e.g. No";
    case 2: return "e.g. Maybe";
    case 3: return "e.g. I don't know";
    default: return `Option ${index + 1}`;
  }
};

export default function CreatePoll({
  onCreated = () => { },
  initialOpen = false,
  controlledOpen = undefined,
  setControlledOpen = undefined,
  isLoggedIn = false,
  requestLogin = () => { },
  user = null,
  visitorId = null
}) {
  const isControlled = typeof controlledOpen !== "undefined" && typeof setControlledOpen === "function";
  const [internalOpen, setInternalOpen] = useState(Boolean(initialOpen));
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen : setInternalOpen;

  useEffect(() => {
    if (!isControlled) setInternalOpen(Boolean(initialOpen));
  }, [initialOpen, isControlled]);

  const [view, setView] = useState("main"); // 'main' | 'imageInput' | 'linkInput'
  const [imageTab, setImageTab] = useState("link"); // 'link' | 'upload'

  // Data State
  const [productName, setProductName] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [imageUrl, setImageUrl] = useState("");
  const [productLink, setProductLink] = useState("");

  // Sub-View State
  const [tempInput, setTempInput] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [subViewError, setSubViewError] = useState("");
  const [mainError, setMainError] = useState(""); // 'image' | 'options' | 'name' | ''

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  // --- Reset ---
  const resetForm = () => {
    setProductName("");
    setOptions(["", ""]);
    setImageUrl("");
    setProductLink("");
    setView("main");
    setTempInput("");
    setMainError("");
    setSubViewError("");
    setSuccess(false);
    setSubmitting(false);
    setUploading(false);
    setImageTab("link");
  };

  const handleClose = () => {
    if (!submitting) {
      setOpen(false);
      resetForm();
    }
  };

  // --- Handlers ---

  const handleOpenImageInput = () => {
    setTempInput(imageUrl);
    setSubViewError("");
    setView("imageInput");
  };

  const handleOpenLinkInput = () => {
    setTempInput(productLink);
    setSubViewError("");
    setView("linkInput");
  };

  const handleInsertImage = async () => {
    if (!tempInput.trim()) {
      setSubViewError("Please enter a URL");
      return;
    }
    setIsChecking(true);
    const result = await probeImageUrl(tempInput.trim());
    setIsChecking(false);

    if (result.ok) {
      setImageUrl(tempInput.trim());
      setMainError("");
      setView("main");
    } else {
      setSubViewError("Invalid image URL. Please check the link.");
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Basic validation
    if (!file.type.startsWith("image/")) {
      setSubViewError("Please upload an image file (JPG, PNG, etc).");
      return;
    }
    // 10MB limit (ImgBB limit is higher but 5-10MB is reasonable)
    if (file.size > 10 * 1024 * 1024) {
      setSubViewError("File too large. Please upload an image under 10MB.");
      return;
    }

    setSubViewError("");
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("image", file);
      // NOTE: Using environment variable for security
      // Ensure .env.local exists with NEXT_PUBLIC_IMGBB_API_KEY=...
      const API_KEY = process.env.NEXT_PUBLIC_IMGBB_API_KEY; // Loaded from .env.local

      if (!API_KEY) {
        throw new Error("Configuration error: Missing ImgBB API Key");
      }

      const res = await fetch(`https://api.imgbb.com/1/upload?key=${API_KEY}`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setImageUrl(data.data.url);
        setMainError("");
        setView("main");
      } else {
        throw new Error(data.error?.message || "Upload failed");
      }

    } catch (err) {
      console.error("Upload error:", err);
      setSubViewError("Failed to upload image. Reason: " + (err.message || "Unknown error"));
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  };

  const handleInsertLink = () => {
    if (tempInput.trim() && !tempInput.startsWith("http")) {
      setSubViewError("Link must start with http:// or https://");
      return;
    }
    setProductLink(tempInput.trim());
    setView("main");
  };

  const handleAddOption = () => {
    if (options.length < 4) setOptions([...options, ""]);
  };

  const handleOptionChange = (index, val) => {
    const newOpts = [...options];
    newOpts[index] = val;
    setOptions(newOpts);
  };

  // --- Main Logic: Post Poll to API ---
  const handlePostPoll = async () => {
    setMainError(""); // Reset error state

    if (!isLoggedIn) {
      requestLogin();
      return;
    }

    // 1. Check Product Name
    if (!productName.trim()) {
      alert("Please enter a product name.");
      setMainError("name");
      return;
    }

    // 2. Check Min 2 Options
    const filledOptions = options.filter(o => o.trim().length > 0);
    if (filledOptions.length < 2) {
      alert("Please provide at least 2 options.");
      setMainError("options");
      return;
    }

    // 3. Check Image (Compulsory)
    if (!imageUrl) {
      setMainError("image");
      return;
    }

    setSubmitting(true);

    let qToSend = "Do you want to pool this product ?";
    if (user && user.number) {
      // Append user details for backend/admin visibility, hidden in frontend
      qToSend += ` ${user.number}`;
      if (user.name) qToSend += ` | ${user.name}`;
    }

    const payload = {
      productName: productName.trim(),
      imageUrl: imageUrl.trim(),
      creator: "USER",
      productUrls: productLink ? [productLink.trim()] : [],
      options: filledOptions,
      question: qToSend
    };

    try {
      const token = await getPicapoolToken(visitorId);
      const res = await fetch(CREATE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "*/*",
          ...(token ? { Authorization: token } : {}),
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text().catch(() => "");
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch { }
      if (!res.ok) throw new Error(`create failed ${res.status} ${text || ""}`);

      // Success
      setSuccess(true);
      const serverData = (json && (json.data || json)) || null;
      let createdCard;

      if (serverData && serverData.id) {
        createdCard = {
          source: serverData.creator ?? "USER",
          product: {
            id: serverData.productId ?? (serverData.pollProduct?.id ?? `local_${Date.now()}`),
            productName: serverData.pollProduct?.productName ?? productName,
            imageUrl: serverData.pollProduct?.imageUrl ?? imageUrl,
            productUrls: serverData.pollProduct?.productUrls ?? (productLink ? [productLink] : []),
            createdAt: serverData.pollProduct?.createdAt ?? new Date().toISOString()
          },
          poll: {
            id: serverData.id,
            question: serverData.question ?? qToSend,
            options: (serverData.options || []).map(o => ({ id: o.id, text: o.text ?? o.label ?? String(o.id), label: o.text ?? o.label ?? String(o.id), count: o.count ?? 0 })),
            createdAt: serverData.createdAt ?? new Date().toISOString(),
            expiryDate: serverData.expiryDate ?? null
          }
        };
      } else {
        createdCard = {
          source: payload.creator || "USER",
          product: { id: `local_${Date.now()}`, productName, imageUrl },
          poll: {
            id: `local_poll_${Date.now()}`,
            question: qToSend,
            options: payload.options.map((o, i) => ({ id: `opt_${Date.now()}_${i}`, text: o, label: o, count: 0 })),
            pending: true
          }
        };
      }

      onCreated(createdCard);

      const serverPollId = serverData && serverData.id ? serverData.id : null;
      setTimeout(() => {
        if (serverPollId) {
          try {
            const url = new URL(window.location.href);
            url.searchParams.set("pollId", String(serverPollId));
            url.searchParams.delete("create");
            window.location.href = url.toString();
            return;
          } catch (navErr) {
            console.warn("redirect-after-create failed", navErr);
          }
        }
        setSuccess(false);
        setOpen(false);
        resetForm();
      }, 900);

    } catch (err) {
      console.error("create poll error:", err);
      setSubmitting(false);
      setSuccess(false);
      alert(err.message || "Failed to create poll");
    }
  };

  // --- Styles to force white theme on inputs ---
  const forcedWhiteInputStyle = {
    backgroundColor: "#ffffff",
    color: "#1e293b", // Slate-800
    WebkitTextFillColor: "#1e293b",
    caretColor: "#2563eb",
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative z-10 w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden transition-all">

        <AnimatePresence mode="wait">
          {/* ================= MAIN VIEW ================= */}
          {view === "main" && (
            <motion.div
              key="main"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="p-6 flex flex-col h-full"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6 relative">
                <div className="w-8" />
                <h2 className="text-xl font-bold text-slate-800">Create a Poll</h2>

                {/* Trash/Reset Button (Using custom asset) */}
                <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 opacity-80 hover:opacity-100 transition-opacity">
                  <img src="/assets/trash.svg" alt="Trash" className="w-5 h-5" />
                </button>
              </div>

              {/* Product Block */}
              <div className="bg-slate-50 rounded-2xl p-4 mb-4 relative">
                <input
                  className="w-full bg-transparent text-slate-800 placeholder-slate-400 font-medium text-lg outline-none mb-4 pr-12"
                  placeholder="Product: e.g. iPhone 16 Pro"
                  value={productName}
                  onChange={(e) => {
                    if (e.target.value.length <= 80) {
                      setProductName(e.target.value);
                    }
                  }}
                  style={{ color: "#1e293b" }} // Force dark text
                />
                <div className="absolute top-4 right-4 text-xs text-slate-400 font-medium">
                  {productName.length}/80
                </div>

                <div className="flex gap-3">
                  {/* Image Icon Button (Using custom asset) */}
                  <button
                    onClick={handleOpenImageInput}
                    className={`w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center transition-all ${mainError === 'image' ? RED_RING : ''} ${imageUrl ? 'ring-2 ring-blue-500' : ''}`}
                    title="Add Image (Compulsory)"
                  >
                    <img src="/assets/image-1.svg" alt="Add Image" className="w-6 h-6 object-contain" />
                  </button>

                  {/* Link Icon Button */}
                  <button
                    onClick={handleOpenLinkInput}
                    className={`w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-600 hover:text-blue-600 transition-all ${productLink ? 'text-blue-600 ring-2 ring-blue-500' : ''}`}
                    title="Add Product Link"
                  >
                    <GlobeIcon className="w-6 h-6" />
                  </button>
                </div>
                {mainError === 'image' && <div className="text-red-500 text-xs mt-2 ml-1 font-medium">Image is compulsory</div>}
              </div>

              {/* Options Block */}
              <div className="bg-slate-50 rounded-2xl p-4 mb-6">
                <div className="space-y-3">
                  {options.map((opt, i) => (
                    <input
                      key={i}
                      value={opt}
                      onChange={(e) => handleOptionChange(i, e.target.value)}
                      className="w-full bg-transparent border-b border-slate-200 py-2 text-slate-700 placeholder-slate-400 outline-none focus:border-blue-500 transition-colors"
                      placeholder={getOptionPlaceholder(i)}
                      style={{ color: "#334155" }}
                    />
                  ))}
                </div>

                {options.length < 4 && (
                  <div className="mt-4 flex justify-center">
                    <button
                      onClick={handleAddOption}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-4 rounded-full flex items-center gap-1 transition-colors shadow-lg shadow-blue-200"
                    >
                      <PlusIcon className="w-4 h-4" />
                      Add Option
                    </button>
                  </div>
                )}
              </div>

              {/* Footer Button */}
              <button
                onClick={handlePostPoll}
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-b-2xl rounded-t-lg shadow-xl transition-all active:scale-[0.98]"
              >
                {submitting ? "Posting..." : "Post Poll"}
              </button>
            </motion.div>
          )}

          {/* ================= IMAGE INPUT SUB-VIEW ================= */}
          {view === "imageInput" && (
            <motion.div
              key="imageInput"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="p-6 flex flex-col h-full bg-slate-50"
            >
              <h3 className="text-center font-bold text-slate-800 mb-4 text-lg">Product Image</h3>

              {/* Toggle Tabs */}
              <div className="flex p-1 bg-slate-200 rounded-xl mb-4">
                <button
                  onClick={() => { setImageTab("link"); setSubViewError(""); }}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all ${imageTab === "link" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Link
                </button>
                <button
                  onClick={() => { setImageTab("upload"); setSubViewError(""); }}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all ${imageTab === "upload" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Upload
                </button>
              </div>

              {imageTab === "link" ? (
                <>
                  <div className="bg-white rounded-xl p-3 shadow-sm flex items-center mb-4 border border-slate-200">
                    <input
                      value={tempInput}
                      onChange={(e) => setTempInput(e.target.value)}
                      placeholder="https://..."
                      className="w-full outline-none text-sm"
                      style={forcedWhiteInputStyle}
                      autoFocus
                    />
                  </div>

                  <div className="flex gap-4 h-40 mb-4">
                    <div className="flex-1 bg-gray-200 rounded-xl overflow-hidden flex items-center justify-center relative border border-gray-300">
                      {tempInput ? (
                        <img src={tempInput} alt="Preview" className="w-full h-full object-cover" onError={(e) => e.target.style.display = 'none'} />
                      ) : (
                        <span className="text-gray-400 text-sm">Preview</span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-xl border-2 border-dashed border-slate-300 p-6 mb-4 hover:border-blue-400 transition-colors cursor-pointer relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={uploading}
                  />
                  {uploading ? (
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 relative mb-2">
                        <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-blue-500 animate-spin"></div>
                      </div>
                      <span className="text-sm font-medium text-slate-500">Uploading...</span>
                    </div>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-blue-500">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-slate-600">Click to Upload Image</span>
                      <span className="text-xs text-slate-400 mt-1">JPEG, PNG up to 10MB</span>
                    </>
                  )}
                </div>
              )}

              {subViewError && <div className="text-red-500 text-sm text-center mb-4">{subViewError}</div>}

              <div className="flex gap-3 mt-auto">
                <button onClick={() => setView("main")} className="flex-1 bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl">
                  Back
                </button>
                {imageTab === "link" && (
                  <button
                    onClick={handleInsertImage}
                    disabled={isChecking}
                    className="flex-1 bg-orange-500 text-white font-semibold py-3 rounded-xl shadow-lg shadow-orange-200"
                  >
                    {isChecking ? "Checking..." : "Insert"}
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* ================= LINK INPUT SUB-VIEW ================= */}
          {view === "linkInput" && (
            <motion.div
              key="linkInput"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="p-6 flex flex-col h-full bg-slate-50"
            >
              <h3 className="text-center font-bold text-slate-800 mb-8 text-lg">Product Link</h3>

              <div className="bg-white rounded-xl p-4 shadow-sm flex items-center mb-6 border border-slate-200">
                {/* Explicitly styled input to avoid dark mode issues */}
                <input
                  value={tempInput}
                  onChange={(e) => setTempInput(e.target.value)}
                  placeholder="https://..."
                  className="w-full outline-none"
                  style={forcedWhiteInputStyle}
                  autoFocus
                />
              </div>

              {subViewError && <div className="text-red-500 text-sm text-center mb-4">{subViewError}</div>}

              <div className="flex gap-3 mt-auto">
                <button onClick={() => setView("main")} className="px-6 bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl">
                  Back
                </button>
                <button
                  onClick={handleInsertLink}
                  className="flex-1 bg-orange-500 text-white font-semibold py-3 rounded-xl shadow-lg shadow-orange-200"
                >
                  Insert
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Overlay */}
        <AnimatePresence>
          {success && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
              className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-50">
              <div className="bg-white p-4 rounded-full shadow-lg flex items-center justify-center">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="11" stroke="#10B981" strokeWidth="1.5" fill="#ECFDF5" />
                  <path d="M7 13l3 3 7-8" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
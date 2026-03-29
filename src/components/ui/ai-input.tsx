"use client"

import React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useChat } from "@ai-sdk/react"
import { isTextUIPart } from "ai"
import { cn } from "@/lib/utils"
import { Bot, User, Loader2, X, Send } from "lucide-react"

// ── ColorOrb ─────────────────────────────────────────────────────────────────
// Styles injected once via useEffect so ::before/::after pseudo-elements and
// the @property --angle Houdini rule work without styled-jsx.
const ORB_CSS = `
  @property --angle {
    syntax: "<angle>";
    inherits: false;
    initial-value: 0deg;
  }
  .color-orb {
    display: grid;
    grid-template-areas: "stack";
    overflow: hidden;
    border-radius: 50%;
    position: relative;
    transform: scale(1.1);
  }
  .color-orb::before, .color-orb::after {
    content: "";
    display: block;
    grid-area: stack;
    width: 100%; height: 100%;
    border-radius: 50%;
    transform: translateZ(0);
  }
  .color-orb::before {
    background:
      conic-gradient(from calc(var(--angle)*2) at 25% 70%, var(--c3), transparent 20% 80%, var(--c3)),
      conic-gradient(from calc(var(--angle)*2) at 45% 75%, var(--c2), transparent 30% 60%, var(--c2)),
      conic-gradient(from calc(var(--angle)*-3) at 80% 20%, var(--c1), transparent 40% 60%, var(--c1)),
      conic-gradient(from calc(var(--angle)*2) at 15% 5%, var(--c2), transparent 10% 90%, var(--c2)),
      conic-gradient(from calc(var(--angle)*1) at 20% 80%, var(--c1), transparent 10% 90%, var(--c1)),
      conic-gradient(from calc(var(--angle)*-2) at 85% 10%, var(--c3), transparent 20% 80%, var(--c3));
    box-shadow: inset var(--orb-base) 0 0 var(--shadow) calc(var(--shadow) * 0.2);
    filter: blur(var(--blur)) contrast(var(--contrast));
    animation: orb-spin var(--spin-dur) linear infinite;
  }
  .color-orb::after {
    background-image: radial-gradient(circle at center, var(--orb-base) var(--dot), transparent var(--dot));
    background-size: calc(var(--dot)*2) calc(var(--dot)*2);
    backdrop-filter: blur(calc(var(--blur)*2)) contrast(calc(var(--contrast)*2));
    mix-blend-mode: overlay;
    mask-image: radial-gradient(black var(--mask), transparent 75%);
  }
  @keyframes orb-spin { to { --angle: 360deg; } }
  @media (prefers-reduced-motion: reduce) { .color-orb::before { animation: none; } }
`

function useOrbStyles() {
  React.useEffect(() => {
    if (document.getElementById("color-orb-styles")) return
    const el = document.createElement("style")
    el.id = "color-orb-styles"
    el.textContent = ORB_CSS
    document.head.appendChild(el)
  }, [])
}

function ColorOrb({ dimension = "24px", base = "oklch(22.64% 0 0)", spinDuration = 20 }: {
  dimension?: string
  base?: string
  spinDuration?: number
}) {
  useOrbStyles()
  const d = parseInt(dimension, 10)
  const blur = d < 50 ? Math.max(d * 0.008, 1) : Math.max(d * 0.015, 4)
  const contrast = d < 50 ? Math.max(d * 0.004 * 1.2, 1.3) : Math.max(d * 0.008, 1.5)

  return (
    <div
      className="color-orb"
      style={{
        width: dimension, height: dimension,
        "--orb-base": base,
        "--c1": "oklch(75% 0.15 350)",
        "--c2": "oklch(80% 0.12 200)",
        "--c3": "oklch(78% 0.14 280)",
        "--spin-dur": `${spinDuration}s`,
        "--blur": `${blur}px`,
        "--contrast": contrast,
        "--dot": `${Math.max(d * 0.008, 0.1)}px`,
        "--shadow": `${Math.max(d * 0.008, 2)}px`,
        "--mask": d < 30 ? "0%" : d < 50 ? "5%" : "15%",
      } as React.CSSProperties}
    />
  )
}

// ── Layout constants ──────────────────────────────────────────────────────────
const SPEED    = 1
const PANEL_W  = 360
const INPUT_H  = 240   // panel height with no messages yet
const CHAT_H   = 520   // panel height when chat log is shown
const LOG_H    = CHAT_H - INPUT_H  // scrollable message area height

// ── MorphPanel ────────────────────────────────────────────────────────────────
export function MorphPanel() {
  const wrapperRef     = React.useRef<HTMLDivElement>(null)
  const textareaRef    = React.useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  const [open, setOpen]   = React.useState(false)
  const [input, setInput] = React.useState("")

  // DefaultChatTransport already defaults to POST /api/chat
  const { messages, sendMessage, status, error } = useChat()

  const isLoading  = status === "submitted" || status === "streaming"
  const hasMessages = messages.length > 0
  const panelHeight = hasMessages ? CHAT_H : INPUT_H

  // Auto-scroll to latest message
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Close on outside click
  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (open && wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  function submit() {
    const text = input.trim()
    if (!text || isLoading) return
    sendMessage({ text })
    setInput("")
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") { setOpen(false); return }
    // Enter sends; Shift+Enter inserts a newline
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function openPanel() {
    setOpen(true)
    setTimeout(() => textareaRef.current?.focus(), 60)
  }

  return (
    <motion.div
      ref={wrapperRef}
      className="bg-surface border border-border shadow-xl overflow-hidden"
      initial={false}
      animate={{
        width:        open ? PANEL_W : "auto",
        height:       open ? panelHeight : 44,
        borderRadius: open ? 16 : 22,
      }}
      transition={{ type: "spring", stiffness: 550 / SPEED, damping: 45, mass: 0.7 }}
    >
      <AnimatePresence mode="wait">
        {open ? (
          // ── Expanded panel ────────────────────────────────────────────────
          <motion.div
            key="open"
            className="flex flex-col"
            style={{ width: PANEL_W, height: panelHeight }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <ColorOrb dimension="20px" />
                <span className="text-[12px] font-semibold text-ink">SIMplify AI</span>
                {isLoading && (
                  <span className="text-[10px] text-ink-muted animate-pulse">thinking…</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-ink-muted hover:text-ink transition-colors p-0.5 rounded-full hover:bg-canvas"
                aria-label="Close AI chat"
              >
                <X size={13} />
              </button>
            </div>

            {/* Chat log — slides in when the first message arrives */}
            <AnimatePresence>
              {hasMessages && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: LOG_H, opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 40 }}
                  className="overflow-y-auto px-3 py-2 space-y-3 shrink-0"
                  style={{ height: LOG_H }}
                >
                  {messages.map((msg) => {
                    const text = msg.parts.filter(isTextUIPart).map(p => p.text).join("")
                    if (!text) return null
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex gap-2 items-start",
                          msg.role === "user" ? "flex-row-reverse" : "flex-row",
                        )}
                      >
                        {/* Avatar */}
                        <div className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                          msg.role === "user"
                            ? "bg-brand"
                            : "bg-canvas border border-border",
                        )}>
                          {msg.role === "user"
                            ? <User size={10} className="text-ink" />
                            : <Bot  size={10} className="text-ink-muted" />
                          }
                        </div>

                        {/* Bubble */}
                        <div className={cn(
                          "max-w-[82%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed text-ink whitespace-pre-wrap",
                          msg.role === "user"
                            ? "bg-brand rounded-tr-sm"
                            : "bg-canvas border border-border rounded-tl-sm",
                        )}>
                          {text}
                        </div>
                      </div>
                    )
                  })}

                  {/* Streaming indicator */}
                  {isLoading && (
                    <div className="flex gap-2 items-start">
                      <div className="w-5 h-5 rounded-full bg-canvas border border-border flex items-center justify-center shrink-0">
                        <Bot size={10} className="text-ink-muted" />
                      </div>
                      <div className="bg-canvas border border-border rounded-2xl rounded-tl-sm px-3 py-2">
                        <Loader2 size={11} className="text-ink-muted animate-spin" />
                      </div>
                    </div>
                  )}

                  {error && (
                    <p className="text-[11px] text-alert text-center py-1">
                      Aiyah, something went wrong lah. Try again?
                    </p>
                  )}

                  <div ref={messagesEndRef} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input area */}
            <div className="flex flex-col flex-1 min-h-0">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  hasMessages
                    ? "Ask a follow-up…"
                    : "I need a quiet spot with power outlets…"
                }
                className="flex-1 resize-none p-3 text-[13px] text-ink bg-transparent outline-none placeholder:text-ink-muted"
                spellCheck={false}
              />
              <div className="flex items-center justify-between px-3 pb-2 shrink-0">
                <span className="text-[10px] text-ink-muted select-none">
                  {hasMessages ? "Shift+Enter for newline" : "Enter to send · Esc to close"}
                </span>
                <button
                  type="button"
                  onClick={submit}
                  disabled={isLoading || !input.trim()}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-3 py-1 text-[11px] border transition-colors duration-200",
                    input.trim() && !isLoading
                      ? "bg-brand text-ink border-brand hover:opacity-80"
                      : "bg-surface text-ink-muted border-border cursor-not-allowed opacity-50",
                  )}
                >
                  <Send size={10} />
                  Send
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          // ── Collapsed dock bar ───────────────────────────────────────────
          <motion.button
            key="closed"
            type="button"
            className="h-11 flex items-center gap-2 px-3 cursor-pointer select-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            onClick={openPanel}
            aria-label="Open AI campus guide"
          >
            <ColorOrb dimension="24px" />
            <span className="text-sm text-ink-muted whitespace-nowrap pr-1">Ask AI</span>
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default MorphPanel

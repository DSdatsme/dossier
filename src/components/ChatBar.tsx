"use client";

import { useState } from "react";
import styles from "./ChatBar.module.css";

export interface ChatMessage {
  id: string;
  from: "you" | "assistant";
  text: string;
}

export function ChatBar({ messages }: { messages: ChatMessage[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.bar} data-open={open}>
      <div className={styles.panel}>
        <div className={styles.panelInner}>
          <div className={styles.panelHead}>Thread chat</div>
          <div className={styles.messages}>
            {messages.map((message) => (
              <div key={message.id} className={message.from === "you" ? styles.msgYou : styles.msgAssistant}>
                <span className={styles.who}>{message.from === "you" ? "You" : "Assistant"}</span>
                <div className={styles.bubble}>{message.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={styles.inputRow}>
        <input type="text" placeholder="Ask or add something..." aria-label="Message" disabled />
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-label={open ? "Collapse chat" : "Expand chat"}
          onClick={() => setOpen((current) => !current)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

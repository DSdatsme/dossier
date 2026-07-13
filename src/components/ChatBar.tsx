"use client";

import { useState, useTransition, type FormEvent } from "react";
import { sendChatMessageAction } from "@/app/actions";
import type { ChatMessage } from "@/lib/types";
import styles from "./ChatBar.module.css";

export function ChatBar({ threadId, messages }: { threadId: string; messages: ChatMessage[] }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();

  const hasPendingReply = messages.some((message) => message.status === "PENDING");
  const disabled = isPending || hasPendingReply;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;

    setText("");
    startTransition(async () => {
      await sendChatMessageAction(threadId, trimmed);
    });
  }

  return (
    <div className={styles.bar} data-open={open}>
      <div className={styles.panel}>
        <div className={styles.panelInner}>
          <div className={styles.panelHead}>Thread chat</div>
          <div className={styles.messages}>
            {messages.map((message) => (
              <div key={message.id} className={message.from === "you" ? styles.msgYou : styles.msgAssistant}>
                <span className={styles.who}>{message.from === "you" ? "You" : "Assistant"}</span>
                <div className={styles.bubble} data-status={message.status}>
                  {message.status === "PENDING" ? "Thinking…" : message.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <form className={styles.inputRow} onSubmit={handleSubmit}>
        <input
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Tell it what happened..."
          aria-label="Message"
          disabled={disabled}
        />
        <button type="submit" className={styles.send} disabled={disabled || text.trim().length === 0}>
          Send
        </button>
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
      </form>
    </div>
  );
}

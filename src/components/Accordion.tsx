"use client";

import { useState, type ReactNode } from "react";
import styles from "./Accordion.module.css";

interface AccordionProps {
  title: ReactNode;
  highlight?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function Accordion({ title, highlight, defaultOpen = false, children }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <article className={styles.card} data-open={open}>
      <button
        type="button"
        className={styles.head}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <div className={styles.toggle}>
          <span className={styles.title}>{title}</span>
          {highlight ? <span className={styles.highlight}>{highlight}</span> : null}
        </div>
        <span className={styles.chevron} aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
      <div className={styles.bodyWrap}>
        <div className={styles.bodyInner}>
          <div className={styles.body}>{children}</div>
        </div>
      </div>
    </article>
  );
}

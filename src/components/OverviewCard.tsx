import type { ReactNode } from "react";
import { Accordion } from "./Accordion";
import type { FactView } from "@/lib/types";
import { parseLabelValue, findBySlot, excludingSlots } from "@/lib/factParsing";
import styles from "./OverviewCard.module.css";

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.9 6.9L22 9.3l-5.5 4.8L18 22l-6-3.6L6 22l1.5-7.9L2 9.3l7.1-.4L12 2z" />
    </svg>
  );
}
function PeopleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 3h7v7M21 3l-9 9M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
    </svg>
  );
}

function StatCell({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={`${styles.statValue} tabular`}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function StatStrip({ companySnapshot, cultureValues }: { companySnapshot: FactView[]; cultureValues: FactView[] }) {
  const founded = findBySlot(companySnapshot, "Founded");
  const employees = findBySlot(companySnapshot, "Employees");
  const hq = findBySlot(companySnapshot, "HQ");
  const rating = findBySlot(cultureValues, "Glassdoor");
  const ratingValue = rating ? parseLabelValue(rating.content)?.value.split(",")[0] : undefined;

  return (
    <div className={styles.statStrip}>
      <StatCell icon={<StarIcon />} value={ratingValue ?? "—"} label="Rating" />
      <StatCell icon={<PeopleIcon />} value={employees ? parseLabelValue(employees.content)!.value : "—"} label="Employees" />
      <StatCell icon={<CalendarIcon />} value={founded ? parseLabelValue(founded.content)!.value : "—"} label="Founded" />
      <StatCell icon={<PinIcon />} value={hq ? parseLabelValue(hq.content)!.value : "—"} label="HQ" />
    </div>
  );
}

function KeyValueList({ facts, slots }: { facts: FactView[]; slots: string[] }) {
  return (
    <ul className={styles.kvList}>
      {slots.map((slot) => {
        const match = findBySlot(facts, slot);
        const parsed = match ? parseLabelValue(match.content) : null;
        return (
          <li key={slot} className={styles.kvRow} data-source={match?.sourceType}>
            <span className={styles.kvLabel}>{slot}</span>
            <span className={`${styles.kvValue} tabular`}>{parsed ? parsed.value : "—"}</span>
          </li>
        );
      })}
    </ul>
  );
}

function CategoryRatings({ facts }: { facts: FactView[] }) {
  const rows = excludingSlots(facts, ["Glassdoor"])
    .map((fact) => ({ fact, parsed: parseLabelValue(fact.content) }))
    .filter((row): row is { fact: FactView; parsed: { label: string; value: string } } =>
      Boolean(row.parsed) && !/^pro$|^con$/i.test(row.parsed!.label)
    );

  if (rows.length === 0) return null;

  return (
    <div className={styles.catRatings}>
      {rows.map(({ fact, parsed }) => (
        <div key={fact.id} className={styles.catRow}>
          <span className={`${styles.catBadge} tabular`}>{parsed.value}</span>
          <span className={styles.catName}>{parsed.label}</span>
        </div>
      ))}
    </div>
  );
}

function ProsCons({ facts }: { facts: FactView[] }) {
  const pros = facts.filter((f) => f.content.startsWith("Pro: "));
  const cons = facts.filter((f) => f.content.startsWith("Con: "));

  if (pros.length === 0 && cons.length === 0) return null;

  return (
    <div className={styles.prosCons}>
      {pros.length > 0 && (
        <div>
          <span className={styles.miniLabel}>Pros</span>
          <div className={styles.tagRow}>
            {pros.map((fact) => (
              <span key={fact.id} className={styles.chip} data-source={fact.sourceType}>
                {fact.content.slice(5)}
              </span>
            ))}
          </div>
        </div>
      )}
      {cons.length > 0 && (
        <div>
          <span className={styles.miniLabel}>Cons</span>
          <div className={styles.tagRow}>
            {cons.map((fact) => (
              <span key={fact.id} className={styles.chip} data-source={fact.sourceType}>
                {fact.content.slice(5)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CultureValuesBlock({ facts }: { facts: FactView[] }) {
  const ratingRows = excludingSlots(facts, ["Glassdoor"])
    .map((fact) => parseLabelValue(fact.content))
    .filter((parsed) => parsed && !/^pro$|^con$/i.test(parsed.label));
  const hasProsCons = facts.some((f) => f.content.startsWith("Pro: ") || f.content.startsWith("Con: "));

  if (ratingRows.length === 0 && !hasProsCons) {
    return <p className={styles.empty}>Nothing specific found yet.</p>;
  }

  return (
    <>
      <CategoryRatings facts={facts} />
      <ProsCons facts={facts} />
    </>
  );
}

function Timeline({ facts }: { facts: FactView[] }) {
  if (facts.length === 0) {
    return <p className={styles.empty}>Nothing specific found yet.</p>;
  }
  return (
    <ul className={styles.timeline}>
      {facts.map((fact) => {
        const parsed = parseLabelValue(fact.content);
        return (
          <li key={fact.id} className={styles.timelineRow} data-source={fact.sourceType}>
            <span className={`${styles.tDate} tabular`}>{parsed?.label ?? ""}</span>
            <span className={styles.tEvent}>{parsed?.value ?? fact.content}</span>
          </li>
        );
      })}
    </ul>
  );
}

function SourceList({ facts }: { facts: FactView[] }) {
  if (facts.length === 0) {
    return <p className={styles.empty}>Nothing specific found yet.</p>;
  }
  return (
    <ul className={styles.sourceList}>
      {facts.map((fact) => {
        const [domain, ...rest] = fact.content.split(" — ");
        return (
          <li key={fact.id} className={styles.sourceItem}>
            <LinkIcon />
            <span className={styles.domain}>{domain}</span>
            {rest.length > 0 ? ` — ${rest.join(" — ")}` : ""}
          </li>
        );
      })}
    </ul>
  );
}

function CompensationList({ facts }: { facts: FactView[] }) {
  if (facts.length === 0) {
    return <p className={styles.empty}>Nothing specific found yet.</p>;
  }
  return (
    <ul className={styles.factList}>
      {facts.map((fact) => {
        const parsed = parseLabelValue(fact.content);
        return (
          <li
            key={fact.id}
            className={`${styles.factRow} ${styles.factRowMono} tabular`}
            data-source={fact.sourceType}
          >
            {parsed ? (
              <>
                <span className={styles.compLabel}>{parsed.label}: </span>
                <span className={fact.sourceType === "USER_PROVIDED" ? styles.compValuePrimary : undefined}>
                  {parsed.value}
                </span>
              </>
            ) : (
              fact.content
            )}
          </li>
        );
      })}
    </ul>
  );
}

function FactList({ facts }: { facts: FactView[] }) {
  if (facts.length === 0) {
    return <p className={styles.empty}>Nothing specific found yet.</p>;
  }
  return (
    <ul className={styles.factList}>
      {facts.map((fact) => (
        <li key={fact.id} className={styles.factRow} data-source={fact.sourceType}>
          {fact.content}
        </li>
      ))}
    </ul>
  );
}

function ChipRow({ facts }: { facts: FactView[] }) {
  if (facts.length === 0) {
    return <p className={styles.empty}>Nothing specific found yet.</p>;
  }
  return (
    <ul className={styles.chipRow}>
      {facts.map((fact) => (
        <li key={fact.id} className={styles.chip} data-source={fact.sourceType}>
          {fact.content}
        </li>
      ))}
    </ul>
  );
}

export function OverviewCard({
  sections,
  companyDomain,
}: {
  sections: Record<string, FactView[]>;
  companyDomain: string | null;
}) {
  const companySnapshot = sections.companySnapshot ?? [];
  const cultureValues = sections.cultureValues ?? [];
  const companyAtLocation = sections.companyAtLocation ?? [];
  const roleSpecifics = sections.roleSpecifics ?? [];
  const tagline = companySnapshot.find((fact) => !parseLabelValue(fact.content));

  const highlightParts = [companyDomain, tagline?.content].filter(Boolean);

  return (
    <Accordion title="Overview" highlight={highlightParts.join(" · ")} defaultOpen>
      {tagline ? <p className={styles.tagline}>{tagline.content}</p> : null}

      <StatStrip companySnapshot={companySnapshot} cultureValues={cultureValues} />

      <div className={styles.ovGrid}>
        <div className={styles.ovBlock}>
          <h3 className={styles.label}>Culture &amp; Values</h3>
          <CultureValuesBlock facts={cultureValues} />
        </div>
        <div className={styles.ovBlock}>
          <h3 className={styles.label}>Company @ Location</h3>
          <KeyValueList facts={companyAtLocation} slots={["Office opened", "Local team", "Reports to"]} />
        </div>
        <div className={styles.ovBlock}>
          <h3 className={styles.label}>Role Specifics</h3>
          <KeyValueList facts={roleSpecifics} slots={["Team size", "Schedule", "Focus"]} />
        </div>
        <div className={styles.ovBlock}>
          <h3 className={styles.label}>Funding &amp; Notable News</h3>
          <Timeline facts={sections.fundingNews ?? []} />
        </div>
      </div>

      <section className={styles.sectionFull}>
        <h3 className={styles.label}>Tech Stack</h3>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.legendDotResearch}`} aria-hidden="true" />
            Researched
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.legendDotNotes}`} aria-hidden="true" />
            Your notes
          </span>
        </div>
        <ChipRow facts={sections.techStack ?? []} />
      </section>

      <section className={styles.sectionFull}>
        <h3 className={styles.label}>Compensation</h3>
        <CompensationList facts={sections.compensation ?? []} />
      </section>

      <section className={styles.sectionFull}>
        <h3 className={styles.label}>Red Flags / Things to Know</h3>
        <FactList facts={sections.redFlags ?? []} />
      </section>

      <section className={styles.sectionFull}>
        <h3 className={styles.label}>Sources</h3>
        <SourceList facts={sections.sources ?? []} />
      </section>
    </Accordion>
  );
}

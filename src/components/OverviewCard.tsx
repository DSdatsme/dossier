import { Accordion } from "./Accordion";
import type { FactView } from "@/lib/types";
import styles from "./OverviewCard.module.css";

function FactList({ facts }: { facts: FactView[] }) {
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
  const highlightParts = [companyDomain, ...(sections.companySnapshot ?? []).slice(0, 2).map((f) => f.content)].filter(
    Boolean
  );

  return (
    <Accordion title="Overview" highlight={highlightParts.join(" · ")} defaultOpen>
      <section className={styles.section}>
        <h3 className={styles.label}>Company Snapshot</h3>
        <FactList facts={sections.companySnapshot ?? []} />
      </section>
      <section className={styles.section}>
        <h3 className={styles.label}>Funding &amp; Notable News</h3>
        <FactList facts={sections.fundingNews ?? []} />
      </section>
      <section className={styles.section}>
        <h3 className={styles.label}>Company @ Location</h3>
        <FactList facts={sections.companyAtLocation ?? []} />
      </section>
      <section className={styles.section}>
        <h3 className={styles.label}>Culture &amp; Values</h3>
        <FactList facts={sections.cultureValues ?? []} />
      </section>
      <section className={styles.section}>
        <h3 className={styles.label}>Role Specifics</h3>
        <FactList facts={sections.roleSpecifics ?? []} />
      </section>
      <section className={styles.section}>
        <h3 className={styles.label}>Tech Stack</h3>
        <ChipRow facts={sections.techStack ?? []} />
      </section>
      <section className={styles.section}>
        <h3 className={styles.label}>Compensation</h3>
        <FactList facts={sections.compensation ?? []} />
      </section>
      <section className={styles.section}>
        <h3 className={styles.label}>Red Flags / Things to Know</h3>
        <FactList facts={sections.redFlags ?? []} />
      </section>
      <section className={styles.section}>
        <h3 className={styles.label}>Sources</h3>
        <FactList facts={sections.sources ?? []} />
      </section>
    </Accordion>
  );
}

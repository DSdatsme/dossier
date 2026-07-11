import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.fact.deleteMany();
  await prisma.roundInterviewer.deleteMany();
  await prisma.interviewerProfile.deleteMany();
  await prisma.round.deleteMany();
  await prisma.thread.deleteMany();

  const nimbus = await prisma.thread.create({
    data: {
      companyName: "Nimbus Robotics",
      companyDomain: "nimbusrobotics.example",
      position: "Senior DevOps Engineer",
      location: "Austin, TX",
      confirmedTotalRounds: 4,
      confirmedTotalRoundsSource: "a public interview-experience post",
    },
  });

  await prisma.fact.createMany({
    data: [
      { threadId: nimbus.id, section: "companySnapshot", content: "Builds autonomous warehouse robotics for logistics operators.", sourceType: "RESEARCHED", sourceDetail: "nimbusrobotics.example" },
      { threadId: nimbus.id, section: "companySnapshot", content: "Founded: 2016", sourceType: "RESEARCHED", sourceDetail: "nimbusrobotics.example" },
      { threadId: nimbus.id, section: "companySnapshot", content: "Employees: ~600", sourceType: "RESEARCHED", sourceDetail: "nimbusrobotics.example" },
      { threadId: nimbus.id, section: "companySnapshot", content: "HQ: Austin, TX", sourceType: "RESEARCHED", sourceDetail: "nimbusrobotics.example" },
      { threadId: nimbus.id, section: "fundingNews", content: "2022: Series C, $80M raised", sourceType: "RESEARCHED", sourceDetail: "techcrunch.com" },
      { threadId: nimbus.id, section: "fundingNews", content: "2024: opened a new fulfillment-robotics R&D site", sourceType: "RESEARCHED", sourceDetail: "nimbusrobotics.example" },
      { threadId: nimbus.id, section: "fundingNews", content: "Ongoing: no layoffs reported in the past two years", sourceType: "RESEARCHED", sourceDetail: "glassdoor.com" },
      { threadId: nimbus.id, section: "companyAtLocation", content: "Office opened: 2019", sourceType: "RESEARCHED", sourceDetail: "glassdoor.com" },
      { threadId: nimbus.id, section: "companyAtLocation", content: "Local team: ~120 engineers", sourceType: "RESEARCHED", sourceDetail: "glassdoor.com" },
      { threadId: nimbus.id, section: "companyAtLocation", content: "Reports to: central platform engineering org", sourceType: "RESEARCHED", sourceDetail: "glassdoor.com" },
      { threadId: nimbus.id, section: "cultureValues", content: "Glassdoor: 4.0/5, 240 reviews", sourceType: "RESEARCHED", sourceDetail: "glassdoor.com" },
      { threadId: nimbus.id, section: "cultureValues", content: "Work-Life Balance: 3.8", sourceType: "RESEARCHED", sourceDetail: "glassdoor.com" },
      { threadId: nimbus.id, section: "cultureValues", content: "Career Growth: 3.6", sourceType: "RESEARCHED", sourceDetail: "glassdoor.com" },
      { threadId: nimbus.id, section: "cultureValues", content: "Pro: strong engineering culture", sourceType: "RESEARCHED", sourceDetail: "glassdoor.com" },
      { threadId: nimbus.id, section: "cultureValues", content: "Con: on-call rotation can be heavy", sourceType: "RESEARCHED", sourceDetail: "glassdoor.com" },
      { threadId: nimbus.id, section: "roleSpecifics", content: "Team size: 6 engineers", sourceType: "RESEARCHED", sourceDetail: "glassdoor.com" },
      { threadId: nimbus.id, section: "roleSpecifics", content: "Schedule: Hybrid, 3 days/week", sourceType: "RESEARCHED", sourceDetail: "glassdoor.com" },
      { threadId: nimbus.id, section: "roleSpecifics", content: "Focus: fleet telemetry and deployment infrastructure", sourceType: "RESEARCHED", sourceDetail: "glassdoor.com" },
      { threadId: nimbus.id, section: "techStack", content: "Go", sourceType: "RESEARCHED", sourceDetail: "stackshare.io" },
      { threadId: nimbus.id, section: "techStack", content: "Kubernetes", sourceType: "RESEARCHED", sourceDetail: "stackshare.io" },
      { threadId: nimbus.id, section: "techStack", content: "Terraform", sourceType: "RESEARCHED", sourceDetail: "stackshare.io" },
      { threadId: nimbus.id, section: "techStack", content: "AWS", sourceType: "RESEARCHED", sourceDetail: "stackshare.io" },
      { threadId: nimbus.id, section: "techStack", content: "Prometheus", sourceType: "RESEARCHED", sourceDetail: "stackshare.io" },
      { threadId: nimbus.id, section: "techStack", content: "Python — legacy service, being phased out", sourceType: "USER_PROVIDED", sourceDetail: "your notes, Round B" },
      { threadId: nimbus.id, section: "compensation", content: "Recruiter-quoted range: $150k–$170k base", sourceType: "USER_PROVIDED", sourceDetail: "your notes" },
      { threadId: nimbus.id, section: "compensation", content: "Platform Engineer (related role): ~$130k–$150k", sourceType: "RESEARCHED", sourceDetail: "glassdoor.com — exact-role data was sparse" },
      { threadId: nimbus.id, section: "compensation", content: "SRE (related role): ~$140k–$160k", sourceType: "RESEARCHED", sourceDetail: "glassdoor.com — exact-role data was sparse" },
      { threadId: nimbus.id, section: "redFlags", content: "Mixed reviews on on-call workload.", sourceType: "RESEARCHED", sourceDetail: "glassdoor.com" },
      { threadId: nimbus.id, section: "redFlags", content: "Some turnover reported on the infra team.", sourceType: "USER_PROVIDED", sourceDetail: "your notes, Round C" },
      { threadId: nimbus.id, section: "sources", content: "glassdoor.com — Nimbus Robotics reviews & interview experiences", sourceType: "RESEARCHED", sourceDetail: "glassdoor.com" },
      { threadId: nimbus.id, section: "sources", content: "nimbusrobotics.example — careers & company pages", sourceType: "RESEARCHED", sourceDetail: "nimbusrobotics.example" },
      { threadId: nimbus.id, section: "sources", content: "techcrunch.com — Series C coverage, 2022", sourceType: "RESEARCHED", sourceDetail: "techcrunch.com" },
    ],
  });

  const jordan = await prisma.interviewerProfile.create({
    data: { threadId: nimbus.id, name: "Jordan Lee", role: "Talent Partner", tenure: "2 yrs at Nimbus Robotics", background: "Previously recruiting @ a fintech startup" },
  });
  const morgan = await prisma.interviewerProfile.create({
    data: { threadId: nimbus.id, name: "Morgan Patel", role: "Engineering Manager", tenure: "3 yrs at Nimbus Robotics", background: "Previously Senior SRE @ a payments company · via LinkedIn" },
  });

  const roundA = await prisma.round.create({
    data: { threadId: nimbus.id, name: "HR Screening", order: 1, status: "COMPLETED", confirmedSource: "your message" },
  });
  const roundB = await prisma.round.create({
    data: { threadId: nimbus.id, name: "Technical", order: 2, status: "COMPLETED", confirmedSource: "your message" },
  });
  const roundC = await prisma.round.create({
    data: { threadId: nimbus.id, name: "System Design", order: 3, status: "NOT_HAPPENING", confirmedSource: "a public interview-experience post" },
  });
  await prisma.round.create({
    data: { threadId: nimbus.id, name: "Hiring Manager", order: 4, status: "UPCOMING", confirmedSource: "a public interview-experience post" },
  });

  await prisma.roundInterviewer.create({ data: { roundId: roundA.id, profileId: jordan.id } });
  await prisma.roundInterviewer.create({ data: { roundId: roundB.id, profileId: morgan.id } });

  await prisma.fact.createMany({
    data: [
      { threadId: nimbus.id, roundId: roundA.id, section: "prepMaterial", content: "Background & motivation.", sourceType: "RESEARCHED", sourceDetail: "generic" },
      { threadId: nimbus.id, roundId: roundA.id, section: "prepMaterial", content: "Why are you looking to leave your current role?", sourceType: "RESEARCHED", sourceDetail: "generic" },
      { threadId: nimbus.id, roundId: roundA.id, section: "smartQuestions", content: "How does the local team's roadmap get set relative to headquarters?", sourceType: "RESEARCHED", sourceDetail: "generic" },
      { threadId: nimbus.id, roundId: roundA.id, section: "yourNotes", content: "Quick 20-minute call, mostly logistics. Confirmed hybrid schedule and the quoted range.", sourceType: "USER_PROVIDED", sourceDetail: "your notes" },

      { threadId: nimbus.id, roundId: roundB.id, section: "prepMaterial", content: "K8s autoscaling.", sourceType: "USER_PROVIDED", sourceDetail: "your notes" },
      { threadId: nimbus.id, roundId: roundB.id, section: "prepMaterial", content: "Walk me through designing autoscaling for a bursty workload.", sourceType: "RESEARCHED", sourceDetail: "candidate blog" },
      { threadId: nimbus.id, roundId: roundB.id, section: "smartQuestions", content: "How does the team decide build-vs-buy for internal tooling?", sourceType: "RESEARCHED", sourceDetail: "generic" },
      { threadId: nimbus.id, roundId: roundB.id, section: "yourNotes", content: "Panel was 2 people, not 1 as expected. Mostly autoscaling and an incident postmortem walkthrough.", sourceType: "USER_PROVIDED", sourceDetail: "your notes" },

      { threadId: nimbus.id, roundId: roundC.id, section: "yourNotes", content: "Recruiter said they're skipping System Design and going straight to the Hiring Manager round.", sourceType: "USER_PROVIDED", sourceDetail: "your notes" },
    ],
  });

  await prisma.thread.create({
    data: { companyName: "Acme Corp", position: "Staff SRE", location: "Chicago, IL" },
  });

  const foo = await prisma.thread.create({
    data: { companyName: "Foo Inc", position: "Platform Engineer", location: "Remote" },
  });
  await prisma.round.create({
    data: { threadId: foo.id, name: "Initial Screen", order: 1, status: "UPCOMING", confirmedSource: "your message" },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

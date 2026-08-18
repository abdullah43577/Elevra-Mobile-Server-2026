import { LayoutKey } from "../src/generated/prisma/enums";
import { prisma } from "../src/lib/prisma";

/*
  Idempotent. Upserts the ATS template catalogue and retires the original four.
  Run with:  npx tsx prisma/seed-ats-templates.ts
*/

// Realistic sample content — templates are judged on how they look full, and
// lorem-ipsum previews make every layout look the same.
const SAMPLE = {
  personalInfo: {
    firstName: "Amara",
    lastName: "Okonkwo",
    title: "Senior Product Engineer",
    email: "amara.okonkwo@email.com",
    phone: "+1 (415) 555-0132",
    location: "San Francisco, CA",
    summary:
      "Product engineer with 8 years building consumer mobile and web platforms. Led the rebuild of a checkout flow serving 2M monthly users, cutting drop-off by 31%. Comfortable owning a feature from problem framing through production support.",
  },
  experience: [
    {
      company: "Northwind Technologies",
      position: "Senior Product Engineer",
      startDate: "Mar 2021",
      current: true,
      achievements: [
        "Rebuilt the checkout flow used by 2M monthly users, reducing drop-off 31% and adding $4.2M in annualised revenue.",
        "Led a four-engineer team through a React Native migration, shipping on schedule with no regression in crash-free rate.",
        "Introduced trunk-based deploys, taking release cadence from fortnightly to daily.",
      ],
    },
    {
      company: "Bluewater Labs",
      position: "Product Engineer",
      startDate: "Jun 2018",
      endDate: "Feb 2021",
      achievements: [
        "Built the analytics pipeline processing 40M daily events on a two-person team.",
        "Cut median API latency from 480ms to 120ms by restructuring the query layer.",
      ],
    },
  ],
  education: [
    {
      school: "University of Cape Town",
      degree: "BSc",
      field: "Computer Science",
      startDate: "2014",
      endDate: "2018",
    },
  ],
  skills: [
    { name: "TypeScript" },
    { name: "React Native" },
    { name: "Node.js" },
    { name: "PostgreSQL" },
    { name: "GraphQL" },
    { name: "AWS" },
    { name: "System Design" },
    { name: "Team Leadership" },
  ],
  projects: [
    {
      name: "Ledgerline",
      description: "Open-source double-entry bookkeeping library, 3.1k GitHub stars.",
      technologies: ["TypeScript", "SQLite"],
    },
  ],
  certifications: [
    { name: "AWS Solutions Architect – Associate", issuer: "Amazon Web Services", date: "2023" },
  ],
  languages: [
    { name: "English", proficiency: "native" },
    { name: "Igbo", proficiency: "native" },
    { name: "French", proficiency: "professional" },
  ],
  references: [],
};

const CATALOGUE = [
  {
    id: "ats-clean",
    name: "Cornerstone",
    description: "Monochrome and centred. The safest choice when you do not know what parser you are up against.",
    category: "ats",
    layoutKey: LayoutKey.ATS_CLEAN,
    primaryColor: "#1A1A1A",
    accentColor: "#1A1A1A",
    spacing: "NORMAL" as const,
  },
  {
    id: "ats-accent",
    name: "Meridian",
    description: "Left-aligned header with accent rules under each section. Clean and confident.",
    category: "ats",
    layoutKey: LayoutKey.ATS_ACCENT,
    primaryColor: "#1E3A5F",
    accentColor: "#2E6FD1",
    spacing: "NORMAL" as const,
  },
  {
    id: "modern-banner",
    name: "Headline",
    description: "A full-width colour banner carrying your name, with a clean single-column body beneath.",
    category: "modern",
    layoutKey: LayoutKey.MODERN_BANNER,
    primaryColor: "#0F5C4E",
    accentColor: "#0F9B7A",
    spacing: "NORMAL" as const,
  },
  {
    id: "compact-dense",
    name: "Compendium",
    description: "Tight spacing built to keep a long career on one page.",
    category: "minimal",
    layoutKey: LayoutKey.COMPACT_DENSE,
    primaryColor: "#24292E",
    accentColor: "#B4551F",
    spacing: "COMPACT" as const,
  },
  {
    id: "timeline-accent",
    name: "Throughline",
    description: "A vertical accent rule down the page. Distinctive without breaking reading order.",
    category: "modern",
    layoutKey: LayoutKey.TIMELINE_ACCENT,
    primaryColor: "#4A2545",
    accentColor: "#8E4585",
    spacing: "SPACIOUS" as const,
  },
  {
    id: "tech-focused",
    name: "Stack",
    description: "Skills surface directly under the header, where a technical screen looks first.",
    category: "technical",
    layoutKey: LayoutKey.TECH_FOCUSED,
    primaryColor: "#16232E",
    accentColor: "#0B7285",
    spacing: "NORMAL" as const,
  },
];

async function main() {
  for (const item of CATALOGUE) {
    const themeId = `theme-${item.id}`;

    await prisma.resumeTheme.upsert({
      where: { id: themeId },
      create: {
        id: themeId,
        name: item.name,
        description: item.description,
        primaryColor: item.primaryColor,
        accentColor: item.accentColor,
        textColor: "#1F2328",
        fontFamily: "INTER",
        spacing: item.spacing,
      },
      update: {
        primaryColor: item.primaryColor,
        accentColor: item.accentColor,
        textColor: "#1F2328",
        spacing: item.spacing,
      },
    });

    await prisma.template.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        name: item.name,
        description: item.description,
        category: item.category,
        layoutKey: item.layoutKey,
        themeId,
        defaultData: SAMPLE,
        isPremium: false,
        isActive: true,
      },
      update: {
        name: item.name,
        description: item.description,
        category: item.category,
        layoutKey: item.layoutKey,
        themeId,
        defaultData: SAMPLE,
        isActive: true,
      },
    });

    console.log(`  ✓ ${item.name} (${item.layoutKey})`);
  }

  // Retire the originals rather than deleting them — existing Resume rows still
  // point at these templates.
  const retired = await prisma.template.updateMany({
    where: { layoutKey: { in: ["PROFESSIONAL_CLASSIC", "PROFESSIONAL_SLEEK", "CREATIVE_SPLIT", "MINIMAL_COMPACT", "EXECUTIVE_FORMAL"] } },
    data: { isActive: false },
  });

  console.log(`✅ ${CATALOGUE.length} ATS templates seeded, ${retired.count} legacy templates retired`);
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

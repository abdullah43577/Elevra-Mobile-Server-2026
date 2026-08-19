
import { LayoutKey } from "../src/generated/prisma/enums";
import { prisma } from "../src/lib/prisma";

async function seedTemplates() {
  // 1. First create the themes
  const themes = await Promise.all([
    prisma.resumeTheme.create({
      data: {
        id: "theme-modern-professional",
        name: "Modern Professional",
        description: "Clean and modern design",
        primaryColor: "#2563EB",
        textColor: "#1A1A2E",
        fontFamily: "INTER",
        spacing: "NORMAL",
        accentColor: "#3B82F6",
        showBorders: true,
      },
    }),
    prisma.resumeTheme.create({
      data: {
        id: "theme-creative-portfolio",
        name: "Creative Portfolio",
        description: "Bold and creative",
        primaryColor: "#EC4899",
        secondaryColor: "#F472B6",
        textColor: "#1A1A2E",
        fontFamily: "PLAYFAIR",
        spacing: "SPACIOUS",
        sidebarColor: "#831843",
        sidebarTextColor: "#FFFFFF",
        accentColor: "#F472B6",
        useIcons: true,
      },
    }),
    prisma.resumeTheme.create({
      data: {
        id: "theme-minimal-classic",
        name: "Minimal Classic",
        description: "Timeless and elegant",
        primaryColor: "#1F2937",
        textColor: "#1A1A2E",
        fontFamily: "INTER",
        spacing: "COMPACT",
        showDividers: true,
      },
    }),
    prisma.resumeTheme.create({
      data: {
        id: "theme-executive-suite",
        name: "Executive Suite",
        description: "Sophisticated design",
        primaryColor: "#0F172A",
        secondaryColor: "#1E293B",
        textColor: "#0A1628",
        fontFamily: "LORA",
        spacing: "NORMAL",
        goldAccent: "#C9A84C",
        showBorders: true,
      },
    }),
  ]);

  // 2. Then create templates with references to themes
  const templates = [
    {
      name: "Modern Professional",
      description: "Clean and modern design perfect for corporate roles",
      category: "professional",
      layoutKey: LayoutKey.PROFESSIONAL_CLASSIC,
      themeId: "theme-modern-professional",
      defaultData: {
        personalInfo: {
          firstName: "Jane",
          lastName: "Doe",
          email: "jane.doe@example.com",
          phone: "+1 (555) 123-4567",
          location: "New York, NY",
          title: "Marketing Director",
          summary: "Strategic marketing leader with 8+ years of experience.",
        },
        experience: [
          {
            company: "Tech Corp",
            position: "Senior Marketing Manager",
            startDate: "2020-01",
            endDate: "2024-01",
            description: "Led marketing strategy for enterprise products.",
          },
        ],
        education: [
          {
            school: "MIT",
            degree: "MBA",
            field: "Marketing",
            startDate: "2016-09",
            endDate: "2018-06",
          },
        ],
        skills: [
          { name: "Strategic Planning", level: "expert" },
          { name: "Brand Management", level: "advanced" },
          { name: "Digital Marketing", level: "advanced" },
        ],
      },
      isPremium: false,
    },
    {
      name: "Creative Portfolio",
      description: "Bold and creative design for creative roles",
      category: "creative",
      layoutKey: LayoutKey.CREATIVE_SPLIT,
      themeId: "theme-creative-portfolio",
      defaultData: {
        personalInfo: {
          firstName: "Alex",
          lastName: "Chen",
          email: "alex.chen@example.com",
          phone: "+1 (555) 987-6543",
          location: "San Francisco, CA",
          title: "Creative Director",
          summary: "Award-winning creative director with 10+ years of experience.",
        },
        experience: [
          {
            company: "Design Studio X",
            position: "Creative Director",
            startDate: "2019-01",
            endDate: "2024-01",
            description: "Led creative vision for 50+ clients.",
          },
        ],
        education: [
          {
            school: "RISD",
            degree: "BFA",
            field: "Graphic Design",
            startDate: "2011-09",
            endDate: "2015-06",
          },
        ],
        skills: [
          { name: "UI/UX Design", level: "expert" },
          { name: "Brand Strategy", level: "advanced" },
          { name: "Figma", level: "expert" },
        ],
        projects: [
          {
            name: "Brand Refresh - Global Bank",
            description: "Led complete brand overhaul.",
          },
        ],
      },
      isPremium: true,
    },
    {
      name: "Minimal Classic",
      description: "Timeless and elegant design for any industry",
      category: "minimal",
      layoutKey: LayoutKey.MINIMAL_COMPACT,
      themeId: "theme-minimal-classic",
      defaultData: {
        personalInfo: {
          firstName: "Sarah",
          lastName: "Kim",
          email: "sarah.kim@example.com",
          phone: "+1 (555) 456-7890",
          location: "Austin, TX",
          title: "Software Engineer",
          summary: "Full-stack engineer with 6+ years of experience.",
        },
        experience: [
          {
            company: "TechStart",
            position: "Senior Software Engineer",
            startDate: "2021-01",
            endDate: "2024-01",
            description: "Built core product features serving 1M+ users.",
          },
        ],
        education: [
          {
            school: "UT Austin",
            degree: "M.S.",
            field: "Computer Science",
            startDate: "2016-09",
            endDate: "2018-05",
          },
        ],
        skills: [
          { name: "TypeScript", level: "expert" },
          { name: "React", level: "expert" },
          { name: "Node.js", level: "advanced" },
        ],
      },
      isPremium: false,
    },
    {
      name: "Executive Suite",
      description: "Sophisticated design for executive and leadership roles",
      category: "executive",
      layoutKey: LayoutKey.EXECUTIVE_FORMAL,
      themeId: "theme-executive-suite",
      defaultData: {
        personalInfo: {
          firstName: "Michael",
          lastName: "Anderson",
          email: "michael.anderson@example.com",
          phone: "+1 (555) 789-0123",
          location: "Boston, MA",
          title: "Chief Technology Officer",
          summary: "Visionary technology executive with 20+ years of experience.",
        },
        experience: [
          {
            company: "Enterprise Solutions Inc.",
            position: "Chief Technology Officer",
            startDate: "2018-01",
            endDate: "2024-01",
            description: "Led technology strategy for global enterprise.",
          },
        ],
        education: [
          {
            school: "MIT",
            degree: "Ph.D.",
            field: "Computer Science",
            startDate: "2008-09",
            endDate: "2013-06",
          },
        ],
        skills: [
          { name: "Strategic Planning", level: "expert" },
          { name: "Cloud Architecture", level: "expert" },
          { name: "AI/ML Strategy", level: "advanced" },
        ],
      },
      isPremium: true,
    },
  ];

  console.log("🌱 Seeding templates...");
  for (const template of templates) {
    await prisma.template.create({
      data: template,
    });
  }
  console.log("✅ Templates seeded successfully!");
}

async function main() {
  await seedTemplates();
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

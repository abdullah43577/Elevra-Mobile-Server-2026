// import { prisma } from "../src/lib/prisma";

import { LayoutKey } from "../src/generated/prisma/enums";
import { prisma } from "../src/lib/prisma";

// const PROFESSIONS: { name: string; category?: string }[] = [
//   // Tech
//   { name: "Software Engineering", category: "Tech" },
//   { name: "Frontend Development", category: "Tech" },
//   { name: "Backend Development", category: "Tech" },
//   { name: "Full Stack Development", category: "Tech" },
//   { name: "Mobile Development", category: "Tech" },
//   { name: "DevOps", category: "Tech" },
//   { name: "Cloud Engineering", category: "Tech" },
//   { name: "Data Engineering", category: "Tech" },
//   { name: "Data Science", category: "Tech" },
//   { name: "Machine Learning", category: "Tech" },
//   { name: "Artificial Intelligence", category: "Tech" },
//   { name: "Cybersecurity", category: "Tech" },
//   { name: "QA / Testing", category: "Tech" },
//   { name: "UI/UX Design", category: "Tech" },
//   { name: "Graphic Design", category: "Tech" },
//   { name: "Product Design", category: "Tech" },
//   { name: "Product Management", category: "Tech" },
//   { name: "Technical Support", category: "Tech" },
//   { name: "IT Administration", category: "Tech" },

//   // Business
//   { name: "Marketing", category: "Business" },
//   { name: "Sales", category: "Business" },
//   { name: "Business Development", category: "Business" },
//   { name: "Operations", category: "Business" },
//   { name: "Project Management", category: "Business" },
//   { name: "Human Resources", category: "Business" },
//   { name: "Finance", category: "Business" },
//   { name: "Accounting", category: "Business" },
//   { name: "Customer Success", category: "Business" },
//   { name: "Customer Support", category: "Business" },
//   { name: "Administration", category: "Business" },
//   { name: "Legal", category: "Business" },
//   { name: "Procurement", category: "Business" },
//   { name: "Supply Chain", category: "Business" },
//   { name: "Consulting", category: "Business" },

//   // Healthcare
//   { name: "Medicine", category: "Healthcare" },
//   { name: "Nursing", category: "Healthcare" },
//   { name: "Pharmacy", category: "Healthcare" },
//   { name: "Dentistry", category: "Healthcare" },
//   { name: "Public Health", category: "Healthcare" },
//   { name: "Medical Laboratory", category: "Healthcare" },

//   // Education
//   { name: "Teaching", category: "Education" },
//   { name: "Research", category: "Education" },
//   { name: "Academic Administration", category: "Education" },

//   // Creative
//   { name: "Content Writing", category: "Creative" },
//   { name: "Copywriting", category: "Creative" },
//   { name: "Photography", category: "Creative" },
//   { name: "Videography", category: "Creative" },
//   { name: "Animation", category: "Creative" },
//   { name: "Music", category: "Creative" },

//   // Trades
//   { name: "Construction", category: "Trades" },
//   { name: "Electrical", category: "Trades" },
//   { name: "Plumbing", category: "Trades" },
//   { name: "Mechanical Engineering", category: "Trades" },

//   // Public Service
//   { name: "Government", category: "Public Service" },
//   { name: "Non-Profit", category: "Public Service" },
//   { name: "Law Enforcement", category: "Public Service" },

//   // Miscellaneous
//   { name: "Hospitality", category: "Hospitality" },
//   { name: "Real Estate", category: "Business" },
//   { name: "Agriculture", category: "Agriculture" },
//   { name: "Manufacturing", category: "Manufacturing" },
//   { name: "Transportation", category: "Logistics" },
//   { name: "Logistics", category: "Logistics" },

//   { name: "Other" },
// ];
// async function main() {
//   for (const profession of PROFESSIONS) {
//     await prisma.profession.upsert({
//       where: { name: profession.name },
//       update: {},
//       create: profession,
//     });
//   }
//   console.log(`Seeded ${PROFESSIONS.length} professions.`);
// }

// main()
//   .catch(error => {
//     console.error(error);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });

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

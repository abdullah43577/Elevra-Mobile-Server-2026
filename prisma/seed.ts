// import { prisma } from "../src/lib/prisma";

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
  const templates = [
    {
      name: "Modern Professional",
      description: "Clean and modern design perfect for corporate roles",
      thumbnail: "https://res.cloudinary.com/demo/image/upload/v1/resume-templates/modern-professional.png",
      category: "professional",
      sections: [
        { id: "personal", name: "Personal Info", enabled: true, order: 0 },
        { id: "summary", name: "Professional Summary", enabled: true, order: 1 },
        { id: "experience", name: "Work Experience", enabled: true, order: 2 },
        { id: "education", name: "Education", enabled: true, order: 3 },
        { id: "skills", name: "Skills", enabled: true, order: 4 },
      ],
      styles: {
        primaryColor: "#2563EB",
        fontFamily: "Inter",
        spacing: "normal",
        layout: "single-column",
      },
      isPremium: false,
    },
    {
      name: "Creative Portfolio",
      description: "Bold and creative design for design and creative roles",
      thumbnail: "https://res.cloudinary.com/demo/image/upload/v1/resume-templates/creative-portfolio.png",
      category: "creative",
      sections: [
        { id: "personal", name: "Personal Info", enabled: true, order: 0 },
        { id: "summary", name: "Professional Summary", enabled: true, order: 1 },
        { id: "experience", name: "Work Experience", enabled: true, order: 2 },
        { id: "projects", name: "Projects", enabled: true, order: 3 },
        { id: "skills", name: "Skills", enabled: true, order: 4 },
      ],
      styles: {
        primaryColor: "#EC4899",
        fontFamily: "Inter",
        spacing: "spacious",
        layout: "two-column",
      },
      isPremium: true,
    },
    {
      name: "Minimal Classic",
      description: "Timeless and elegant design for any industry",
      thumbnail: "https://res.cloudinary.com/demo/image/upload/v1/resume-templates/minimal-classic.png",
      category: "minimal",
      sections: [
        { id: "personal", name: "Personal Info", enabled: true, order: 0 },
        { id: "summary", name: "Professional Summary", enabled: true, order: 1 },
        { id: "experience", name: "Work Experience", enabled: true, order: 2 },
        { id: "education", name: "Education", enabled: true, order: 3 },
        { id: "skills", name: "Skills", enabled: true, order: 4 },
        { id: "certifications", name: "Certifications", enabled: true, order: 5 },
      ],
      styles: {
        primaryColor: "#1F2937",
        fontFamily: "Inter",
        spacing: "compact",
        layout: "single-column",
      },
      isPremium: false,
    },
    {
      name: "Executive Suite",
      description: "Sophisticated design for executive and leadership roles",
      thumbnail: "https://res.cloudinary.com/demo/image/upload/v1/resume-templates/executive-suite.png",
      category: "executive",
      sections: [
        { id: "personal", name: "Personal Info", enabled: true, order: 0 },
        { id: "summary", name: "Executive Summary", enabled: true, order: 1 },
        { id: "experience", name: "Leadership Experience", enabled: true, order: 2 },
        { id: "education", name: "Education", enabled: true, order: 3 },
        { id: "skills", name: "Core Competencies", enabled: true, order: 4 },
        { id: "references", name: "References", enabled: true, order: 5 },
      ],
      styles: {
        primaryColor: "#0F172A",
        fontFamily: "Inter",
        spacing: "normal",
        layout: "single-column",
      },
      isPremium: true,
    },
  ];

  console.log("🌱 Seeding templates...");
  await prisma.template.createMany({
    data: templates,
    skipDuplicates: true,
  });
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

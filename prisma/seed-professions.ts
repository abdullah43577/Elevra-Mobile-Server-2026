import { prisma } from "../src/lib/prisma";

const PROFESSIONS: { name: string; category?: string }[] = [
  { name: "Software Engineering", category: "Tech" },
  { name: "Frontend Development", category: "Tech" },
  { name: "Backend Development", category: "Tech" },
  { name: "Full Stack Development", category: "Tech" },
  { name: "Mobile Development", category: "Tech" },
  { name: "DevOps", category: "Tech" },
  { name: "Cloud Engineering", category: "Tech" },
  { name: "Data Engineering", category: "Tech" },
  { name: "Data Science", category: "Tech" },
  { name: "Machine Learning", category: "Tech" },
  { name: "Artificial Intelligence", category: "Tech" },
  { name: "Cybersecurity", category: "Tech" },
  { name: "QA / Testing", category: "Tech" },
  { name: "UI/UX Design", category: "Tech" },
  { name: "Graphic Design", category: "Tech" },
  { name: "Product Design", category: "Tech" },
  { name: "Product Management", category: "Tech" },
  { name: "Technical Support", category: "Tech" },
  { name: "IT Administration", category: "Tech" },

  { name: "Marketing", category: "Business" },
  { name: "Sales", category: "Business" },
  { name: "Business Development", category: "Business" },
  { name: "Operations", category: "Business" },
  { name: "Project Management", category: "Business" },
  { name: "Human Resources", category: "Business" },
  { name: "Finance", category: "Business" },
  { name: "Accounting", category: "Business" },
  { name: "Customer Success", category: "Business" },
  { name: "Customer Support", category: "Business" },
  { name: "Administration", category: "Business" },
  { name: "Legal", category: "Business" },
  { name: "Procurement", category: "Business" },
  { name: "Supply Chain", category: "Business" },
  { name: "Consulting", category: "Business" },

  { name: "Medicine", category: "Healthcare" },
  { name: "Nursing", category: "Healthcare" },
  { name: "Pharmacy", category: "Healthcare" },
  { name: "Dentistry", category: "Healthcare" },
  { name: "Public Health", category: "Healthcare" },
  { name: "Medical Laboratory", category: "Healthcare" },

  { name: "Teaching", category: "Education" },
  { name: "Research", category: "Education" },
  { name: "Academic Administration", category: "Education" },

  { name: "Content Writing", category: "Creative" },
  { name: "Copywriting", category: "Creative" },
  { name: "Photography", category: "Creative" },
  { name: "Videography", category: "Creative" },
  { name: "Animation", category: "Creative" },
  { name: "Music", category: "Creative" },

  { name: "Construction", category: "Trades" },
  { name: "Electrical", category: "Trades" },
  { name: "Plumbing", category: "Trades" },
  { name: "Mechanical Engineering", category: "Trades" },

  { name: "Government", category: "Public Service" },
  { name: "Non-Profit", category: "Public Service" },
  { name: "Law Enforcement", category: "Public Service" },

  { name: "Hospitality", category: "Hospitality" },
  { name: "Real Estate", category: "Business" },
  { name: "Agriculture", category: "Agriculture" },
  { name: "Manufacturing", category: "Manufacturing" },
  { name: "Transportation", category: "Logistics" },
  { name: "Logistics", category: "Logistics" },

  { name: "Other" },
];

async function main() {
  for (const profession of PROFESSIONS) {
    await prisma.profession.upsert({
      where: { name: profession.name },
      update: {},
      create: profession,
    });
  }
  console.log(`✅ Seeded ${PROFESSIONS.length} professions.`);
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

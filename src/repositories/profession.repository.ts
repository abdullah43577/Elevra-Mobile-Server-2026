import { prisma } from "../lib/prisma";

export class ProfessionRepository {
  async findAll() {
    return prisma.profession.findMany({
      orderBy: { name: "asc" },
    });
  }
}

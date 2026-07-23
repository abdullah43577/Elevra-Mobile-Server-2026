import { ProfessionRepository } from "../repositories/profession.repository";

export class ProfessionService {
  private professionRepo = new ProfessionRepository();

  async listProfessions() {
    try {
      return await this.professionRepo.findAll();
    } catch (error) {
      throw error;
    }
  }
}

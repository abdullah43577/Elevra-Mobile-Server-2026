import { CareerProfileRepository, type CareerProfileWriteData } from "../repositories/career-profile.repository";
import type { ResumeDataInput } from "../schemas/resume-data";
import { NotFoundError } from "../lib/errors";

export class CareerProfileService {
  private careerProfileRepo = new CareerProfileRepository();

  // null, not a 404: no profile is every account's first state, and a 404 would make the client toast.
  async getProfile(userId: string) {
    return this.careerProfileRepo.findByUser(userId);
  }

  // `!== undefined`, not truthiness: an empty array is how a section gets cleared.
  async saveProfile(userId: string, data: ResumeDataInput) {
    const writeData: CareerProfileWriteData = {
      ...(data.personalInfo !== undefined && { personalInfo: data.personalInfo }),
      ...(data.experience !== undefined && { experience: data.experience }),
      ...(data.education !== undefined && { education: data.education }),
      ...(data.skills !== undefined && { skills: data.skills }),
      ...(data.languages !== undefined && { languages: data.languages }),
      ...(data.certifications !== undefined && { certifications: data.certifications }),
      ...(data.projects !== undefined && { projects: data.projects }),
      ...(data.references !== undefined && { references: data.references }),
    };

    return this.careerProfileRepo.upsert(userId, writeData);
  }

  async deleteProfile(userId: string) {
    const profile = await this.careerProfileRepo.findByUser(userId);
    if (!profile) {
      throw new NotFoundError("Career profile not found");
    }

    return this.careerProfileRepo.delete(userId);
  }
}

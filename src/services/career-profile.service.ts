import { CareerProfileRepository, type CareerProfileWriteData } from "../repositories/career-profile.repository";
import type { ResumeDataInput } from "../schemas/resume-data";
import { NotFoundError } from "../lib/errors";

export class CareerProfileService {
  private careerProfileRepo = new CareerProfileRepository();

  /*
    Returns null rather than throwing when the user has not built one yet.
    "No profile" is the normal first state of every account, and a 404 here
    would make the client toast an error on the first screen it opens.
  */
  async getProfile(userId: string) {
    return this.careerProfileRepo.findByUser(userId);
  }

  /*
    A section is only written when the caller actually sent it, so saving one
    step of the editor cannot wipe the sections it did not touch. Sending an
    empty array is how a section gets cleared — hence `!== undefined` and not a
    truthiness check.
  */
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

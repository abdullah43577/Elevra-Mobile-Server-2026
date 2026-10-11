import { parseSections } from "../lib/resume-sections";
import { CareerProfileRepository } from "../repositories/career-profile.repository";
import { ResumeRepository } from "../repositories/resume/resume.repository";
import type { ResumeDataInput } from "../schemas/resume-data";

export interface CandidateSourceLabel {
  kind: "resume" | "profile";
  title: string;
}

export interface CandidateSource {
  data: ResumeDataInput;
  label: CandidateSourceLabel;
}

// One unreadable legacy row must not stop the search for a usable source.
const tryParseSections = function (record: Record<string, unknown>) {
  try {
    return parseSections(record);
  } catch {
    return null;
  }
};

export class CandidateSourceService {
  private resumeRepo = new ResumeRepository();
  private careerProfileRepo = new CareerProfileRepository();

  async find(userId: string, attachedResumeId: string | null): Promise<CandidateSource | null> {
    if (attachedResumeId) {
      const resume = await this.resumeRepo.findById(attachedResumeId, userId);
      const data = resume ? tryParseSections(resume) : null;
      if (resume && data?.experience?.length) return { data, label: { kind: "resume", title: resume.title } };
    }

    const profile = await this.careerProfileRepo.findByUser(userId);
    const profileData = profile ? tryParseSections(profile) : null;
    if (profileData?.experience?.length) return { data: profileData, label: { kind: "profile", title: "Career profile" } };

    for (const resume of await this.resumeRepo.findManyByUser(userId)) {
      const data = tryParseSections(resume);
      if (data?.experience?.length) return { data, label: { kind: "resume", title: resume.title } };
    }

    return null;
  }
}

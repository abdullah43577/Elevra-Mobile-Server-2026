import { resumeDataSchema } from "./resume-data";

/*
  A profile is a partial by definition — someone fills in their contact details
  today and their work history next week — so every section is optional and the
  same schema serves create and update. The route upserts.
*/
export const saveCareerProfileSchema = resumeDataSchema;

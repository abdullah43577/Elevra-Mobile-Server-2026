import type { ApplicationStatus } from "../generated/prisma/client";
import { JobApplicationRepository } from "../repositories/job-application.repository";
import { NotificationService } from "./notification.service";

const DAY = 1000 * 60 * 60 * 24;

/*
  How long an application sits untouched in a given status before it is worth a
  nudge, and what that nudge says. Copy lives here rather than at the call site
  so every reminder reads consistently.
*/
const REMINDER_RULES = [
  {
    status: "SAVED" as ApplicationStatus,
    idleDays: 3,
    title: "Ready to apply?",
    body: (company: string, role: string, days: number) =>
      `You saved the ${role} role at ${company} ${days} days ago.`,
  },
  {
    status: "APPLIED" as ApplicationStatus,
    idleDays: 7,
    title: "Time to follow up",
    body: (company: string, role: string, days: number) =>
      `No word from ${company} on your ${role} application in ${days} days.`,
  },
  {
    status: "INTERVIEWING" as ApplicationStatus,
    idleDays: 5,
    title: "How did it go?",
    body: (company: string, role: string, days: number) =>
      `Your ${company} interview for ${role} was ${days} days ago. Update its status.`,
  },
];

// Never nudge the same application more than once a week, whatever the rule.
const COOLDOWN_DAYS = 7;

export class ReminderService {
  private applicationRepo = new JobApplicationRepository();
  private notificationService = new NotificationService();

  /*
    Sweeps applications that have gone quiet and notifies their owners.

    Runs for every user by default (the scheduled job). Pass a userId to run it
    for a single account, which is what the on-demand endpoint uses.
  */
  async sweep(userId?: string) {
    const now = new Date();
    const cooldownBefore = new Date(now.getTime() - COOLDOWN_DAYS * DAY);

    const rules = REMINDER_RULES.map(rule => ({
      status: rule.status,
      idleSince: new Date(now.getTime() - rule.idleDays * DAY),
    }));

    const due = await this.applicationRepo.findDueForReminder(rules, cooldownBefore, userId);
    if (due.length === 0) return { reminded: 0 };

    for (const application of due) {
      const rule = REMINDER_RULES.find(r => r.status === application.status);
      if (!rule) continue;

      const since =
        application.status === "SAVED"
          ? application.createdAt
          : application.status === "APPLIED"
            ? (application.appliedAt ?? application.createdAt)
            : application.statusChangedAt;

      const days = Math.max(1, Math.floor((now.getTime() - new Date(since).getTime()) / DAY));

      await this.notificationService.notify({
        userId: application.userId,
        type: "APPLICATION_REMINDER",
        title: rule.title,
        body: rule.body(application.company, application.role, days),
        entityType: "application",
        entityId: application.id,
      });
    }

    // Stamped after the fact so a crash mid-sweep re-notifies rather than
    // silently skipping applications that never got their notification.
    await this.applicationRepo.markReminded(
      due.map(application => application.id),
      now,
    );

    return { reminded: due.length };
  }
}

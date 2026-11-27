import type { Application, ApplicationStatus, UUID } from "../domain/models";
import type { DatabaseAdapter } from "../infrastructure/database/DatabaseAdapter";
import { PostgresApplicationRepository } from "../repositories/ApplicationRepository";
import { PostgresJobRepository } from "../repositories/JobRepository";
import { NotificationService } from "./NotificationService";

const employerTransitions: Record<ApplicationStatus, ApplicationStatus[]> = {
  applied: ["reviewed", "declined"], reviewed: ["interview", "declined"], interview: ["declined"], hired: [], declined: [], withdrawn: [],
};

/** Enforces worker/employer application status transitions independently of database policies. */
export class ApplicationService {
  constructor(private readonly database: DatabaseAdapter) {}

  async transitionStatus(applicationId: UUID, actorUserId: UUID, target: ApplicationStatus): Promise<Application> {
    if (target === "hired") throw new Error("Use hire to complete a transactional hiring transition");
    return this.database.transaction(async (transaction) => {
      const applications = new PostgresApplicationRepository(transaction);
      const jobs = new PostgresJobRepository(transaction);
      const application = await applications.findById(applicationId);
      if (!application) throw new Error("Application not found");
      const job = await jobs.findById(application.jobId);
      if (!job) throw new Error("Job not found");
      const workerWithdrawal = target === "withdrawn" && actorUserId === application.workerId && ["applied", "reviewed", "interview"].includes(application.status);
      const employerChange = actorUserId === job.employerId && employerTransitions[application.status].includes(target);
      if (!workerWithdrawal && !employerChange) throw new Error("This application status change is not permitted");
      const changed = await applications.updateStatus(applicationId, target);
      if (!changed) throw new Error("Application update failed");
      if (target === "declined") {
        await new NotificationService(transaction).notify(application.workerId, "application_status_change", "Application updated", `Your application was ${target}.`);
      }
      return changed;
    });
  }

  async hire(applicationId: UUID, actorUserId: UUID): Promise<Application> {
    return this.database.transaction(async (transaction) => {
      const applications = new PostgresApplicationRepository(transaction);
      const jobs = new PostgresJobRepository(transaction);
      const application = await applications.findById(applicationId);
      if (!application) throw new Error("Application not found");
      const job = await jobs.findById(application.jobId);
      if (!job || job.employerId !== actorUserId) throw new Error("Only the listing employer can hire an applicant");
      if (application.status !== "interview") throw new Error("Only interviewed applicants can be hired");
      const hired = await applications.updateStatus(applicationId, "hired");
      if (!hired) throw new Error("Application update failed");
      const updatedJob = await jobs.incrementWorkersHired(job.id);
      if (!updatedJob) throw new Error("Job update failed");
      if (updatedJob.workersHired >= updatedJob.workersNeeded) await jobs.update(updatedJob.id, { status: "filled" });
      return hired;
    });
  }
}

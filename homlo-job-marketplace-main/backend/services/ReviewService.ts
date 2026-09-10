import type { Review, UUID } from "../domain/models";
import type { DatabaseAdapter } from "../infrastructure/database/DatabaseAdapter";
import { PostgresApplicationRepository } from "../repositories/ApplicationRepository";
import { PostgresJobRepository } from "../repositories/JobRepository";
import { PostgresReviewRepository } from "../repositories/EngagementRepository";

export class ReviewService {
  constructor(private readonly database: DatabaseAdapter) {}
  async submitReview(jobId: UUID, reviewerId: UUID, revieweeId: UUID, rating: number, comment: string | null): Promise<Review> {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error("Ratings must be a whole number from 1 to 5");
    const jobs = new PostgresJobRepository(this.database);
    const job = await jobs.findById(jobId);
    if (!job || !["filled", "closed"].includes(job.status)) throw new Error("Reviews are available only after a job is completed");
    const application = await new PostgresApplicationRepository(this.database).findByJobAndWorker(jobId, reviewerId);
    const isWorkerReview = application?.status === "hired" && job.employerId === revieweeId;
    const isEmployerReview = job.employerId === reviewerId && (await new PostgresApplicationRepository(this.database).findByJobAndWorker(jobId, revieweeId))?.status === "hired";
    if (!isWorkerReview && !isEmployerReview) throw new Error("Reviews require a completed working relationship");
    try { return await new PostgresReviewRepository(this.database).create(jobId, reviewerId, revieweeId, rating, comment); }
    catch (error) { if (String(error).toLowerCase().includes("uq_reviews_active")) throw new Error("You have already reviewed this completed job"); throw error; }
  }
}

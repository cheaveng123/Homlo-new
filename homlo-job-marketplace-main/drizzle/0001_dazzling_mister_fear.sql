CREATE TABLE `applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`jobId` varchar(120) NOT NULL,
	`availability` varchar(80) NOT NULL,
	`note` text,
	`status` enum('submitted','under_review','interview','accepted','rejected') NOT NULL DEFAULT 'submitted',
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `applications_id` PRIMARY KEY(`id`),
	CONSTRAINT `applications_user_job_unique` UNIQUE(`userId`,`jobId`)
);

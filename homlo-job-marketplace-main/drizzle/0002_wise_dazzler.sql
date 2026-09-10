CREATE TABLE `jobSeekerProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`headline` varchar(160),
	`location` varchar(160),
	`bio` text,
	`skills` text,
	`availability` varchar(120),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobSeekerProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `job_seeker_profiles_user_unique` UNIQUE(`userId`)
);

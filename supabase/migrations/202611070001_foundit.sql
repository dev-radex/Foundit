BEGIN;
CREATE SCHEMA foundit;
SET LOCAL search_path TO foundit, public;

CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"affiliation" text DEFAULT '',
	"department" text DEFAULT '',
	"level" text DEFAULT '',
	"verified" text DEFAULT 'unverified' NOT NULL,
	"suspended" integer DEFAULT 0 NOT NULL,
	"onboarded" integer DEFAULT 0 NOT NULL,
	"created" text NOT NULL
);

CREATE TABLE "reports" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"location" text NOT NULL,
	"date" text NOT NULL,
	"private_note" text DEFAULT '' NOT NULL,
	"photo" text DEFAULT '',
	"status" text DEFAULT 'open' NOT NULL,
	"moderation" text DEFAULT 'visible' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created" text NOT NULL,
	FOREIGN KEY ("owner") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE "claims" (
	"id" text PRIMARY KEY NOT NULL,
	"report" text NOT NULL,
	"claimant" text NOT NULL,
	"reason" text NOT NULL,
	"features" text NOT NULL,
	"answer" text DEFAULT '' NOT NULL,
	"evidence" text DEFAULT '',
	"status" text DEFAULT 'pending' NOT NULL,
	"escalated" integer DEFAULT 0 NOT NULL,
	"created" text NOT NULL,
	FOREIGN KEY ("report") REFERENCES "reports"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("claimant") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"report" text NOT NULL,
	"owner" text NOT NULL,
	"member" text NOT NULL,
	"created" text NOT NULL,
	FOREIGN KEY ("report") REFERENCES "reports"("id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation" text NOT NULL,
	"sender" text NOT NULL,
	"body" text NOT NULL,
	"system" integer DEFAULT 0 NOT NULL,
	"read" integer DEFAULT 0 NOT NULL,
	"created" text NOT NULL,
	FOREIGN KEY ("conversation") REFERENCES "conversations"("id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"link" text NOT NULL,
	"read" integer DEFAULT 0 NOT NULL,
	"created" text NOT NULL
);

CREATE TABLE "files" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"purpose" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"created" text NOT NULL
);

CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user" text NOT NULL,
	"document" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"note" text DEFAULT '',
	"created" text NOT NULL,
	FOREIGN KEY ("user") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE "abuse" (
	"id" text PRIMARY KEY NOT NULL,
	"user" text NOT NULL,
	"target_type" text NOT NULL,
	"target" text NOT NULL,
	"reason" text NOT NULL,
	"details" text DEFAULT '',
	"status" text DEFAULT 'open' NOT NULL,
	"note" text DEFAULT '',
	"created" text NOT NULL
);

CREATE TABLE "announcements" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"pinned" integer DEFAULT 0 NOT NULL,
	"expires" text DEFAULT '',
	"created" text NOT NULL
);

CREATE TABLE "taxonomy" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"parent" text DEFAULT '',
	"active" integer DEFAULT 1 NOT NULL
);

CREATE TABLE "audit" (
	"id" text PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"target" text NOT NULL,
	"detail" text DEFAULT '',
	"created" text NOT NULL
);

CREATE TABLE "blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"target" text NOT NULL
);

CREATE UNIQUE INDEX "block_once" ON "blocks" ("owner","target");
CREATE UNIQUE INDEX "claim_once" ON "claims" ("report","claimant");
CREATE UNIQUE INDEX "one_accepted_claim" ON "claims" ("report") WHERE "claims"."status" in ('approved','recovered');
CREATE UNIQUE INDEX "conversation_once" ON "conversations" ("report","member");

ALTER TABLE users ADD CONSTRAINT valid_role CHECK(role IN ('member','admin','super-admin'));
ALTER TABLE reports ADD CONSTRAINT valid_type CHECK(type IN ('lost','found'));
ALTER TABLE reports ADD CONSTRAINT valid_report_status CHECK(status IN ('open','closed','recovered'));
ALTER TABLE reports ADD CONSTRAINT valid_moderation CHECK(moderation IN ('visible','hidden','removed'));
ALTER TABLE claims ADD CONSTRAINT valid_claim_status CHECK(status IN ('pending','more_info','approved','rejected','recovered'));
ALTER TABLE files ADD CONSTRAINT valid_file_purpose CHECK(purpose IN ('photo','evidence','verification'));
ALTER TABLE files ADD CONSTRAINT valid_file_size CHECK(size > 0 AND size <= 3145728);
CREATE INDEX reports_visibility_created ON reports(moderation, created DESC);
CREATE INDEX reports_owner ON reports(owner);
CREATE INDEX claims_claimant ON claims(claimant);
CREATE INDEX messages_conversation_created ON messages(conversation, created);
CREATE INDEX notifications_user_created ON notifications("user", created DESC);
CREATE INDEX verifications_user_status ON verifications("user", status);
CREATE INDEX audit_created ON audit(created DESC);
REVOKE ALL ON SCHEMA foundit FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA foundit FROM PUBLIC, anon, authenticated;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE abuse ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxonomy ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
-- No browser-accessible policies: all data access passes through authenticated Next.js handlers.
-- DATABASE_URL is server-only and must connect as the schema owner (the Supabase postgres role).
COMMIT;

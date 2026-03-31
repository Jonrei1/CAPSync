// Represents a user profile row from the profiles table.
export type User = {
	id: string;
	full_name: string | null;
	email: string | null;
	created_at: string;
};

// Represents a group row from the groups table.
export type Group = {
	id: string;
	name: string;
	created_by: string | null;
	created_at: string;
	archived_at: string | null;
	subject: string | null;
	color: string | null;
};

// Represents a membership row linking users to groups.
export type GroupMember = {
	id: string;
	group_id: string;
	member_id: string;
	color: string | null;
	role: string;
	joined_at: string;
};

// Represents a sprint row for a group.
export type Sprint = {
	id: string;
	group_id: string;
	title: string;
	start_date: string;
	end_date: string;
	goal: string | null;
	status: "upcoming" | "active" | "done" | string;
	ai_generated: boolean;
	created_at: string;
};

// Represents a task row.
export type Task = {
	id: string;
	group_id: string;
	sprint_id: string | null;
	created_by: string | null;
	assigned_to: string | null;
	title: string;
	description: string | null;
	status: string;
	category: string | null;
	due_date: string | null;
	priority: string;
	requires_pm_approval: boolean;
	approved_by: string | null;
	approved_at: string | null;
	position: number | null;
	created_at: string;
	updated_at: string;
};

// Represents a task comment row.
export type Comment = {
	id: string;
	task_id: string;
	author_id: string | null;
	body: string;
	created_at: string;
};

export type EmptyObject = Record<string, never>;

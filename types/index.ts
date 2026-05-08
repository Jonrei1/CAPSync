export type Methodology = "scrum" | "agile" | "waterfall" | "kanban";
export type TaskStatus = "todo" | "doing" | "review" | "done" | "blocked";
export type SprintStatus = "upcoming" | "active" | "done" | "locked";

// Represents a user profile row from the profiles table.
export type User = {
	id: string;
	full_name: string | null;
	email: string | null;
	created_at: string;
};

export type Profile = User & {
	role?: string | null;
	color?: string | null;
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
	invite_code?: string | null;
	methodology?: Methodology | string | null;
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
	status: SprintStatus | string;
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
	status: TaskStatus | string;
	category: string | null;
	due_date: string | null;
	priority: string;
	requires_pm_approval: boolean;
	approved_by: string | null;
	approved_at: string | null;
	position: number | null;
	starts_at: string | null;
	ends_at: string | null;
	is_all_day: boolean;
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

export type TrackerComment = Comment & {
	author?: User | null;
};

export type TrackerTask = Task & {
	assignee?: User | null;
	comments?: TrackerComment[];
};

export type TrackerSprint = Sprint & {
	tasks: TrackerTask[];
};

export type EmptyObject = Record<string, never>;

export type CalendarMember = {
	id: string;
	name: string;
	ini: string;
	bg: string;
	lt: string;
	bd: string;
	tc: string;
	role: "pm" | "member";
};

export type CalendarBlock = {
	memberId: string;
	days: string[];
	s: number;
	e: number;
	lbl: string;
	sub: string;
	routine: boolean;
	// optional: schedule id for meetings
	id?: string;
	// creator user id for permissions
	creatorId?: string;
	// longer description / agenda
	description?: string;
	// creator display name
	creatorName?: string;
	// last edited by display name
	lastEditedByName?: string;
};

export type FreeWindow = {
	days: string[];
	s: number;
	e: number;
	memberIds: string[];
	lbl: string;
	dur: string;
};

export type CalendarDeadline = {
	days: string[];
	lbl: string;
};

export type AppRole = "admin" | "user";

export type TaskStatus = "OPEN" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ImportStatus = "pending" | "processing" | "completed" | "failed";
export type ImportSource = "fireflies" | "file_upload" | "plaud";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  general_summary: string;
  source: ImportSource;
  raw_transcript?: string;
  fireflies_meeting_id?: string;
  project_id?: string;
  created_at: string;
  topics?: MeetingTopic[];
  participants?: MeetingParticipant[];
  tasks?: Task[];
  tags?: Tag[];
}

export interface MeetingTopic {
  id: string;
  meeting_id: string;
  title: string;
  notes: string[];
}

export interface MeetingParticipant {
  id: string;
  meeting_id: string;
  name: string;
  email?: string;
}

export type TaskSource = "manual" | "fireflies" | "plaud" | "file_upload";

export interface Task {
  id: string;
  meeting_id: string;
  project_id?: string;
  description: string;
  assignee_name: string;
  assignee_user_id?: string;
  due_date?: string;
  priority: TaskPriority;
  status: TaskStatus;
  source?: TaskSource;
  timestamp_ref?: string;
  created_at: string;
  updated_at: string;
  meeting_title?: string;
}

export interface Note {
  id: string;
  entity_type: "meeting" | "task";
  entity_id: string;
  content: string;
  author_id: string;
  author_name: string;
  created_at: string;
}

export interface Import {
  meeting_id?: string;
  project_id?: string;
  project_name?: string;
  id: string;
  source_type: ImportSource;
  file_name?: string;
  status: ImportStatus;
  error_message?: string;
  meetings_created: number;
  tasks_created: number;
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  created_at: string;
  depends_on_task?: Task;
}

export type ProjectStatus = "planning" | "active" | "completed" | "archived";
export type ProjectMemberRole = "owner" | "member" | "viewer";

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  icon: string;
  color: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  task_count?: number;
  member_count?: number;
  completion_rate?: number;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectMemberRole;
  created_at: string;
  profile?: Profile;
}

export interface ProjectDocument {
  id: string;
  project_id: string;
  name: string;
  file_path: string;
  uploaded_by?: string;
  created_at: string;
}

export interface KPIData {
  totalMeetings: number;
  openTasks: number;
  overdueTasks: number;
  completionRate: number;
  totalProjects?: number;
  activeProjects?: number;
  totalMembers?: number;
}

export interface TaskStatusLog {
  id: string;
  task_id: string;
  old_status: TaskStatus | null;
  new_status: TaskStatus;
  changed_by: string;
  changed_by_name: string;
  note: string | null;
  created_at: string;
  task_description?: string;
}


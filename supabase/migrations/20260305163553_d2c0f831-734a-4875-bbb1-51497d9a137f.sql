-- Clear all task-related data first
DELETE FROM task_status_log;
DELETE FROM task_dependencies;
DELETE FROM tasks;

-- Clear meeting-related data
DELETE FROM meeting_topics;
DELETE FROM meeting_participants;
DELETE FROM meeting_tags;

-- Clear meetings themselves
DELETE FROM meetings;

-- Clear imports
DELETE FROM imports;
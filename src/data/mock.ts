import type { Meeting, Task, Import, Tag, KPIData, Profile } from "@/types";

export const mockKPIs: KPIData = {
  totalMeetings: 47,
  openTasks: 23,
  overdueTasks: 5,
  completionRate: 72,
};

export const mockProfiles: Profile[] = [
  { id: "u1", email: "admin@company.com", full_name: "Sarah Chen", created_at: "2025-01-15" },
  { id: "u2", email: "john@company.com", full_name: "John Martinez", created_at: "2025-02-01" },
  { id: "u3", email: "aisha@company.com", full_name: "Aisha Patel", created_at: "2025-02-10" },
  { id: "u4", email: "mike@company.com", full_name: "Mike Thompson", created_at: "2025-03-01" },
];

export const mockTags: Tag[] = [
  { id: "t1", name: "BCP" },
  { id: "t2", name: "Risk Management" },
  { id: "t3", name: "Compliance" },
  { id: "t4", name: "Operations" },
  { id: "t5", name: "Strategy" },
];

export const mockMeetings: Meeting[] = [
  {
    id: "m1",
    title: "AI BCP Review — Feb 3, 2026",
    date: "2026-02-03T10:00:00Z",
    general_summary: "Comprehensive review of the Business Continuity Plan focusing on red flag monitoring, dashboard development progress, and incident response procedures. Key decisions made on timeline for Phase 2 rollout and resource allocation for monitoring infrastructure.",
    source: "fireflies",
    fireflies_meeting_id: "ff-abc123",
    created_at: "2026-02-03T11:30:00Z",
    topics: [
      {
        id: "mt1", meeting_id: "m1", title: "Red Flag Monitoring and Dashboard",
        notes: ["Dashboard MVP ready for review by Feb 15", "Need to integrate real-time alert system", "Compliance team to review alert thresholds"],
      },
      {
        id: "mt2", meeting_id: "m1", title: "Incident Response Procedures",
        notes: ["Updated escalation matrix approved", "Quarterly drill scheduled for March", "Documentation needs updating"],
      },
      {
        id: "mt3", meeting_id: "m1", title: "Resource Allocation",
        notes: ["Two additional engineers approved for Q2", "Budget increase of 15% for monitoring tools"],
      },
    ],
    participants: [
      { id: "mp1", meeting_id: "m1", name: "Sarah Chen", email: "admin@company.com" },
      { id: "mp2", meeting_id: "m1", name: "John Martinez" },
      { id: "mp3", meeting_id: "m1", name: "Aisha Patel" },
    ],
    tags: [mockTags[0], mockTags[1]],
  },
  {
    id: "m2",
    title: "Weekly Operations Sync — Jan 27, 2026",
    date: "2026-01-27T14:00:00Z",
    general_summary: "Weekly sync covering operational metrics, vendor management updates, and upcoming audit preparation. Team discussed bottlenecks in the approval pipeline and agreed on process improvements.",
    source: "fireflies",
    created_at: "2026-01-27T15:00:00Z",
    topics: [
      {
        id: "mt4", meeting_id: "m2", title: "Vendor Management",
        notes: ["Three vendor contracts up for renewal in Q2", "Performance review for Vendor X completed"],
      },
      {
        id: "mt5", meeting_id: "m2", title: "Audit Preparation",
        notes: ["Pre-audit documentation 80% complete", "Mock audit scheduled for Feb 10"],
      },
    ],
    participants: [
      { id: "mp4", meeting_id: "m2", name: "John Martinez" },
      { id: "mp5", meeting_id: "m2", name: "Mike Thompson" },
    ],
    tags: [mockTags[3]],
  },
  {
    id: "m3",
    title: "Compliance Strategy Review — Jan 20, 2026",
    date: "2026-01-20T09:00:00Z",
    general_summary: "Strategic review of compliance framework updates required for new regulatory changes effective Q3 2026. Discussion of gap analysis results and remediation timeline.",
    source: "file_upload",
    created_at: "2026-01-20T10:30:00Z",
    topics: [
      {
        id: "mt6", meeting_id: "m3", title: "Regulatory Changes",
        notes: ["New data protection requirements effective July 2026", "Impact assessment due by March 15"],
      },
    ],
    participants: [
      { id: "mp6", meeting_id: "m3", name: "Sarah Chen" },
      { id: "mp7", meeting_id: "m3", name: "Aisha Patel" },
    ],
    tags: [mockTags[2], mockTags[4]],
  },
];

export const mockTasks: Task[] = [
  { id: "tk1", meeting_id: "m1", description: "Finalize dashboard MVP and share with compliance team for review", assignee_name: "John Martinez", assignee_user_id: "u2", due_date: "2026-02-15", priority: "HIGH", status: "IN_PROGRESS", timestamp_ref: "00:15:32", created_at: "2026-02-03", updated_at: "2026-02-03", meeting_title: "AI BCP Review — Feb 3, 2026" },
  { id: "tk2", meeting_id: "m1", description: "Update incident response documentation with new escalation matrix", assignee_name: "Aisha Patel", assignee_user_id: "u3", due_date: "2026-02-20", priority: "MEDIUM", status: "OPEN", timestamp_ref: "00:32:10", created_at: "2026-02-03", updated_at: "2026-02-03", meeting_title: "AI BCP Review — Feb 3, 2026" },
  { id: "tk3", meeting_id: "m1", description: "Schedule and coordinate Q1 incident response drill", assignee_name: "Sarah Chen", assignee_user_id: "u1", due_date: "2026-03-01", priority: "MEDIUM", status: "OPEN", created_at: "2026-02-03", updated_at: "2026-02-03", meeting_title: "AI BCP Review — Feb 3, 2026" },
  { id: "tk4", meeting_id: "m2", description: "Complete vendor performance reviews for Q1 renewals", assignee_name: "Mike Thompson", assignee_user_id: "u4", due_date: "2026-02-10", priority: "HIGH", status: "OPEN", created_at: "2026-01-27", updated_at: "2026-01-27", meeting_title: "Weekly Operations Sync — Jan 27, 2026" },
  { id: "tk5", meeting_id: "m2", description: "Finalize pre-audit documentation package", assignee_name: "John Martinez", assignee_user_id: "u2", due_date: "2026-02-05", priority: "CRITICAL", status: "OPEN", created_at: "2026-01-27", updated_at: "2026-01-27", meeting_title: "Weekly Operations Sync — Jan 27, 2026" },
  { id: "tk6", meeting_id: "m3", description: "Conduct gap analysis for new data protection regulations", assignee_name: "Aisha Patel", assignee_user_id: "u3", due_date: "2026-03-15", priority: "HIGH", status: "IN_PROGRESS", created_at: "2026-01-20", updated_at: "2026-01-20", meeting_title: "Compliance Strategy Review — Jan 20, 2026" },
  { id: "tk7", meeting_id: "m3", description: "Draft remediation plan for compliance gaps", assignee_name: "Sarah Chen", assignee_user_id: "u1", due_date: "2026-01-25", priority: "HIGH", status: "COMPLETED", created_at: "2026-01-20", updated_at: "2026-01-20", meeting_title: "Compliance Strategy Review — Jan 20, 2026" },
];

export const mockImports: Import[] = [
  { id: "i1", source_type: "fireflies", status: "completed", meetings_created: 1, tasks_created: 3, created_at: "2026-02-03T11:30:00Z" },
  { id: "i2", source_type: "fireflies", status: "completed", meetings_created: 1, tasks_created: 2, created_at: "2026-01-27T15:00:00Z" },
  { id: "i3", source_type: "file_upload", file_name: "compliance-review-jan20.pdf", status: "completed", meetings_created: 1, tasks_created: 2, created_at: "2026-01-20T10:30:00Z" },
  { id: "i4", source_type: "fireflies", status: "failed", error_message: "API rate limit exceeded", meetings_created: 0, tasks_created: 0, created_at: "2026-01-15T09:00:00Z" },
  { id: "i5", source_type: "file_upload", file_name: "meeting-notes-scan.jpg", status: "processing", meetings_created: 0, tasks_created: 0, created_at: "2026-02-04T08:00:00Z" },
];

export const mockChartMeetings = [
  { month: "Oct", count: 8 },
  { month: "Nov", count: 12 },
  { month: "Dec", count: 6 },
  { month: "Jan", count: 14 },
  { month: "Feb", count: 7 },
];

export const mockChartTaskCompletion = [
  { month: "Oct", completed: 15, total: 22 },
  { month: "Nov", completed: 20, total: 28 },
  { month: "Dec", completed: 12, total: 18 },
  { month: "Jan", completed: 25, total: 35 },
  { month: "Feb", completed: 8, total: 12 },
];

/** Row shapes returned by the server functions. */
export type AdmitMode = "manual" | "roster" | "auto";
export type IdLabel = "phone" | "matric";
export type MemberStatus = "pending" | "approved" | "rejected";
export type ResourceKind = "link" | "note" | "video" | "document";

export type ClassRow = {
  id: string;
  tutor_id: string;
  title: string;
  subject: string;
  description: string;
  join_code: string;
  admit_mode: AdmitMode;
  id_label: IdLabel;
  attendance_threshold: number;
  member_limit: number;
  live_room_name: string | null;
  live_room_url: string | null;
  live_started_at: string | null;
  live_empty_since: string | null;
  session_started_at: string | null;
  session_ended_at: string | null;
  presenting_resource_id: string | null;
  presenting_page: number;
  rep_member_id: string | null;
  created_at: string;
};
export type MemberRow = {
  id: string;
  class_id: string;
  name: string;
  phone: string;
  status: MemberStatus;
  joined_at: string;
  last_seen_at: string | null;
  left_at: string | null;
  present_seconds: number;
};
export type ResourceRow = {
  id: string;
  class_id: string;
  title: string;
  kind: ResourceKind;
  url: string | null;
  body: string;
  order_index: number;
  visible: boolean;
  created_at: string;
};
export type RosterRow = { id: string; class_id: string; identifier: string; created_at: string };
export type SessionRow = {
  id: string;
  class_id: string;
  started_at: string;
  ended_at: string | null;
  title: string;
  subject: string;
  join_code: string;
  id_label: IdLabel;
  attendance_threshold: number;
};
export type AttendanceRow = {
  id: string;
  session_id: string;
  member_id: string;
  name: string;
  identifier: string;
  present_seconds: number;
  joined_at: string;
  last_seen_at: string | null;
  left_at: string | null;
};
export type RepActionRow = {
  id: string;
  class_id: string;
  rep_name: string;
  action: string;
  target_name: string;
  created_at: string;
};
export type LinkedQuiz = {
  id: string;
  mode: "pop" | "async";
  pushed_at: string | null;
  quiz_id: string;
  quizzes: {
    id: string;
    title: string;
    join_code: string;
    status: "draft" | "lobby" | "live" | "ended";
    opens_at: string | null;
    closes_at: string | null;
  };
};

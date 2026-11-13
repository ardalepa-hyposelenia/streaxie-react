export type Rules = {
  version: number;
  habit_type: "BINARY" | "QUANTITY" | "TIME_LIMIT";
  target_operator: "EQ" | "GTE" | "LTE";
  target_value: number;
  tolerance_value: number;
  unit_label?: string;
  evaluation_time_minutes: number;
  target_day_offset: number;
  effective_date?: string;
};
export type Habit = Rules & {
  id: string;
  title: string;
  current_streak: number;
  longest_streak: number;
  last_completed_date?: string;
  is_archived: boolean;
  deleted_at?: number;
  created_at: number;
  pending_rules?: Rules;
};
export type Status = "PERFECT" | "PASSED_TOLERATED" | "FAILED" | "UNCHECKED";
export type Log = {
  id: string;
  habit_id: string;
  logical_date: string;
  actual_value: number;
  occurred_date?: string;
  eval_status: Status;
  rules: Rules;
  client_recorded_at: number;
};
export type Mutation = {
  id: string;
  habit_id: string;
  logical_date: string;
  actual_value: number;
  occurred_date?: string;
  is_unchecked: boolean;
  client_recorded_at: number;
};
export type Pending = Mutation & {
  local_id: string;
  error?: string;
  rules?: Rules;
};
export type TimeSettings = {
  timezone: string;
  day_rollover_minutes: number;
  effective_from: number;
};
export type Settings = { current: TimeSettings; pending?: TimeSettings };
export type Profile = {
  id: string;
  email: string;
  email_verified_at: number | null;
  created_at: number;
  verification_deadline: number;
  read_only: boolean;
  onboarding_completed: boolean;
};
export type Cache = {
  habits: Habit[];
  logs: Log[];
  settings: Settings;
  revision: number;
};
export type Snapshot = Cache & { pending: Pending[] };
export type SyncPage = {
  sync_revision: number;
  settings: Settings;
  changes: { habits: Habit[] | null; habit_logs: Log[] | null };
  sync_report: {
    rejected_logs:
      { log_id: string; reason_code: string; message: string }[] | null;
  };
  next_pull_cursor?: unknown;
};

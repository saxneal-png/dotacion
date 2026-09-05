export interface SchoolSummary {
  rbd: string;
  establishment: string;
  matricula: number;
  horas_aula: number;
  horas_directivas: number;
  horas_tecnicas: number;
  total_horas_ee: number;
  teachers_count: number;
  over_44_count?: number;
  has_discrepancy: boolean;
  discrepancy_note?: string;
  source_file: string;
}

export interface TeacherRecord {
  id: string;
  file_name: string;
  rbd: string;
  establishment: string;
  rut: string;
  teacher_name: string;
  activity: string;
  hours: number;
  category: "AULA" | "TECNICA" | "DIRECTIVA";
  source: string;
  total_declared?: number;
  total_teacher_hours?: number;
  is_over_legal_limit?: boolean;
  legal_limit_warning?: string;
}

export interface KpiStats {
  total_schools: number;
  total_teachers: number;
  total_matricula: number;
  total_horas_general: number;
  total_horas_aula: number;
  total_horas_directivas: number;
  total_horas_tecnicas: number;
  pct_aula: number;
  pct_directivas: number;
  pct_tecnicas: number;
  discrepancies_count: number;
  teachers_over_44_count?: number;
}

export interface AuditItem {
  id: number;
  file_name: string;
  school_rbd: string;
  teacher_name: string;
  activity: string;
  hours: number;
  category: string;
  source: string;
  created_at: string;
}

export interface GeminiModel {
  id: string;
  display_name: string;
  description: string;
  badge?: string;
  is_recommended?: boolean;
  input_token_limit?: number;
  output_token_limit?: number;
}

export interface ModelsResponse {
  models: GeminiModel[];
  selected_model: string;
}

export interface ConsolidatedResponse {
  schools: SchoolSummary[];
  teachers: TeacherRecord[];
  kpis: KpiStats;
  processed_files: string[];
}



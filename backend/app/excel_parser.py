import os
import re
import io
import datetime
import pandas as pd
from typing import Dict, List, Any, Optional, Tuple, Union

def clean_str(val: Any) -> str:
    if val is None or pd.isna(val):
        return ""
    return str(val).strip()

def parse_hours_cell(val: Any) -> float:
    """
    Parses a cell that may contain numbers, decimals, or time formats:
    - datetime.time(12, 0) -> 12.0
    - datetime.time(1, 34) -> 1 + 34/60 = 1.5666...
    - "12:00" -> 12.0
    - "1:34" -> 1.5666...
    - "[40]:00" or "40:00" -> 40.0
    - "44" -> 44.0
    - "44,5" -> 44.5
    """
    if val is None or pd.isna(val):
        return 0.0

    if isinstance(val, (int, float)):
        return float(val)

    if isinstance(val, datetime.time):
        return val.hour + val.minute / 60.0 + val.second / 3600.0

    if isinstance(val, datetime.timedelta):
        return val.total_seconds() / 3600.0

    val_str = str(val).strip()
    if not val_str:
        return 0.0

    # Check time format with colon (e.g. "12:00", "01:34", "[47]:00", "47:00")
    if ":" in val_str:
        clean_time = val_str.replace("[", "").replace("]", "").strip()
        parts = clean_time.split(":")
        try:
            h = float(parts[0])
            m = float(parts[1]) if len(parts) > 1 else 0.0
            s = float(parts[2]) if len(parts) > 2 else 0.0
            return h + m / 60.0 + s / 3600.0
        except Exception:
            pass

    # Normal float string
    try:
        clean_num = val_str.replace(",", ".")
        clean_num = re.sub(r"[^\d.]", "", clean_num)
        return float(clean_num) if clean_num else 0.0
    except Exception:
        return 0.0

class SchoolDataExtractor:
    def __init__(self, file_input: Union[str, bytes, io.BytesIO], filename: str):
        self.file_input = file_input
        self.filename = filename
        self.rbd: str = ""
        self.establishment: str = ""
        self.matricula: int = 0
        self.teachers_data: List[Dict[str, Any]] = []

    def _get_bytes_io(self) -> io.BytesIO:
        if isinstance(self.file_input, bytes):
            return io.BytesIO(self.file_input)
        elif isinstance(self.file_input, io.BytesIO):
            self.file_input.seek(0)
            return self.file_input
        elif isinstance(self.file_input, str) and os.path.exists(self.file_input):
            with open(self.file_input, "rb") as f:
                return io.BytesIO(f.read())
        else:
            raise ValueError("Entrada de archivo inválida")

    def parse(self) -> Dict[str, Any]:
        ext = os.path.splitext(self.filename)[1].lower()
        bio = self._get_bytes_io()

        if ext == ".csv":
            try:
                df = pd.read_csv(bio, header=None, encoding="utf-8-sig", on_bad_lines="skip")
            except Exception:
                bio.seek(0)
                df = pd.read_csv(bio, header=None, encoding="latin1", on_bad_lines="skip")
            self._process_dataframe(df)
        elif ext in [".xlsx", ".xls"]:
            try:
                with pd.ExcelFile(bio) as xls:
                    selected_sheet = xls.sheet_names[0]
                    for name in xls.sheet_names:
                        if any(k in name.lower() for k in ["dotaci", "planilla", "horas", "docente"]):
                            selected_sheet = name
                            break
                    df = pd.read_excel(xls, sheet_name=selected_sheet, header=None)
                    self._process_dataframe(df)
            except Exception:
                bio.seek(0)
                df = pd.read_excel(bio, header=None)
                self._process_dataframe(df)
        else:
            raise ValueError(f"Formato no soportado: {ext}")

        # Fallbacks for metadata if not found in cells
        if not self.rbd:
            rbd_m = re.search(r"\b(\d{4,6})\b", self.filename)
            self.rbd = rbd_m.group(1) if rbd_m else "S/RBD"

        if not self.establishment or len(self.establishment) < 3:
            clean_name = os.path.splitext(self.filename)[0]
            clean_name = re.sub(r"(planilla|dotacion|slep|de|prueba|proyeccion|\d{4})", "", clean_name, flags=re.IGNORECASE).strip()
            self.establishment = clean_name.strip(" -_") or "Establecimiento Sin Nombre"

        return {
            "rbd": self.rbd,
            "establishment": self.establishment,
            "matricula": self.matricula,
            "teachers": self.teachers_data
        }

    def _process_dataframe(self, df: pd.DataFrame):
        max_rows = min(len(df), 30)
        header_row_idx = -1

        # 1. Scan metadata (RBD, Establecimiento, Matrícula)
        for r in range(max_rows):
            row_text = " ".join([clean_str(df.iat[r, c]) for c in range(min(15, df.shape[1]))])
            
            # Check RBD
            if not self.rbd:
                m_rbd = re.search(r"rbd\s*[:\.\-]?\s*(\d+)", row_text, re.IGNORECASE)
                if m_rbd:
                    self.rbd = m_rbd.group(1)
                else:
                    for c in range(df.shape[1]):
                        val = clean_str(df.iat[r, c]).lower()
                        if val == "rbd" and c + 1 < df.shape[1]:
                            next_val = clean_str(df.iat[r, c+1])
                            m = re.search(r"(\d+)", next_val)
                            if m:
                                self.rbd = m.group(1)
                                break

            # Check Establecimiento
            if not self.establishment:
                m_est = re.search(r"(?:establecimiento|escuela|liceo|colegio)\s*[:\.\-]?\s*([A-Za-zÀ-ÿ0-9\s\.\-]+)", row_text, re.IGNORECASE)
                if m_est:
                    candidate = m_est.group(1).strip()
                    if len(candidate) > 3 and not any(k in candidate.lower() for k in ["rbd", "docente", "matricula"]):
                        self.establishment = candidate.split(";")[0].split("-")[0].strip()
                else:
                    for c in range(df.shape[1]):
                        val = clean_str(df.iat[r, c]).lower()
                        if val in ["establecimiento", "nombre escuela", "nombre liceo", "escuela", "liceo"]:
                            if c + 1 < df.shape[1]:
                                cand = clean_str(df.iat[r, c+1])
                                if len(cand) > 3:
                                    self.establishment = cand
                                    break

            # Check Matrícula
            if not self.matricula:
                m_mat = re.search(r"matr[ií]cula\s*[:\.\-]?\s*(\d+)", row_text, re.IGNORECASE)
                if m_mat:
                    self.matricula = int(m_mat.group(1))
                else:
                    for c in range(df.shape[1]):
                        val = clean_str(df.iat[r, c]).lower()
                        if "matr" in val and "cula" in val and c + 1 < df.shape[1]:
                            cand_mat = clean_str(df.iat[r, c+1])
                            m = re.search(r"(\d+)", cand_mat)
                            if m:
                                self.matricula = int(m.group(1))
                                break

            # Check for Table Header Row
            row_lower = [clean_str(df.iat[r, c]).lower() for c in range(df.shape[1])]
            has_docente = any(k in " ".join(row_lower) for k in ["docente", "nombre", "profesor", "funcionario", "run", "rut"])
            has_horas = any(k in " ".join(row_lower) for k in ["hora", "hrs", "asignatura", "cargo", "total ha", "total hc"])
            if has_docente and has_horas:
                header_row_idx = r
                break

        if header_row_idx == -1:
            for r in range(max_rows):
                row_lower = [clean_str(df.iat[r, c]).lower() for c in range(df.shape[1])]
                if any("docente" in x or "nombre" in x or "rut" in x or "run" in x for x in row_lower):
                    header_row_idx = r
                    break

        if header_row_idx == -1:
            header_row_idx = 0

        self._extract_teachers(df, header_row_idx)

    def _extract_teachers(self, df: pd.DataFrame, header_idx: int):
        headers = [clean_str(df.iat[header_idx, c]).strip().lower() for c in range(df.shape[1])]

        col_nombres = -1
        col_run = -1
        col_contrato = -1
        col_total_ha = -1
        col_sub_gral = -1
        col_sub_sep = -1
        col_sub_pie = -1
        col_total_hc = -1
        col_actividad = -1
        col_horas_simple = -1

        for idx, h in enumerate(headers):
            if not h:
                continue

            if col_nombres == -1 and any(k in h for k in ["nombre", "docente", "profesor", "funcionario", "apellidos"]):
                col_nombres = idx
            elif col_run == -1 and any(k in h for k in ["run", "rut"]):
                col_run = idx
            elif any(k in h for k in ["horas contrato", "hrs contrato", "hrs. contrato"]):
                col_contrato = idx
            elif "total ha" in h or "horas aula" in h:
                col_total_ha = idx
            elif "sub. gral" in h or "sub gral" in h:
                col_sub_gral = idx
            elif "sub. sep" in h or "sub sep" in h:
                col_sub_sep = idx
            elif "sub. pie" in h or "sub pie" in h:
                col_sub_pie = idx
            elif "total hc" in h or "total hrs" in h or "total horas" in h:
                col_total_hc = idx
            elif col_actividad == -1 and any(k in h for k in ["asignatura", "cargo", "funcion", "actividad", "rol"]):
                col_actividad = idx
            elif col_horas_simple == -1 and any(k in h for k in ["hora", "hrs"]):
                col_horas_simple = idx

        if col_nombres == -1:
            col_nombres = 0

        # Check if the spreadsheet has the Hierarchical SLEP Structure
        # (Nombres + RUN + subtotal columns like Sub. Gral, Sub. SEP, Total HC)
        is_hierarchical = (col_sub_gral != -1 or col_total_hc != -1 or col_contrato != -1) and col_run != -1

        if is_hierarchical:
            self._extract_hierarchical(df, header_idx, col_nombres, col_run, col_contrato, col_total_ha, col_sub_gral, col_sub_sep, col_sub_pie, col_total_hc)
        else:
            self._extract_flat(df, header_idx, col_nombres, col_run, col_actividad, col_horas_simple, col_total_hc)

    def _extract_hierarchical(self, df: pd.DataFrame, header_idx: int, col_nombres: int, col_run: int, col_contrato: int, col_total_ha: int, col_sub_gral: int, col_sub_sep: int, col_sub_pie: int, col_total_hc: int):
        current_teacher = ""
        current_rut = ""
        current_contract = 0.0

        for r in range(header_idx + 1, len(df)):
            nombre_val = clean_str(df.iat[r, col_nombres])
            run_val = clean_str(df.iat[r, col_run]) if col_run != -1 and col_run < df.shape[1] else ""
            
            if not nombre_val and not run_val:
                continue

            nombre_lower = nombre_val.lower()

            # End of teacher block
            if nombre_lower.startswith("total") or nombre_lower.startswith("subtotal") or "promedio" in nombre_lower:
                continue

            # Detect Teacher Header Row:
            # Has a RUN (contains digits and hyphen, or format 10.274.857-3 or 10274857-3)
            # OR has contract hours in col_contrato and a person name
            has_run = bool(re.search(r"\d{1,2}\.?\d{3}\.?\d{3}[-‐][0-9kK]|\b\d{7,8}[-‐][0-9kK]\b", run_val))
            contrato_num = parse_hours_cell(df.iat[r, col_contrato]) if col_contrato != -1 and col_contrato < df.shape[1] else 0.0

            if has_run or (contrato_num > 0 and len(nombre_val.split()) >= 2 and not any(k in nombre_lower for k in ["historia", "lenguaje", "matematica", "artes", "musica", "recreo", "funciones"])):
                current_teacher = nombre_val
                current_rut = run_val
                current_contract = contrato_num
                continue

            # If not a teacher header row, it is an activity row under the current teacher
            if current_teacher and nombre_val:
                actividad = nombre_val

                h_gral = parse_hours_cell(df.iat[r, col_sub_gral]) if col_sub_gral != -1 and col_sub_gral < df.shape[1] else 0.0
                h_sep = parse_hours_cell(df.iat[r, col_sub_sep]) if col_sub_sep != -1 and col_sub_sep < df.shape[1] else 0.0
                h_pie = parse_hours_cell(df.iat[r, col_sub_pie]) if col_sub_pie != -1 and col_sub_pie < df.shape[1] else 0.0
                tot_hc = parse_hours_cell(df.iat[r, col_total_hc]) if col_total_hc != -1 and col_total_hc < df.shape[1] else 0.0
                tot_ha = parse_hours_cell(df.iat[r, col_total_ha]) if col_total_ha != -1 and col_total_ha < df.shape[1] else 0.0

                hours = h_gral + h_sep + h_pie
                if hours == 0.0 and tot_hc > 0.0:
                    hours = tot_hc
                if hours == 0.0 and tot_ha > 0.0:
                    # Convert pedagogical hours (45 min) to chronological (60 min)
                    hours = tot_ha * 45.0 / 60.0

                if hours > 0:
                    self.teachers_data.append({
                        "teacher_name": current_teacher,
                        "rut": current_rut,
                        "activity": actividad,
                        "hours": round(hours, 2),
                        "total_declared": current_contract if current_contract > 0 else hours
                    })

    def _extract_flat(self, df: pd.DataFrame, header_idx: int, col_nombres: int, col_run: int, col_actividad: int, col_horas: int, col_total: int):
        current_teacher = ""
        current_rut = ""

        for r in range(header_idx + 1, len(df)):
            row_docente = clean_str(df.iat[r, col_nombres]) if col_nombres != -1 and col_nombres < df.shape[1] else ""
            if not row_docente and col_run != -1 and col_run < df.shape[1]:
                row_docente = clean_str(df.iat[r, col_run])

            if not row_docente or any(k in row_docente.lower() for k in ["total", "subtotal", "promedio", "slep"]):
                continue

            current_teacher = row_docente
            current_rut = clean_str(df.iat[r, col_run]) if col_run != -1 and col_run < df.shape[1] else ""
            row_total = parse_hours_cell(df.iat[r, col_total]) if col_total != -1 and col_total < df.shape[1] else 0.0

            if col_actividad != -1 and col_horas != -1:
                act = clean_str(df.iat[r, col_actividad])
                h = parse_hours_cell(df.iat[r, col_horas])
                if act and h > 0:
                    self.teachers_data.append({
                        "teacher_name": current_teacher,
                        "rut": current_rut,
                        "activity": act,
                        "hours": round(h, 2),
                        "total_declared": row_total
                    })
                    continue

            # Fallback
            actividad = clean_str(df.iat[r, col_actividad]) if col_actividad != -1 else "Docencia de Aula"
            horas = parse_hours_cell(df.iat[r, col_horas]) if col_horas != -1 else row_total
            if horas > 0:
                self.teachers_data.append({
                    "teacher_name": current_teacher,
                    "rut": current_rut,
                    "activity": actividad or "Docencia de Aula",
                    "hours": round(horas, 2),
                    "total_declared": row_total if row_total > 0 else horas
                })

def parse_excel_file(file_input: Union[str, bytes, io.BytesIO], filename: str) -> Dict[str, Any]:
    extractor = SchoolDataExtractor(file_input, filename)
    return extractor.parse()

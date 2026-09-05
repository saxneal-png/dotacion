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

def is_rut(val: Any) -> bool:
    """
    Validates if a string looks like a Chilean RUN/RUT:
    - 12.345.678-9, 12345678-9, 12345678-k
    - 12345678k, 12.345.678k
    - Numeric integer of 7 to 9 digits (common in Excel RUN columns)
    """
    s = clean_str(val)
    if not s:
        return False
    if re.search(r"\b\d{1,2}\.?\d{3}\.?\d{3}[-‐][0-9kK]\b", s):
        return True
    if re.search(r"\b\d{7,8}[kK]\b", s):
        return True
    if re.fullmatch(r"\d{7,9}", s):
        return True
    return False

def looks_like_teacher_name(s: str) -> bool:
    """
    Heuristic to differentiate teacher person names from activity / subject labels.
    """
    s_clean = s.strip()
    if len(s_clean) < 4:
        return False
    s_lower = s_clean.lower()
    if any(k in s_lower for k in ["total", "subtotal", "promedio", "resumen", "rbd", "escuela", "colegio", "liceo", "slep"]):
        return False
    if any(s_lower.startswith(k) for k in [
        "recreo", "taller", "asignatura", "docencia", "planificacion", "planificación",
        "tiempo", "artículo", "art.", "horas", "formacion", "formación", "historia",
        "lenguaje", "matematica", "matemática", "ciencias", "artes", "musica", "música",
        "educacion", "educación", "ingles", "inglés", "filosofia", "filosofía", "biologia",
        "biología", "quimica", "química", "fisica", "física", "tecnologia", "tecnología",
        "religion", "religión", "orientacion", "orientación", "cra", "pie", "sep", "utp"
    ]):
        return False
    parts = s_clean.split()
    return len(parts) >= 2

def parse_hours_cell(val: Any) -> float:
    """
    Parses a cell that may contain numbers, decimals, time formats, or duration objects:
    - datetime.time(12, 0) -> 12.0
    - datetime.time(1, 34) -> 1.57
    - datetime.timedelta(days=1, seconds=72000) -> 44.0
    - datetime.datetime(1899, 12, 30, 12, 30) -> 12.5 (Excel time representation)
    - datetime.datetime(1900, 1, 1, 14, 0) -> 14.0 (Excel time representation)
    - datetime.datetime(1900, 1, 2, 20, 0) -> 44.0 (Excel duration representation)
    - pd.Timestamp('1900-01-01 12:30:00') -> 12.5
    - "12:00" / "12:00:00" -> 12.0
    - "1:34" -> 1.57
    - "[40]:00" or "40:00" -> 40.0
    - "44 HRS (SEP 2026)" -> 44.0
    - "30 HORAS LEY 19.070" -> 30.0
    - "44" / "44.5" / "44,5" -> 44.0 / 44.5
    - Date strings like "01/03/2024" or datetime(2024, 3, 1) -> 0.0 (ignored, not hours)
    - Values > 50 (e.g. 2024, 19070, 1520) -> 0.0 (sanity check for Chilean teacher contracts)
    """
    if val is None or pd.isna(val):
        return 0.0

    # 1. Delta time (pandas Timedelta or datetime.timedelta)
    if isinstance(val, (datetime.timedelta, pd.Timedelta)):
        total_h = val.total_seconds() / 3600.0
        return round(total_h, 2) if 0 < total_h <= 50 else 0.0

    # 2. Native datetime.time
    if isinstance(val, datetime.time):
        total_h = val.hour + val.minute / 60.0 + val.second / 3600.0
        return round(total_h, 2) if 0 < total_h <= 50 else 0.0

    # 3. Native datetime.datetime or pd.Timestamp (Excel time representation)
    if isinstance(val, (datetime.datetime, pd.Timestamp)):
        if val.year <= 1900:
            if val.year == 1899 and val.month == 12 and val.day == 30:
                total_h = val.hour + val.minute / 60.0 + val.second / 3600.0
            elif val.year == 1900:
                diff = (val.to_pydatetime() if hasattr(val, "to_pydatetime") else val) - datetime.datetime(1900, 1, 1)
                total_h = diff.total_seconds() / 3600.0
            else:
                total_h = val.hour + val.minute / 60.0 + val.second / 3600.0
            return round(total_h, 2) if 0 < total_h <= 50 else 0.0
        else:
            # Genuine calendar date (e.g. 2024-03-01) -> NOT an hours quantity
            return 0.0

    # 4. Numeric float or int
    if isinstance(val, (int, float)):
        fval = float(val)
        if 0 < fval <= 50:
            return round(fval, 2)
        return 0.0

    # 5. String parsing
    val_str = str(val).strip()
    if not val_str:
        return 0.0

    # Discard pure date strings (e.g. "01/03/2024", "2024-03-01", "01-03-2024")
    if re.search(r"^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$|^\d{4}[/-]\d{1,2}[/-]\d{1,2}$", val_str):
        return 0.0

    # Check time format with colon (e.g. "12:00", "01:34", "[44]:00", "44:00")
    time_match = re.search(r"\[?(\d+)\]?:(\d{1,2})(?::(\d{1,2}))?", val_str)
    if time_match:
        h = float(time_match.group(1))
        m = float(time_match.group(2)) if time_match.group(2) else 0.0
        s = float(time_match.group(3)) if time_match.group(3) else 0.0
        total_h = h + m / 60.0 + s / 3600.0
        if 0 < total_h <= 50:
            return round(total_h, 2)

    # Check for text with 'hrs' or 'horas': e.g. "44 HRS (SEP 2026)", "30 HORAS LEY 19.070"
    text_hrs_match = re.search(r"(?:^|\b)(\d+(?:[.,]\d+)?)\s*(?:hrs?|horas?)\b", val_str, re.IGNORECASE)
    if text_hrs_match:
        num_str = text_hrs_match.group(1).replace(",", ".")
        try:
            h = float(num_str)
            if 0 < h <= 50:
                return round(h, 2)
        except Exception:
            pass

    # Generic number extraction at start of string (e.g. "44", "44.5", "44,5")
    num_match = re.search(r"^\s*(\d+(?:[.,]\d+)?)", val_str)
    if num_match:
        num_str = num_match.group(1).replace(",", ".")
        try:
            h = float(num_str)
            if 0 < h <= 50:
                return round(h, 2)
        except Exception:
            pass

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
        max_rows = min(len(df), 50)
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
                    if len(candidate) > 3 and not any(k in candidate.lower() for k in ["rbd", "docente", "matricula", "slep"]):
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
            has_docente = any(k in " ".join(row_lower) for k in ["docente", "nombre", "profesor", "funcionario", "run", "rut", "personal"])
            has_horas = any(k in " ".join(row_lower) for k in ["hora", "hrs", "asignatura", "cargo", "total ha", "total hc", "funcion", "función", "jornada", "actividad", "especialidad"])
            if has_docente and has_horas and header_row_idx == -1:
                header_row_idx = r

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
        headers_row1 = [clean_str(df.iat[header_idx, c]).strip().lower() for c in range(df.shape[1])]
        
        # Check for two-tier / merged subheaders (e.g. Row 4: TOTAL HC, Row 5: Sub. Gral | Sub. SEP | Sub. PIE)
        has_sub_header = False
        headers_row2 = []
        if header_idx + 1 < len(df):
            headers_row2 = [clean_str(df.iat[header_idx + 1, c]).strip().lower() for c in range(df.shape[1])]
            count_h2_keywords = sum(1 for h in headers_row2 if any(k in h for k in ["run", "rut", "nombre", "cargo", "asignatura", "hora", "sub", "total"]))
            if count_h2_keywords >= 2:
                has_sub_header = True

        combined_headers = []
        for c in range(df.shape[1]):
            h1 = headers_row1[c] if c < len(headers_row1) else ""
            h2 = headers_row2[c] if has_sub_header and c < len(headers_row2) else ""
            if h1 and h2 and h1 != h2:
                combined_headers.append(f"{h1} {h2}")
            elif h2:
                combined_headers.append(h2)
            else:
                combined_headers.append(h1)

        headers = combined_headers if has_sub_header else headers_row1
        data_start_idx = header_idx + 2 if has_sub_header else header_idx + 1

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
            if col_nombres == -1 and any(k in h for k in ["nombre", "docente", "profesor", "funcionario", "apellidos", "personal"]):
                col_nombres = idx
            elif col_run == -1 and any(k in h for k in ["run", "rut", "cedula", "identificacion"]):
                col_run = idx
            elif any(k in h for k in ["horas contrato", "hrs contrato", "hrs. contrato", "total horas contrato", "total hrs contrato", "total contrato"]):
                col_contrato = idx
            elif "total ha" in h or "horas aula" in h:
                col_total_ha = idx
            elif "sub. gral" in h or "sub gral" in h or "titulares sub gral" in h:
                col_sub_gral = idx
            elif "sub. sep" in h or "sub sep" in h or "titulares sep" in h:
                col_sub_sep = idx
            elif "sub. pie" in h or "sub pie" in h or "titulares pie" in h:
                col_sub_pie = idx
            elif "total hc" in h or "total hrs" in h or "total horas" in h or "total cronologicas" in h:
                col_total_hc = idx
            elif col_actividad == -1 and any(k in h for k in ["asignatura", "cargo", "funcion", "función", "actividad", "rol", "especialidad", "materia", "descripcion", "descripción"]):
                col_actividad = idx
            elif col_horas_simple == -1 and any(k in h for k in ["horas asignadas", "horas lectivas", "jornada", "hora", "hrs"]):
                col_horas_simple = idx

        if col_nombres == -1:
            col_nombres = 0

        current_teacher = ""
        current_rut = ""
        current_contract = 0.0

        for r in range(data_start_idx, len(df)):
            nombre_raw = clean_str(df.iat[r, col_nombres]) if col_nombres != -1 and col_nombres < df.shape[1] else ""
            run_raw = clean_str(df.iat[r, col_run]) if col_run != -1 and col_run < df.shape[1] else ""
            act_raw = clean_str(df.iat[r, col_actividad]) if col_actividad != -1 and col_actividad < df.shape[1] else ""

            # Check for grand summary / total rows
            row_str_lower = " ".join([clean_str(df.iat[r, c]).lower() for c in range(min(5, df.shape[1]))])
            if any(row_str_lower.startswith(k) for k in ["total general", "resumen general", "subtotal general", "promedio general"]):
                continue

            # Inverted column correction: if name column contains RUN and RUN column contains name
            if is_rut(nombre_raw) and not is_rut(run_raw) and looks_like_teacher_name(run_raw):
                nombre_raw, run_raw = run_raw, nombre_raw

            contrato_num = parse_hours_cell(df.iat[r, col_contrato]) if col_contrato != -1 and col_contrato < df.shape[1] else 0.0
            h_simple = parse_hours_cell(df.iat[r, col_horas_simple]) if col_horas_simple != -1 and col_horas_simple < df.shape[1] else 0.0
            
            # SLEP breakdown columns
            h_gral = parse_hours_cell(df.iat[r, col_sub_gral]) if col_sub_gral != -1 and col_sub_gral < df.shape[1] else 0.0
            h_sep = parse_hours_cell(df.iat[r, col_sub_sep]) if col_sub_sep != -1 and col_sub_sep < df.shape[1] else 0.0
            h_pie = parse_hours_cell(df.iat[r, col_sub_pie]) if col_sub_pie != -1 and col_sub_pie < df.shape[1] else 0.0
            tot_hc = parse_hours_cell(df.iat[r, col_total_hc]) if col_total_hc != -1 and col_total_hc < df.shape[1] else 0.0
            tot_ha = parse_hours_cell(df.iat[r, col_total_ha]) if col_total_ha != -1 and col_total_ha < df.shape[1] else 0.0

            sub_hours = h_gral + h_sep + h_pie
            if sub_hours == 0.0 and tot_hc > 0.0:
                sub_hours = tot_hc
            if sub_hours == 0.0 and tot_ha > 0.0:
                sub_hours = tot_ha * 45.0 / 60.0

            has_new_run = is_rut(run_raw)
            has_teacher_name = looks_like_teacher_name(nombre_raw)

            # Update teacher context when a new teacher is detected
            if has_new_run or (has_teacher_name and nombre_raw != current_teacher):
                if has_teacher_name:
                    current_teacher = nombre_raw
                elif not current_teacher and nombre_raw:
                    current_teacher = nombre_raw
                if run_raw:
                    current_rut = run_raw
                if contrato_num > 0:
                    current_contract = contrato_num
                elif tot_hc > 0 and col_contrato == -1:
                    current_contract = tot_hc

            # Priority 1: Separate activity column (Flat format or Hierarchical with merged teacher cells)
            if act_raw and (h_simple > 0 or sub_hours > 0 or contrato_num > 0):
                act_hours = h_simple if h_simple > 0 else (sub_hours if sub_hours > 0 else contrato_num)
                self.teachers_data.append({
                    "teacher_name": current_teacher or nombre_raw,
                    "rut": current_rut or run_raw,
                    "activity": act_raw,
                    "hours": round(act_hours, 2),
                    "total_declared": current_contract or act_hours
                })
                continue

            # Priority 2: SLEP Hierarchical format (Activity is in col_nombres, hours in sub_hours)
            if current_teacher and nombre_raw and not has_new_run and sub_hours > 0:
                if not nombre_raw.lower().startswith(("total", "subtotal", "promedio")):
                    self.teachers_data.append({
                        "teacher_name": current_teacher,
                        "rut": current_rut,
                        "activity": nombre_raw,
                        "hours": round(sub_hours, 2),
                        "total_declared": current_contract or sub_hours
                    })
                    continue

            # Priority 3: Flat format with no separate activity column (activity defaults to "Docencia de Aula")
            if (current_teacher or nombre_raw) and (h_simple > 0 or contrato_num > 0) and not act_raw and not sub_hours:
                act_hours = h_simple if h_simple > 0 else contrato_num
                self.teachers_data.append({
                    "teacher_name": current_teacher or nombre_raw,
                    "rut": current_rut or run_raw,
                    "activity": "Docencia de Aula",
                    "hours": round(act_hours, 2),
                    "total_declared": current_contract or act_hours
                })
                continue

def parse_excel_file(file_input: Union[str, bytes, io.BytesIO], filename: str) -> Dict[str, Any]:
    extractor = SchoolDataExtractor(file_input, filename)
    return extractor.parse()

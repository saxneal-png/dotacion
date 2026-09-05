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
    - 16,496,711-5 (common comma formatting in Excel)
    - 12345678k, 12.345.678k
    - Numeric integer of 7 to 9 digits (common in Excel RUN columns)
    """
    s = clean_str(val)
    if not s:
        return False
    s_clean = s.replace(",", ".").replace(" ", "")
    if re.search(r"\b\d{1,2}\.?\d{3}\.?\d{3}[-‐][0-9kK]\b", s_clean):
        return True
    if re.search(r"\b\d{7,8}[-‐]?[kK]\b", s_clean):
        return True
    if re.fullmatch(r"\d{7,9}", s_clean):
        return True
    return False

def extract_role_from_name(name: str) -> Tuple[str, str]:
    """
    Extracts function/role written in parentheses in teacher name:
    e.g. 'FERRADA VENEGAS ROBERTO ANDRÉS (DIRECTOR)' -> ('FERRADA VENEGAS ROBERTO ANDRÉS', 'Director')
    """
    m = re.search(r"\(([^)]+)\)", name)
    if m:
        role = m.group(1).strip().title()
        clean_name = re.sub(r"\s*\([^)]+\)", "", name).strip()
        return clean_name, role
    return name.strip(), ""

def is_summary_or_total_label(s: str) -> bool:
    """
    Identifies summary, total, subtotal, and decorative metadata rows to avoid counting them as teachers/activities.
    """
    s_clean = s.strip().lower()
    if not s_clean:
        return False
    patterns = [
        r"^(total|subtotal|sub-total|sub\s*total|resumen|suma|promedio|totales|carga\s*horaria|total\s*general|total\s*docente|total\s*contrato|total\s*horas|total\s*hrs)\b",
        r"^(rbd|escuela|colegio|liceo|slep|servicio\s*local|simbolog[ií]a|observacion(es)?)\b"
    ]
    return any(re.search(p, s_clean) for p in patterns)

def looks_like_teacher_name(s: str) -> bool:
    """
    Heuristic to differentiate teacher person names (including placeholders like 'DOCENTE POR CONTRATAR')
    from activity / subject labels or summary labels.
    """
    s_clean = s.strip()
    if len(s_clean) < 3:
        return False
    if is_summary_or_total_label(s_clean):
        return False
    s_lower = s_clean.lower()
    
    # Check common teacher placeholders in public schools
    if any(k in s_lower for k in [
        "vacante", "por contratar", "reemplazo", "sin asignar", "a contratar", 
        "docente nuevo", "profesor nuevo", "pendiente", "profesional de apoyo"
    ]):
        return True

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
    return len(parts) >= 2 or len(s_clean) >= 5

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
    - Raw Excel day fractions: 0.267361 -> 6.42 hrs (0.267361 * 24), 0.5 -> 12.0 hrs
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
        # Excel fraction of day (e.g. 0.267361 for 6h26m, 0.5 for 12h)
        if 0.0 < fval < 1.0:
            converted = fval * 24.0
            if 0 < converted <= 50:
                return round(converted, 2)
        if 0 < fval <= 50:
            return round(fval, 2)
        return 0.0

    # 5. String parsing
    val_str = str(val).strip()
    if not val_str or val_str in ["-", ".", "nan", "NaN", "None"]:
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

    # Generic number extraction at start of string (e.g. "44", "44.5", "44,5", "0.267361")
    num_match = re.search(r"^\s*(\d+(?:[.,]\d+)?)", val_str)
    if num_match:
        num_str = num_match.group(1).replace(",", ".")
        try:
            h = float(num_str)
            if 0.0 < h < 1.0:
                converted = h * 24.0
                if 0 < converted <= 50:
                    return round(converted, 2)
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
            if col_nombres == -1 and any(k in h for k in ["nombre", "docente", "profesor", "funcionario", "apellidos", "personal", "nombres"]):
                col_nombres = idx
            elif col_run == -1 and any(k in h for k in ["run", "rut", "cedula", "identificacion"]):
                col_run = idx
            elif col_contrato == -1 and any(k in h for k in [
                "horas contrato", "hrs contrato", "hrs. contrato", "total horas contrato",
                "total hrs contrato", "total contrato", "horas totales", "total horas",
                "horas semanales", "total carga horaria"
            ]):
                col_contrato = idx
            elif col_total_ha == -1 and ("total ha" in h or "horas aula" in h):
                col_total_ha = idx
            elif col_sub_gral == -1 and (("total hc" in h and "gral" in h) or "hc sub. gral" in h or "hc sub gral" in h or (("sub. gral" in h or "sub gral" in h) and "titular" not in h and "contrata" not in h)):
                col_sub_gral = idx
            elif col_sub_sep == -1 and (("total hc" in h and "sep" in h) or "hc sub. sep" in h or "hc sub sep" in h or (("sub. sep" in h or "sub sep" in h) and "titular" not in h and "contrata" not in h)):
                col_sub_sep = idx
            elif col_sub_pie == -1 and (("total hc" in h and "pie" in h) or "hc sub. pie" in h or "hc sub pie" in h or (("sub. pie" in h or "sub pie" in h) and "titular" not in h and "contrata" not in h)):
                col_sub_pie = idx
            elif col_total_hc == -1 and (h == "total hc" or "total hc" in h or "total cronologicas" in h or "total cronológicas" in h or "horas cronologicas" in h or "horas cronológicas" in h):
                col_total_hc = idx
            elif col_actividad == -1 and any(k in h for k in ["asignatura", "cargo", "funcion", "función", "actividad", "rol", "especialidad", "materia", "descripcion", "descripción"]):
                col_actividad = idx
            elif col_horas_simple == -1 and any(k in h for k in ["horas asignadas", "horas lectivas", "jornada", "horas", "hora", "hrs"]):
                col_horas_simple = idx

        if col_nombres == -1:
            col_nombres = 0

        # CASE 1: Flat / Standard spreadsheet (explicit activity column)
        if col_actividad != -1 and (col_horas_simple != -1 or col_contrato != -1 or col_total_hc != -1):
            current_teacher = ""
            current_rut = ""
            current_contract = 0.0

            for r in range(data_start_idx, len(df)):
                nombre_raw = clean_str(df.iat[r, col_nombres]) if col_nombres != -1 and col_nombres < df.shape[1] else ""
                run_raw = clean_str(df.iat[r, col_run]) if col_run != -1 and col_run < df.shape[1] else ""
                act_raw = clean_str(df.iat[r, col_actividad]) if col_actividad != -1 and col_actividad < df.shape[1] else ""

                row_str_lower = " ".join([clean_str(df.iat[r, c]).lower() for c in range(min(5, df.shape[1]))])
                if is_summary_or_total_label(row_str_lower) or is_summary_or_total_label(nombre_raw):
                    continue

                if is_rut(nombre_raw) and not is_rut(run_raw):
                    nombre_raw, run_raw = run_raw, nombre_raw

                contrato_num = parse_hours_cell(df.iat[r, col_contrato]) if col_contrato != -1 and col_contrato < df.shape[1] else 0.0
                h_simple = parse_hours_cell(df.iat[r, col_horas_simple]) if col_horas_simple != -1 and col_horas_simple < df.shape[1] else 0.0
                tot_hc = parse_hours_cell(df.iat[r, col_total_hc]) if col_total_hc != -1 and col_total_hc < df.shape[1] else 0.0

                if nombre_raw and not is_summary_or_total_label(nombre_raw):
                    current_teacher = nombre_raw
                if run_raw:
                    current_rut = run_raw.replace(",", ".").replace(" ", "")
                if contrato_num > 0:
                    current_contract = contrato_num
                elif tot_hc > 0:
                    current_contract = tot_hc

                act_h = h_simple if h_simple > 0 else (tot_hc if tot_hc > 0 else contrato_num)
                
                # Never omit a teacher: fallback activity if blank
                clean_tname, role_in_name = extract_role_from_name(current_teacher)
                final_act = act_raw or role_in_name or "Docencia de Aula"

                if current_teacher and (act_h > 0 or current_contract > 0):
                    effective_h = act_h if act_h > 0 else current_contract
                    self.teachers_data.append({
                        "teacher_name": clean_tname,
                        "rut": current_rut,
                        "activity": final_act,
                        "hours": round(effective_h, 2),
                        "total_declared": current_contract or effective_h
                    })
            return

        # CASE 2: SLEP Hierarchical spreadsheet (activities in sub-rows under col_nombres)
        r = data_start_idx
        current_section = ""

        while r < len(df):
            c1 = clean_str(df.iat[r, col_nombres])
            c2 = clean_str(df.iat[r, col_run]) if col_run != -1 and col_run < df.shape[1] else ""

            # Check section headers
            if not c2 and c1 and any(k in c1.upper() for k in ["PIE", "CO DOCENTES", "EQUIPO GESTIÓN", "ASISTENTES", "SIMBOLOGÍA", "RESUMEN"]) and not looks_like_teacher_name(c1):
                current_section = c1.upper()
                r += 1
                continue

            if is_summary_or_total_label(c1):
                r += 1
                continue

            has_run = is_rut(c2) if col_run != -1 else False
            contrato_num = parse_hours_cell(df.iat[r, col_contrato]) if col_contrato != -1 and col_contrato < df.shape[1] else 0.0
            
            # Check any hours in master row
            h_gral_master = parse_hours_cell(df.iat[r, col_sub_gral]) if col_sub_gral != -1 and col_sub_gral < df.shape[1] else 0.0
            h_sep_master = parse_hours_cell(df.iat[r, col_sub_sep]) if col_sub_sep != -1 and col_sub_sep < df.shape[1] else 0.0
            h_pie_master = parse_hours_cell(df.iat[r, col_sub_pie]) if col_sub_pie != -1 and col_sub_pie < df.shape[1] else 0.0
            tot_hc_master = parse_hours_cell(df.iat[r, col_total_hc]) if col_total_hc != -1 and col_total_hc < df.shape[1] else 0.0
            any_master_h = (contrato_num > 0 or h_gral_master > 0 or h_sep_master > 0 or h_pie_master > 0 or tot_hc_master > 0)

            is_valid_teacher = has_run or (looks_like_teacher_name(c1) and (any_master_h or c1 != ""))
            if not is_valid_teacher:
                r += 1
                continue

            teacher_name_full = c1
            teacher_name, role_in_name = extract_role_from_name(teacher_name_full)
            teacher_rut = c2.replace(",", ".").replace(" ", "") if c2 else ""

            # Look ahead for sub-rows (activities)
            sub_rows = []
            sub_r = r + 1
            while sub_r < len(df):
                sub_c1 = clean_str(df.iat[sub_r, col_nombres])
                sub_c2 = clean_str(df.iat[sub_r, col_run]) if col_run != -1 and col_run < df.shape[1] else ""

                # Stop if next row is a new teacher with RUN
                if col_run != -1 and is_rut(sub_c2):
                    break
                # Stop if next row is a new teacher by name and has contract/hours
                sub_contrato = parse_hours_cell(df.iat[sub_r, col_contrato]) if col_contrato != -1 and col_contrato < df.shape[1] else 0.0
                if looks_like_teacher_name(sub_c1) and sub_contrato > 0:
                    break
                # Stop if section header
                if not sub_c2 and sub_c1 and any(k in sub_c1.upper() for k in ["PIE", "CO DOCENTES", "EQUIPO GESTIÓN", "SIMBOLOGÍA", "RESUMEN"]) and not looks_like_teacher_name(sub_c1):
                    break
                # Stop if summary row (do NOT add as activity)
                if is_summary_or_total_label(sub_c1):
                    sub_r += 1
                    break

                if sub_c1:
                    h_gral = parse_hours_cell(df.iat[sub_r, col_sub_gral]) if col_sub_gral != -1 and col_sub_gral < df.shape[1] else 0.0
                    h_sep = parse_hours_cell(df.iat[sub_r, col_sub_sep]) if col_sub_sep != -1 and col_sub_sep < df.shape[1] else 0.0
                    h_pie = parse_hours_cell(df.iat[sub_r, col_sub_pie]) if col_sub_pie != -1 and col_sub_pie < df.shape[1] else 0.0
                    tot_hc = parse_hours_cell(df.iat[sub_r, col_total_hc]) if col_total_hc != -1 and col_total_hc < df.shape[1] else 0.0
                    tot_ha = parse_hours_cell(df.iat[sub_r, col_total_ha]) if col_total_ha != -1 and col_total_ha < df.shape[1] else 0.0

                    h = h_gral + h_sep + h_pie
                    if h == 0.0 and tot_hc > 0.0:
                        h = tot_hc
                    if h == 0.0 and tot_ha > 0.0:
                        h = tot_ha * 45.0 / 60.0

                    if h > 0:
                        sub_rows.append((sub_c1, round(h, 2)))

                sub_r += 1

            if sub_rows:
                for act_name, act_h in sub_rows:
                    self.teachers_data.append({
                        "teacher_name": teacher_name,
                        "rut": teacher_rut,
                        "activity": act_name,
                        "hours": act_h,
                        "total_declared": contrato_num or act_h
                    })
            else:
                act_name = role_in_name
                if not act_name:
                    if "PIE" in current_section or (col_sub_pie != -1 and col_sub_pie < df.shape[1] and parse_hours_cell(df.iat[r, col_sub_pie]) > 0):
                        act_name = "Docente PIE"
                    elif "CO DOCENTE" in current_section:
                        act_name = "Co-docente"
                    else:
                        act_name = "Docencia de Aula"

                h_row = contrato_num
                if h_row == 0.0:
                    h_gral = parse_hours_cell(df.iat[r, col_sub_gral]) if col_sub_gral != -1 and col_sub_gral < df.shape[1] else 0.0
                    h_sep = parse_hours_cell(df.iat[r, col_sub_sep]) if col_sub_sep != -1 and col_sub_sep < df.shape[1] else 0.0
                    h_pie = parse_hours_cell(df.iat[r, col_sub_pie]) if col_sub_pie != -1 and col_sub_pie < df.shape[1] else 0.0
                    h_row = h_gral + h_sep + h_pie
                    if h_row == 0.0 and col_total_hc != -1 and col_total_hc < df.shape[1]:
                        h_row = parse_hours_cell(df.iat[r, col_total_hc])

                if h_row > 0 or contrato_num > 0:
                    effective_h = h_row if h_row > 0 else contrato_num
                    self.teachers_data.append({
                        "teacher_name": teacher_name,
                        "rut": teacher_rut,
                        "activity": act_name,
                        "hours": round(effective_h, 2),
                        "total_declared": contrato_num or effective_h
                    })

            r = sub_r

def parse_excel_file(file_input: Union[str, bytes, io.BytesIO], filename: str) -> Dict[str, Any]:
    extractor = SchoolDataExtractor(file_input, filename)
    return extractor.parse()


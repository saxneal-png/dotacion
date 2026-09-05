import os
import shutil
import tempfile
import io
import csv
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .excel_parser import parse_excel_file
from .classifier import (
    classify_local,
    classify_batch_with_gemini,
    save_to_cache,
    log_audit,
    get_db,
    get_gemini_prompt,
    set_gemini_prompt,
    reset_gemini_prompt,
    get_selected_model,
    set_selected_model,
    get_available_gemini_models,
    clear_database,
    DEFAULT_GEMINI_PROMPT,
    DEFAULT_GEMINI_MODELS
)
from .exporter import generate_consolidated_excel

app = FastAPI(
    title="Analizador de Dotación Docente SLEP",
    description="API para procesar planillas de dotación escolar, clasificar horas pedagógicas y generar el consolidado institucional.",
    version="1.0.0"
)

# Enable CORS for frontend Vite dev server and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Clean initial state (no demo data)
current_state = {
    "schools": [],
    "teachers": [],
    "last_processed_files": []
}

class TestApiKeyRequest(BaseModel):
    api_key: str
    model: Optional[str] = None

class GetModelsRequest(BaseModel):
    api_key: str

class SetModelRequest(BaseModel):
    model: str

class ReclassifyRequest(BaseModel):
    teacher_id: Optional[str] = None
    rut: Optional[str] = None
    teacher_name: Optional[str] = None
    activity: Optional[str] = None
    teacher_index: Optional[int] = None
    new_category: str
    reason: Optional[str] = "Ajuste manual de usuario"

class UpdatePromptRequest(BaseModel):
    prompt: str

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "Analizador Dotacion SLEP"}

@app.get("/api/prompt")
def get_prompt():
    return {
        "prompt": get_gemini_prompt(),
        "default_prompt": DEFAULT_GEMINI_PROMPT
    }

@app.post("/api/prompt")
def update_prompt(req: UpdatePromptRequest):
    if not req.prompt or len(req.prompt.strip()) < 20:
        raise HTTPException(status_code=400, detail="El prompt es demasiado corto.")
    set_gemini_prompt(req.prompt.strip())
    return {"success": True, "message": "Prompt de IA actualizado correctamente.", "prompt": get_gemini_prompt()}

@app.post("/api/prompt/reset")
def reset_prompt():
    reset_gemini_prompt()
    return {"success": True, "message": "Prompt restablecido al valor oficial por defecto.", "prompt": get_gemini_prompt()}

@app.get("/api/gemini-models/default")
def get_default_models():
    return {
        "success": True,
        "source": "default",
        "models": DEFAULT_GEMINI_MODELS,
        "selected_model": get_selected_model()
    }

@app.api_route("/api/gemini-models", methods=["GET", "POST"])
def get_models_for_key(
    req: Optional[GetModelsRequest] = None,
    api_key: Optional[str] = Query(None),
    x_gemini_key: Optional[str] = Header(None)
):
    key = ""
    if req and req.api_key:
        key = req.api_key.strip()
    elif api_key:
        key = api_key.strip()
    elif x_gemini_key:
        key = x_gemini_key.strip()

    if not key or len(key) < 10:
        return {
            "success": True,
            "source": "default",
            "models": DEFAULT_GEMINI_MODELS,
            "selected_model": get_selected_model()
        }
    try:
        models = get_available_gemini_models(key, raise_errors=True)
        return {
            "success": True,
            "source": "api",
            "models": models,
            "selected_model": get_selected_model()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudieron consultar los modelos con la clave proporcionada: {str(e)}")

@app.api_route("/api/model", methods=["GET", "POST"])
def manage_active_model(
    req: Optional[SetModelRequest] = None,
    model: Optional[str] = Query(None)
):
    if req and req.model:
        set_selected_model(req.model.strip())
    elif model:
        set_selected_model(model.strip())
    return {"success": True, "selected_model": get_selected_model()}


@app.post("/api/clear")
def clear_all():
    current_state["schools"] = []
    current_state["teachers"] = []
    current_state["last_processed_files"] = []
    clear_database()
    return get_current_consolidated_data()

@app.post("/api/test-gemini-key")
def test_gemini_key(req: TestApiKeyRequest):
    if not req.api_key or len(req.api_key.strip()) < 10:
        raise HTTPException(status_code=400, detail="API Key no válida o muy corta.")
    
    target_model = req.model.strip() if req.model else get_selected_model()
    candidate_models = [target_model]
    for m in [
        "gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash",
        "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash",
        "gemini-3.8-pro", "gemini-3.7-pro", "gemini-2.5-pro"
    ]:
        if m not in candidate_models:
            candidate_models.append(m)

    last_err = None
    try:
        from google import genai
        client = genai.Client(api_key=req.api_key.strip())
        successful_model = None
        response_text = ""
        for model in candidate_models:
            try:
                response = client.models.generate_content(
                    model=model,
                    contents="Responde únicamente con la palabra OK si estás activo."
                )
                if response and response.text:
                    successful_model = model
                    response_text = response.text.strip()
                    break
            except Exception as me:
                last_err = me
                continue

        if not successful_model:
            raise HTTPException(status_code=400, detail=f"Error validando clave con Gemini: {last_err}")

        allowed_models = get_available_gemini_models(req.api_key.strip())

        return {
            "success": True,
            "message": f"Conexión exitosa con Google Gemini API ({successful_model})",
            "model_tested": successful_model,
            "models": allowed_models,
            "response": response_text
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error conectando a Gemini: {str(e)}")

def process_file_data(file_input, filename: str, api_key: Optional[str] = None, model: Optional[str] = None):
    parsed = parse_excel_file(file_input, filename)
    teachers = parsed.get("teachers", [])
    
    # 1. Identify which activities need Gemini (not in local dictionary or cache)
    unknown_activities = set()
    preliminary_classifications = {}

    for t in teachers:
        act = t.get("activity", "Docencia de Aula")
        local_res = classify_local(act)
        if local_res:
            preliminary_classifications[act] = local_res
        else:
            unknown_activities.add(act)

    # 2. Call Gemini for unknown activities if API key is provided
    gemini_results = {}
    model_source_tag = "Google Gemini AI"
    if unknown_activities and api_key:
        gemini_results, used_model = classify_batch_with_gemini(list(unknown_activities), api_key, model=model)
        if used_model:
            model_source_tag = f"Google Gemini AI ({used_model})"

    # 3. Aggregate totals and build teacher records
    h_aula = 0.0
    h_dir = 0.0
    h_tec = 0.0
    school_teachers = []

    for idx, t in enumerate(teachers):
        act = t.get("activity", "Docencia de Aula")
        hours = float(t.get("hours", 0.0))
        
        if act in preliminary_classifications:
            cat, src = preliminary_classifications[act]
        elif act in gemini_results:
            cat = gemini_results[act]
            src = model_source_tag
        else:
            cat = "AULA"
            src = "Regla Heurística (Default)"

        if cat == "AULA":
            h_aula += hours
        elif cat == "DIRECTIVA":
            h_dir += hours
        elif cat == "TECNICA":
            h_tec += hours

        teacher_record = {
            "id": f"{parsed['rbd']}_{idx}_{act}",
            "file_name": filename,
            "rbd": parsed["rbd"],
            "establishment": parsed["establishment"],
            "rut": t.get("rut", ""),
            "teacher_name": t.get("teacher_name", ""),
            "activity": act,
            "hours": hours,
            "category": cat,
            "source": src,
            "total_declared": t.get("total_declared", hours),
            "total_teacher_hours": t.get("total_teacher_hours", hours),
            "is_over_legal_limit": t.get("is_over_legal_limit", False),
            "legal_limit_warning": t.get("legal_limit_warning", "")
        }
        school_teachers.append(teacher_record)

        # Audit entry
        log_audit(
            file_name=filename,
            school_rbd=parsed["rbd"],
            teacher_name=t.get("teacher_name", ""),
            activity=act,
            hours=hours,
            category=cat,
            source=src
        )

    tot_ee = h_aula + h_dir + h_tec
    
    # Calculate unique teachers count and deduplicated declared contract hours
    unique_teacher_contracts = {}
    over_44_teachers = set()
    for t in teachers:
        t_key = t.get("rut") or t.get("teacher_name") or "unknown"
        decl = float(t.get("total_declared") or t.get("hours", 0.0))
        if t_key not in unique_teacher_contracts or decl > unique_teacher_contracts[t_key]:
            unique_teacher_contracts[t_key] = decl
        if t.get("is_over_legal_limit"):
            over_44_teachers.add(t_key)

    declared_contract_sum = sum(unique_teacher_contracts.values())
    unique_teachers_count = len([k for k in unique_teacher_contracts if k != "unknown"]) or len(teachers)
    over_44_count = len(over_44_teachers)

    # Discrepancy validation
    has_discrepancy = False
    discrepancy_parts = []

    calc_sum = round(h_aula + h_dir + h_tec, 2)
    if declared_contract_sum > 0 and abs(calc_sum - declared_contract_sum) > 1.0:
        has_discrepancy = True
        discrepancy_parts.append(f"Diferencia entre horas calculadas ({calc_sum:.1f}h) y contrato consolidado ({declared_contract_sum:.1f}h)")

    if over_44_count > 0:
        has_discrepancy = True
        discrepancy_parts.append(f"⚠️ {over_44_count} docente(s) superan tope legal de 44 hrs semanales. Posible error de cálculo del establecimiento.")

    discrepancy_note = " | ".join(discrepancy_parts)

    school_summary = {
        "rbd": parsed["rbd"],
        "establishment": parsed["establishment"],
        "matricula": parsed["matricula"],
        "horas_aula": round(h_aula, 1),
        "horas_directivas": round(h_dir, 1),
        "horas_tecnicas": round(h_tec, 1),
        "total_horas_ee": round(tot_ee, 1),
        "teachers_count": unique_teachers_count,
        "over_44_count": over_44_count,
        "has_discrepancy": has_discrepancy,
        "discrepancy_note": discrepancy_note,
        "source_file": filename
    }

    return school_summary, school_teachers

@app.post("/api/upload")
async def upload_files(
    files: List[UploadFile] = File(...),
    gemini_api_key: Optional[str] = Form(None),
    gemini_model: Optional[str] = Form(None),
    x_gemini_key: Optional[str] = Header(None),
    x_gemini_model: Optional[str] = Header(None)
):
    api_key = gemini_api_key or x_gemini_key
    if api_key:
        api_key = api_key.strip()

    model = gemini_model or x_gemini_model
    if model:
        model = model.strip()

    all_schools = []
    all_teachers = []
    processed_filenames = []

    for file in files:
        try:
            file_bytes = await file.read()
            school_res, teachers_res = process_file_data(file_bytes, file.filename, api_key=api_key, model=model)
            all_schools.append(school_res)
            all_teachers.extend(teachers_res)
            processed_filenames.append(file.filename)
        except Exception as e:
            print(f"Error procesando {file.filename}: {e}")
            all_schools.append({
                "rbd": "ERROR",
                "establishment": f"Error en archivo: {file.filename}",
                "matricula": 0,
                "horas_aula": 0.0,
                "horas_directivas": 0.0,
                "horas_tecnicas": 0.0,
                "total_horas_ee": 0.0,
                "teachers_count": 0,
                "has_discrepancy": True,
                "discrepancy_note": str(e),
                "source_file": file.filename
            })

    current_state["schools"] = all_schools
    current_state["teachers"] = all_teachers
    current_state["last_processed_files"] = processed_filenames

    return get_current_consolidated_data()

def get_current_consolidated_data():
    schools = current_state["schools"]
    teachers = current_state["teachers"]

    total_schools = len(schools)
    total_teachers = len(teachers)
    total_matricula = sum(s.get("matricula", 0) for s in schools)
    tot_aula = sum(s.get("horas_aula", 0.0) for s in schools)
    tot_dir = sum(s.get("horas_directivas", 0.0) for s in schools)
    tot_tec = sum(s.get("horas_tecnicas", 0.0) for s in schools)
    tot_general = sum(s.get("total_horas_ee", 0.0) for s in schools)
    discrepancies_count = sum(1 for s in schools if s.get("has_discrepancy", False))

    kpis = {
        "total_schools": total_schools,
        "total_teachers": total_teachers,
        "total_matricula": total_matricula,
        "total_horas_general": round(tot_general, 1),
        "total_horas_aula": round(tot_aula, 1),
        "total_horas_directivas": round(tot_dir, 1),
        "total_horas_tecnicas": round(tot_tec, 1),
        "pct_aula": round((tot_aula / tot_general * 100), 1) if tot_general > 0 else 0,
        "pct_directivas": round((tot_dir / tot_general * 100), 1) if tot_general > 0 else 0,
        "pct_tecnicas": round((tot_tec / tot_general * 100), 1) if tot_general > 0 else 0,
        "discrepancies_count": discrepancies_count
    }

    return {
        "schools": schools,
        "teachers": teachers,
        "kpis": kpis,
        "processed_files": current_state["last_processed_files"]
    }

@app.get("/api/consolidated")
def get_consolidated():
    return get_current_consolidated_data()

@app.post("/api/reclassify")
def reclassify_teacher(req: ReclassifyRequest):
    new_cat = req.new_category.upper()
    if new_cat not in ["AULA", "TECNICA", "DIRECTIVA"]:
        raise HTTPException(status_code=400, detail="Categoría inválida.")

    target_idx = None

    # 1. Search by teacher_id
    if req.teacher_id:
        for idx, t in enumerate(current_state["teachers"]):
            if t.get("id") == req.teacher_id:
                target_idx = idx
                break

    # 2. Search by rut and activity
    if target_idx is None and req.rut:
        for idx, t in enumerate(current_state["teachers"]):
            if t.get("rut") == req.rut and (not req.activity or t.get("activity") == req.activity):
                target_idx = idx
                break

    # 3. Fallback by index
    if target_idx is None and req.teacher_index is not None:
        if 0 <= req.teacher_index < len(current_state["teachers"]):
            target_idx = req.teacher_index

    if target_idx is None:
        raise HTTPException(status_code=404, detail="Docente no encontrado.")

    teacher = current_state["teachers"][target_idx]
    old_cat = teacher["category"]
    hours = teacher["hours"]
    school_rbd = teacher["rbd"]

    teacher["category"] = new_cat
    teacher["source"] = f"Manual ({req.reason})"

    for s in current_state["schools"]:
        if s["rbd"] == school_rbd:
            if old_cat == "AULA":
                s["horas_aula"] = round(s["horas_aula"] - hours, 1)
            elif old_cat == "DIRECTIVA":
                s["horas_directivas"] = round(s["horas_directivas"] - hours, 1)
            elif old_cat == "TECNICA":
                s["horas_tecnicas"] = round(s["horas_tecnicas"] - hours, 1)

            if new_cat == "AULA":
                s["horas_aula"] = round(s["horas_aula"] + hours, 1)
            elif new_cat == "DIRECTIVA":
                s["horas_directivas"] = round(s["horas_directivas"] + hours, 1)
            elif new_cat == "TECNICA":
                s["horas_tecnicas"] = round(s["horas_tecnicas"] + hours, 1)

    log_audit(
        file_name=teacher.get("file_name", ""),
        school_rbd=school_rbd,
        teacher_name=teacher.get("teacher_name", ""),
        activity=teacher.get("activity", ""),
        hours=hours,
        category=new_cat,
        source=f"Reclasificación Manual: {old_cat} -> {new_cat}"
    )

    return get_current_consolidated_data()

@app.get("/api/export/excel")
def export_excel():
    schools = current_state["schools"]
    teachers = current_state["teachers"]
    if not schools:
        raise HTTPException(status_code=400, detail="No hay datos consolidados para exportar.")
    
    excel_content = generate_consolidated_excel(schools, teachers)
    return Response(
        content=excel_content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=consolidado_horas_aula_tecnicas_directivas.xlsx"
        }
    )

@app.get("/api/export/csv")
def export_csv():
    schools = current_state["schools"]
    if not schools:
        raise HTTPException(status_code=400, detail="No hay datos consolidados para exportar.")
    
    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow([
        "RBD",
        "ESTABLECIMIENTO",
        "MATRÍCULA",
        "HORAS DOCENTES AULA",
        "HORAS DOCENTES DIRECTIVAS",
        "HORAS DOCENTES TÉCNICAS",
        "TOTAL HORAS EE"
    ])
    for s in schools:
        writer.writerow([
            s.get("rbd", ""),
            s.get("establishment", ""),
            s.get("matricula", 0),
            s.get("horas_aula", 0.0),
            s.get("horas_directivas", 0.0),
            s.get("horas_tecnicas", 0.0),
            s.get("total_horas_ee", 0.0)
        ])
    
    csv_bytes = output.getvalue().encode("utf-8-sig")
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=consolidado_horas_aula_tecnicas_directivas.csv"
        }
    )

@app.get("/api/audit-log")
def get_audit_log(limit: int = 100):
    try:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT id, file_name, school_rbd, teacher_name, activity, hours, category, source, created_at
                FROM audit_log
                ORDER BY id DESC
                LIMIT ?
            """, (limit,))
            rows = [dict(r) for r in cur.fetchall()]
            return {"audit_log": rows}
    except Exception as e:
        return {"audit_log": [], "error": str(e)}

# Serve frontend build if dist folder exists
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")

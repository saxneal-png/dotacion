import urllib.request
import json

def test():
    # 1. Check prompt
    res = urllib.request.urlopen("http://127.0.0.1:8080/api/prompt")
    data = json.loads(res.read().decode("utf-8"))
    assert "AULA" in data["prompt"], "Prompt should contain AULA definition"
    assert "TECNICA" in data["prompt"], "Prompt should contain TECNICA definition"
    assert "DIRECTIVA" in data["prompt"], "Prompt should contain DIRECTIVA definition"
    assert "{activities_json}" in data["prompt"], "Prompt should contain {activities_json}"
    print(f"[OK] Prompt expuesto correctamente. Longitud: {len(data['prompt'])} caracteres.")

    # 2. Check clean initial state
    res = urllib.request.urlopen("http://127.0.0.1:8080/api/consolidated")
    state = json.loads(res.read().decode("utf-8"))
    assert len(state["schools"]) == 0, f"Expected 0 schools, got {len(state['schools'])}"
    assert len(state["teachers"]) == 0, f"Expected 0 teachers, got {len(state['teachers'])}"
    assert state["kpis"]["total_schools"] == 0, "KPI total_schools should be 0"
    print("[OK] ¡Datos demo borrados! Estado inicial 100% limpio: 0 establecimientos, 0 docentes.")

    # 3. Check clean audit log
    res = urllib.request.urlopen("http://127.0.0.1:8080/api/audit-log")
    audit = json.loads(res.read().decode("utf-8"))
    assert len(audit["audit_log"]) == 0, "Audit log should be clean"
    print("[OK] Registro de auditoría limpio (0 registros).")

    print("\n>>> ¡VERIFICACIÓN EXITOSA: PROMPT EXPUESTO Y DATOS DEMO BORRADOS! <<<")

if __name__ == "__main__":
    test()

import urllib.request
import json

def run_tests():
    # 1. Frontend check
    res = urllib.request.urlopen("http://127.0.0.1:8080/")
    html = res.read().decode("utf-8")
    assert "html" in html.lower(), "Frontend should return HTML"
    print("[OK] Frontend HTML served successfully.")

    # 2. Load samples
    req = urllib.request.Request("http://127.0.0.1:8080/api/load-samples", method="POST")
    res = urllib.request.urlopen(req)
    data = json.loads(res.read().decode("utf-8"))
    schools = data.get("schools", [])
    teachers = data.get("teachers", [])
    kpis = data.get("kpis", {})

    assert len(schools) == 4, f"Expected 4 schools, got {len(schools)}"
    assert len(teachers) > 0, "Expected teachers"
    print(f"[OK] Loaded {len(schools)} schools and {len(teachers)} teacher records.")
    print("KPIs:", kpis)

    for s in schools:
        print(f"   -> RBD {s['rbd']}: {s['establishment']} | Aula: {s['horas_aula']} | Dir: {s['horas_directivas']} | Tec: {s['horas_tecnicas']} | Total: {s['total_horas_ee']}")

    # 3. Export Excel
    res = urllib.request.urlopen("http://127.0.0.1:8080/api/export/excel")
    excel_bytes = res.read()
    assert len(excel_bytes) > 2000, "Excel export too small"
    print(f"[OK] Excel export returned {len(excel_bytes)} bytes.")

    # 4. Export CSV
    res = urllib.request.urlopen("http://127.0.0.1:8080/api/export/csv")
    csv_content = res.read().decode("utf-8-sig")
    lines = csv_content.strip().split("\n")
    assert len(lines) == 5, f"Expected 5 lines in CSV (header + 4 schools), got {len(lines)}"
    print(f"[OK] CSV export returned {len(lines)} lines.")

    # 5. Audit log
    res = urllib.request.urlopen("http://127.0.0.1:8080/api/audit-log")
    audit = json.loads(res.read().decode("utf-8"))
    assert len(audit["audit_log"]) > 0, "Audit log should have entries"
    print(f"[OK] Audit log contains {len(audit['audit_log'])} entries.")

    print("\n>>> ¡TODAS LAS PRUEBAS END-TO-END PASARON EXITOSAMENTE! <<<")

if __name__ == "__main__":
    run_tests()

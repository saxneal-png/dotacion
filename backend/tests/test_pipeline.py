import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.excel_parser import parse_excel_file
from app.classifier import classify_activity, classify_local
from app.exporter import generate_consolidated_excel

def test_samples():
    samples_dir = os.path.join(os.path.dirname(__file__), "..", "samples")
    files = [f for f in os.listdir(samples_dir) if f.endswith(".xlsx")]
    assert len(files) >= 4, f"Expected at least 4 sample files, found {len(files)}"

    schools_summary = []
    all_teachers = []

    for f in files:
        path = os.path.join(samples_dir, f)
        parsed = parse_excel_file(path, f)
        print(f"\n--- Probando: {f} ---")
        print(f"RBD: {parsed['rbd']}, Establecimiento: {parsed['establishment']}, Matrícula: {parsed['matricula']}")
        print(f"Total registros docentes: {len(parsed['teachers'])}")

        assert parsed["rbd"] != "", "RBD no debe estar vacío"
        assert parsed["establishment"] != "", "Establecimiento no debe estar vacío"
        assert len(parsed["teachers"]) > 0, "Debe haber registros docentes"

        h_aula = 0.0
        h_dir = 0.0
        h_tec = 0.0

        for t in parsed["teachers"]:
            cat, src = classify_activity(t["activity"])
            t["category"] = cat
            t["source"] = src
            t["rbd"] = parsed["rbd"]
            t["establishment"] = parsed["establishment"]
            all_teachers.append(t)

            if cat == "AULA":
                h_aula += t["hours"]
            elif cat == "DIRECTIVA":
                h_dir += t["hours"]
            elif cat == "TECNICA":
                h_tec += t["hours"]

        tot_ee = h_aula + h_dir + h_tec
        schools_summary.append({
            "rbd": parsed["rbd"],
            "establishment": parsed["establishment"],
            "matricula": parsed["matricula"],
            "horas_aula": h_aula,
            "horas_directivas": h_dir,
            "horas_tecnicas": h_tec,
            "total_horas_ee": tot_ee,
            "valid": True
        })

        print(f"Horas Aula: {h_aula:.1f} | Directivas: {h_dir:.1f} | Técnicas: {h_tec:.1f} | Total: {tot_ee:.1f}")

    excel_bytes = generate_consolidated_excel(schools_summary, all_teachers)
    assert len(excel_bytes) > 1000, "El archivo Excel generado debe ser válido y tener contenido"
    print(f"\n[OK] Generación de Excel consolidado exitosa ({len(excel_bytes)} bytes)")

if __name__ == "__main__":
    test_samples()

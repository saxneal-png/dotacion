import unittest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.classifier import classify_local
from app.exporter import generate_consolidated_excel
import io
import openpyxl

class TestAuditFixes(unittest.TestCase):
    def test_coord_pie_classification(self):
        # coord pie must be classified as TECNICA
        res = classify_local("coord pie basica")
        self.assertIsNotNone(res)
        self.assertEqual(res[0], "TECNICA")

        res2 = classify_local("coordinadora pie liceo")
        self.assertIsNotNone(res2)
        self.assertEqual(res2[0], "TECNICA")

        res3 = classify_local("encargada cra")
        self.assertIsNotNone(res3)
        self.assertEqual(res3[0], "TECNICA")

    def test_recreos_and_proportions_as_aula(self):
        # Recreos and 65/35 - 60/40 must be classified as AULA per Mineduc proportion rule
        for act in [
            "Recreo",
            "Recreos",
            "Recreo 65/35",
            "Recreos 65/35",
            "Recreo 60/40",
            "Horas No lectivas 65/35",
            "Horas no lectivas 60/40"
        ]:
            res = classify_local(act)
            self.assertIsNotNone(res, f"Failed for {act}")
            self.assertEqual(res[0], "AULA", f"Expected AULA for {act}, got {res[0]}")

        # Art. 69 must remain TECNICA
        res_art69 = classify_local("Tiempo Funciones no lectivas (artº 69)")
        self.assertIsNotNone(res_art69)
        self.assertEqual(res_art69[0], "TECNICA")

    def test_orientacion_rules(self):
        # Plain "Orientación" must be AULA (classroom curriculum hour)
        res1 = classify_local("Orientación")
        self.assertIsNotNone(res1)
        self.assertEqual(res1[0], "AULA")

        res2 = classify_local("Orientación Vocacional")
        self.assertIsNotNone(res2)
        self.assertEqual(res2[0], "AULA")

        res3 = classify_local("Consejo de Curso y Orientación")
        self.assertIsNotNone(res3)
        self.assertEqual(res3[0], "AULA")

        # "Orientador(a)" / "Encargada de Orientación" must be TECNICA (management/support role)
        res4 = classify_local("Orientador")
        self.assertIsNotNone(res4)
        self.assertEqual(res4[0], "TECNICA")

        res5 = classify_local("Orientadora Institucional")
        self.assertIsNotNone(res5)
        self.assertEqual(res5[0], "TECNICA")

        res6 = classify_local("Encargada de Orientación")
        self.assertIsNotNone(res6)
        self.assertEqual(res6[0], "TECNICA")

    def test_parvularia_axes(self):
        # Ejes de Educación Parvularia must be AULA
        for eje in [
            "Identidad y Autonomía",
            "Convivencia y Ciudadanía",
            "Corporalidad y Movimiento",
            "Lenguaje Verbal",
            "Lenguajes Artísticos",
            "Pensamiento Matemático",
            "Exploración del Entorno Natural",
            "Comprensión del Entorno Sociocultural",
            "Plan de Estudio Educación Parvularia"
        ]:
            res = classify_local(eje)
            self.assertIsNotNone(res, f"Failed for {eje}")
            self.assertEqual(res[0], "AULA", f"Failed for {eje}")

    def test_combined_roles(self):
        # Combined management roles
        res1 = classify_local("Apoyo UTP + PME")
        self.assertIsNotNone(res1)
        self.assertEqual(res1[0], "TECNICA")

        res2 = classify_local("Coordinación PAE")
        self.assertIsNotNone(res2)
        self.assertEqual(res2[0], "TECNICA")

        res3 = classify_local("Coord PAE")
        self.assertIsNotNone(res3)
        self.assertEqual(res3[0], "TECNICA")

    def test_export_empty_schools(self):
        # Should not raise exception and should produce valid excel
        excel_bytes = generate_consolidated_excel([], [])
        self.assertTrue(len(excel_bytes) > 0)
        
        wb = openpyxl.load_workbook(io.BytesIO(excel_bytes))
        ws = wb["Consolidado SLEP"]
        self.assertIsNotNone(ws)
        # Check totals row is present
        self.assertEqual(ws.cell(row=5, column=2).value, "TOTAL GENERAL SLEP")

    def test_reclassify_backend_logic(self):
        # Verify teacher reclassification calculation
        from app.main import current_state, reclassify_teacher, ReclassifyRequest
        current_state["schools"] = [{
            "rbd": "12345",
            "establishment": "Escuela Test",
            "matricula": 100,
            "horas_aula": 30.0,
            "horas_directivas": 0.0,
            "horas_tecnicas": 10.0,
            "total_horas_ee": 40.0,
            "teachers_count": 1,
            "has_discrepancy": False,
            "discrepancy_note": "",
            "source_file": "test.xlsx"
        }]
        current_state["teachers"] = [{
            "id": "12345_0_Docencia",
            "file_name": "test.xlsx",
            "rbd": "12345",
            "establishment": "Escuela Test",
            "teacher_name": "JUAN PEREZ",
            "rut": "12.345.678-9",
            "activity": "Docencia",
            "hours": 10.0,
            "category": "AULA",
            "source": "Local",
            "confidence": 1.0,
            "contract_hours": 10.0,
            "total_teacher_hours": 10.0,
            "is_over_legal_limit": False,
            "legal_limit_warning": ""
        }]

        # Reclassify by teacher_id
        req = ReclassifyRequest(teacher_id="12345_0_Docencia", new_category="TECNICA")
        res = reclassify_teacher(req)
        self.assertIn("schools", res)
        self.assertEqual(current_state["teachers"][0]["category"], "TECNICA")
        self.assertEqual(current_state["schools"][0]["horas_aula"], 20.0)
        self.assertEqual(current_state["schools"][0]["horas_tecnicas"], 20.0)

if __name__ == "__main__":
    unittest.main()

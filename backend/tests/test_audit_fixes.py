import unittest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.classifier import classify_local
from app.exporter import generate_consolidated_excel
from app.excel_parser import parse_excel_file
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

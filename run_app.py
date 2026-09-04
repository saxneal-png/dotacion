import os
import sys
import webbrowser
import subprocess
import time

def main():
    print("=" * 70)
    print("   ANALIZADOR DE DOTACIÓN DOCENTE SLEP - INICIALIZACIÓN")
    print("=" * 70)
    port = 8080
    print(f"\nIniciando servidor backend FastAPI en http://127.0.0.1:{port} ...")

    backend_dir = os.path.join(os.path.dirname(__file__), "backend")
    
    # Start uvicorn with reload enabled
    cmd = [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port), "--reload"]
    
    proc = subprocess.Popen(cmd, cwd=backend_dir)
    time.sleep(2)

    url = f"http://127.0.0.1:{port}"
    print(f"\nAplicación disponible en: {url}")
    print("Abriendo navegador web automáticamente...")
    try:
        webbrowser.open(url)
    except Exception:
        pass

    print("\nPresiona Ctrl+C para detener la aplicación.\n")
    try:
        proc.wait()
    except KeyboardInterrupt:
        print("\nDeteniendo servidor...")
        proc.terminate()

if __name__ == "__main__":
    main()

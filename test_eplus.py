import subprocess
import bim2sim
from pathlib import Path
from bim2sim import Project, ConsoleDecisionHandler, run_project
from bim2sim.utilities.types import IFCDomain

def run_energyplus_cli(idf_path, epw_path, ep_install_dir, output_dir):
    """Startet die EnergyPlus-Engine im Hintergrund via Kommandozeile."""
    ep_exe = Path(ep_install_dir) / "energyplus"
    
    print("\n" + "="*50)
    print("🚀 STARTE ENERGYPLUS SIMULATION (Jahresberechnung)...")
    print("="*50)
    
    # Der Kommandozeilen-Befehl für EnergyPlus
    command = [
        str(ep_exe),
        "-x",
        "-w", str(epw_path),   # Pfad zum Wetter
        "-d", str(output_dir), # Ausgabeverzeichnis
        str(idf_path)          # Die gepatchte IDF-Datei
    ]
    
    # Führt EnergyPlus aus und wartet auf das Ende
    result = subprocess.run(command, capture_output=True, text=True)
    
    # Erfolg prüfen
    if result.returncode == 0:
        print("✅ Simulation ERFOLGREICH beendet!")
        print("\n".join(result.stdout.strip().split("\n")[-4:]))
        print(f"\n📊 Dein 'Energiepass' (Ergebnisse) liegt hier:\n{output_dir}")
    else:
        print("❌ FEHLER bei der Simulation!")
        print(result.stderr)

def run_energyplus_test():
    """Wandelt die KIT ifc.ifc Datei in ein EnergyPlus Modell um und simuliert es."""
    
    current_dir = Path(__file__).parent
    
    # Permanenter Ordner für die Ergebnisse
    project_path = current_dir / "EnergyPlus_Ergebnisse"
    project_path.mkdir(exist_ok=True) 
    
    print(f"Die fertigen EnergyPlus Dateien landen DAUERHAFT hier: {project_path}")
    
    ifc_paths = {
        IFCDomain.arch: current_dir / 'KIT ifc.ifc', # Ändere das ggf. wieder auf deine IFC
    }

    project = Project.create(project_path, ifc_paths, 'EnergyPlus')

    # Zentrale Variablen für die Pfade (so müssen sie nur einmal definiert werden)
    weather_file = Path(bim2sim.__file__).parent.parent / 'test/resources/weather_files/DEU_NW_Aachen.105010_TMYx.epw'
    ep_install_dir = Path(r"C:\EnergyPlusV9-4-0")

    # sim_settings konfigurieren
    project.sim_settings.weather_file_path = weather_file
    project.sim_settings.ep_install_path = ep_install_dir
    project.sim_settings.setpoints_from_template = True
    project.sim_settings.run_simulation = True
    
    # 5. Konvertierung starten!
    print("Starte Konvertierung...")
    from bim2sim.kernel.decision.decisionhandler import DecisionHandler
    from bim2sim.kernel.decision import BoolDecision, RealDecision, ListDecision, StringDecision

    class AutoDecisionHandler(DecisionHandler):
        def get_answers_for_bunch(self, bunch):
            answers = []
            for decision in bunch:
                if getattr(decision, 'default', None) is not None:
                    answers.append(decision.default)
                    continue
                if isinstance(decision, BoolDecision):
                    answers.append(True)
                elif isinstance(decision, RealDecision):
                    if 'year_of_construction' in getattr(decision, 'global_key', '') or 'year' in getattr(decision, 'question', '').lower():
                        answers.append(2000.0)
                    else:
                        answers.append(0.0)
                elif isinstance(decision, ListDecision):
                    answers.append(decision.items[0] if decision.items else None)
                elif isinstance(decision, StringDecision):
                    answers.append("default")
                else:
                    answers.append(None)
            return answers

    run_project(project, AutoDecisionHandler())
    
    print("\nPasse SimulationControl automatisch an...")
    
    # Sucht die generierte .idf Datei
    idf_files = list(project_path.rglob("*.idf"))
        
    if idf_files:
        idf_path = idf_files[0]
            
        # Datei zeilenweise einlesen
        with open(idf_path, "r", encoding="utf-8") as file:
            lines = file.readlines()
                
        # Datei mit dem geänderten "Yes" wieder speichern
        with open(idf_path, "w", encoding="utf-8") as file:
            for line in lines:
                if "Run Simulation for Weather File" in line:
                    line = line.replace("No,", "Yes,").replace("No;", "Yes;").replace(" No ", " Yes ")
                    print("--> 'Run Simulation for Weather File' wurde auf 'Yes' gesetzt!")
                file.write(line)
                    
        print(f"✅ IDF-Datei erfolgreich für die Ganzjahressimulation gepatcht!")
        
        # === ENERGYPLUS SIMULATION DIREKT STARTEN ===
        final_results_dir = project_path / "Finale_Ergebnisse"
        final_results_dir.mkdir(exist_ok=True)
        
        run_energyplus_cli(
            idf_path=idf_path, 
            epw_path=weather_file, 
            ep_install_dir=ep_install_dir, 
            output_dir=final_results_dir
        )
        # ============================================

    else:
        print("❌ Keine .idf Datei zum Patchen gefunden.")

if __name__ == '__main__':
    run_energyplus_test()
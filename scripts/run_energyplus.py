#!/usr/bin/env python3
"""
EnergyPlus Simulation Runner for BIMCoach Studio.

Accepts command-line arguments for IFC path, output directory,
weather file, and EnergyPlus installation directory.

Usage:
  python run_energyplus.py <ifc_path> <output_dir> [--weather <epw_path>] [--ep-install <ep_dir>]

Outputs JSON to stdout on success:
  { "success": true, "csv_path": "...", "csv_content": "..." }

On error:
  { "success": false, "error": "..." }

All progress logging goes to stderr so stdout stays clean for JSON.
"""

import subprocess
import sys
import json
import os
import traceback
from pathlib import Path

def log(msg):
    """Log to stderr so stdout stays clean for JSON output."""
    sys.stderr.write(f"[run_energyplus] {msg}\n")
    sys.stderr.flush()

def find_bim2sim():
    """Try to import bim2sim, return None if not available."""
    try:
        import bim2sim
        from bim2sim import Project, ConsoleDecisionHandler, run_project
        from bim2sim.utilities.types import IFCDomain
        return bim2sim, Project, ConsoleDecisionHandler, run_project, IFCDomain
    except ImportError as e:
        log(f"bim2sim import failed: {e}")
        return None

def find_csv_files(search_dir):
    """Recursively search for EnergyPlus CSV result files."""
    search_dir = Path(search_dir)
    csv_files = []

    # Common EnergyPlus output CSV names (in order of preference)
    preferred_names = [
        "eplustbl.csv",
        "eplusout.csv",
    ]

    # First: search for preferred names recursively
    for name in preferred_names:
        found = list(search_dir.rglob(name))
        if found:
            csv_files.extend(found)

    # Second: any *tbl.csv or *Table.csv
    csv_files.extend(search_dir.rglob("*tbl.csv"))
    csv_files.extend(search_dir.rglob("*Table.csv"))

    # Third: any CSV in SimResults or results directories
    csv_files.extend(search_dir.rglob("SimResults/**/*.csv"))
    csv_files.extend(search_dir.rglob("results/**/*.csv"))

    # Deduplicate while preserving order
    seen = set()
    unique = []
    for f in csv_files:
        if f not in seen:
            seen.add(f)
            unique.append(f)

    return unique

def run_energyplus_cli(idf_path, epw_path, ep_install_dir, output_dir):
    """Run the EnergyPlus engine via command line.

    EnergyPlus 9.4 ExpandObjects (-x flag) fails when paths contain spaces.
    Workaround: copy the IDF into the output directory and run ExpandObjects
    separately, then run EnergyPlus on the expanded file without -x.
    """
    import shutil

    ep_exe = Path(ep_install_dir) / "energyplus"
    expand_exe = Path(ep_install_dir) / "ExpandObjects"

    if not ep_exe.exists() and not ep_exe.with_suffix('.exe').exists():
        log(f"EnergyPlus executable not found at: {ep_exe}")
        return False, f"EnergyPlus executable not found at: {ep_exe}"

    # Copy IDF into the output directory so ExpandObjects can work in-place
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    local_idf = output_dir / "in.idf"
    shutil.copy2(str(idf_path), str(local_idf))
    log(f"Copied IDF to output dir: {local_idf}")

    # Copy the IDD file as well (ExpandObjects needs it)
    idd_src = Path(ep_install_dir) / "Energy+.idd"
    idd_dst = output_dir / "Energy+.idd"
    if idd_src.exists() and not idd_dst.exists():
        shutil.copy2(str(idd_src), str(idd_dst))

    # Step 1: Run ExpandObjects in the output directory
    if expand_exe.exists() or expand_exe.with_suffix('.exe').exists():
        log("Running ExpandObjects separately...")
        expand_result = subprocess.run(
            [str(expand_exe)],
            capture_output=True, text=True, timeout=120,
            cwd=str(output_dir)
        )
        expanded_idf = output_dir / "expanded.idf"
        if expanded_idf.exists():
            log("ExpandObjects created expanded.idf — using it")
            local_idf = expanded_idf
        else:
            log(f"ExpandObjects ran (exit {expand_result.returncode}) but no expanded.idf found — using original IDF")
    else:
        log("ExpandObjects not found, skipping expand step")

    # Step 2: Run EnergyPlus without -x (already expanded)
    command = [
        str(ep_exe),
        "-w", str(epw_path),
        "-d", str(output_dir),
        str(local_idf)
    ]

    log(f"Running EnergyPlus CLI: {' '.join(command)}")
    result = subprocess.run(command, capture_output=True, text=True, timeout=300)

    if result.returncode != 0:
        log(f"EnergyPlus CLI failed (exit {result.returncode})")
        log(f"  stdout: {result.stdout[:500]}")
        log(f"  stderr: {result.stderr[:500]}")
        return False, f"EnergyPlus CLI failed (exit {result.returncode}): {result.stderr[:300]}"

    log("EnergyPlus CLI completed successfully")
    return True, None

def main():
    if len(sys.argv) < 3:
        output = {"success": False, "error": "Usage: run_energyplus.py <ifc_path> <output_dir> [--weather <epw>] [--ep-install <dir>]"}
        print(json.dumps(output))
        sys.exit(1)

    ifc_path = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])

    # Parse optional arguments
    weather_file = None
    # EnergyPlus install path: env var > CLI arg > platform default
    default_ep_path = os.environ.get('ENERGYPLUS_INSTALL_PATH')
    if default_ep_path:
        ep_install_dir = Path(default_ep_path)
    elif sys.platform == 'win32':
        ep_install_dir = Path(r"C:\EnergyPlusV9-4-0")
    else:
        ep_install_dir = Path("/usr/local/EnergyPlus-9-4-0")

    i = 3
    while i < len(sys.argv):
        if sys.argv[i] == "--weather" and i + 1 < len(sys.argv):
            weather_file = Path(sys.argv[i + 1])
            i += 2
        elif sys.argv[i] == "--ep-install" and i + 1 < len(sys.argv):
            ep_install_dir = Path(sys.argv[i + 1])
            i += 2
        else:
            i += 1

    log(f"IFC path: {ifc_path}")
    log(f"Output dir: {output_dir}")
    log(f"EP install dir: {ep_install_dir}")

    # Validate inputs
    if not ifc_path.exists():
        print(json.dumps({"success": False, "error": f"IFC file not found: {ifc_path}"}))
        sys.exit(1)

    if not ep_install_dir.exists():
        log(f"WARNING: EnergyPlus installation not found at: {ep_install_dir}")
        # Don't exit yet — bim2sim might handle the simulation itself

    try:
        # Import bim2sim
        bim2sim_modules = find_bim2sim()
        if bim2sim_modules is None:
            print(json.dumps({"success": False, "error": "bim2sim is not installed. Please install it with: pip install bim2sim"}))
            sys.exit(1)

        bim2sim, Project, ConsoleDecisionHandler, run_project, IFCDomain = bim2sim_modules
        log(f"bim2sim loaded from: {bim2sim.__file__}")

        # Default weather file from bim2sim test resources
        if weather_file is None:
            weather_file = Path(bim2sim.__file__).parent.parent / 'test/resources/weather_files/DEU_NW_Aachen.105010_TMYx.epw'

        log(f"Weather file: {weather_file}")
        if not weather_file.exists():
            print(json.dumps({"success": False, "error": f"Weather file not found: {weather_file}"}))
            sys.exit(1)

        # Create output directory
        output_dir.mkdir(parents=True, exist_ok=True)
        project_path = output_dir / "bim2sim_project"
        project_path.mkdir(exist_ok=True)

        # Configure bim2sim project
        ifc_paths = {
            IFCDomain.arch: ifc_path,
        }

        log("Creating bim2sim project...")
        project = Project.create(project_path, ifc_paths, 'EnergyPlus')
        project.sim_settings.weather_file_path = weather_file
        project.sim_settings.ep_install_path = ep_install_dir
        project.sim_settings.setpoints_from_template = True
        project.sim_settings.run_simulation = True

        # Define a custom AutoDecisionHandler that automatically answers all questions
        from bim2sim.kernel.decision.decisionhandler import DecisionHandler
        from bim2sim.kernel.decision import BoolDecision, RealDecision, ListDecision, StringDecision

        class AutoDecisionHandler(DecisionHandler):
            def get_answers_for_bunch(self, bunch):
                answers = []
                for decision in bunch:
                    # Provide default if available
                    if getattr(decision, 'default', None) is not None:
                        answers.append(decision.default)
                        continue
                    
                    # Otherwise, provide a sane fallback based on the decision type
                    if isinstance(decision, BoolDecision):
                        answers.append(True)
                    elif isinstance(decision, RealDecision):
                        # For year_of_construction, use 2000 as default fallback
                        if 'year_of_construction' in getattr(decision, 'global_key', '') or 'year' in getattr(decision, 'question', '').lower():
                            answers.append(2000.0)
                        else:
                            answers.append(0.0)
                    elif isinstance(decision, ListDecision):
                        # return the first option
                        answers.append(decision.items[0] if decision.items else None)
                    elif isinstance(decision, StringDecision):
                        answers.append("default")
                    else:
                        answers.append(None)
                return answers

        # Run conversion and simulation (IFC -> IDF -> EnergyPlus)
        # IMPORTANT: bim2sim/EnergyPlus writes progress to stdout, which
        # would corrupt our JSON output. Redirect stdout -> stderr during run.
        log("Starting bim2sim run_project (IFC -> IDF + simulation)...")
        real_stdout = sys.stdout
        sys.stdout = sys.stderr  # redirect all bim2sim/EnergyPlus stdout to stderr
        try:
            run_project(project, AutoDecisionHandler())
        finally:
            sys.stdout = real_stdout  # restore stdout for our JSON output
        log("bim2sim run_project completed!")

        # ==========================================
        # STEP 1: Find the IDF generated by bim2sim
        # ==========================================
        # NOTE: bim2sim only runs a design-day simulation (0 hours).
        # We MUST patch the IDF and run EnergyPlus again for a full
        # annual simulation (8760 hours) to get real energy data.
        log("Searching for IDF generated by bim2sim...")
        idf_files = list(project_path.rglob("*.idf"))
        log(f"Found {len(idf_files)} IDF file(s): {[str(f) for f in idf_files]}")

        if not idf_files:
            print(json.dumps({"success": False, "error": "No .idf file generated by bim2sim."}))
            sys.exit(1)

        idf_path = idf_files[0]
        log(f"Using IDF: {idf_path}")

        # ==========================================
        # STEP 2: Patch IDF for annual weather file simulation
        # ==========================================
        with open(idf_path, "r", encoding="utf-8") as f:
            idf_lines = f.readlines()

        patched = False
        with open(idf_path, "w", encoding="utf-8") as f:
            for line in idf_lines:
                if "Run Simulation for Weather File" in line:
                    line = line.replace("No,", "Yes,").replace("No;", "Yes;").replace(" No ", " Yes ")
                    patched = True
                f.write(line)

        log(f"IDF patched for annual simulation: {patched}")
        if not patched:
            log("WARNING: Could not find 'Run Simulation for Weather File' in IDF. Annual simulation may not run.")

        # ==========================================
        # STEP 3: Run EnergyPlus CLI for full annual simulation
        # ==========================================
        final_results_dir = output_dir / "annual_results"
        final_results_dir.mkdir(exist_ok=True)

        log("Starting EnergyPlus annual simulation...")
        success, error = run_energyplus_cli(
            idf_path=idf_path,
            epw_path=weather_file,
            ep_install_dir=ep_install_dir,
            output_dir=final_results_dir
        )

        if not success:
            log(f"EnergyPlus annual simulation failed: {error}")
            print(json.dumps({"success": False, "error": f"EnergyPlus annual simulation failed: {error}"}))
            sys.exit(1)

        log("EnergyPlus annual simulation completed!")
        csv_files = find_csv_files(final_results_dir)
        log(f"Found {len(csv_files)} CSV file(s) from annual simulation")

        # ==========================================
        # STEP 3: Read and return the CSV
        # ==========================================
        csv_path = None
        csv_content = None

        for candidate in csv_files:
            try:
                with open(candidate, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
                # Verify it looks like an EnergyPlus table output
                if "Site and Source Energy" in content or "Total Site Energy" in content or "End Uses" in content:
                    csv_path = candidate
                    csv_content = content
                    log(f"Using CSV (contains energy data): {candidate}")
                    break
                else:
                    log(f"Skipping CSV (no energy data): {candidate} (first 200 chars: {content[:200]})")
            except Exception as e:
                log(f"Error reading CSV {candidate}: {e}")

        # If none had energy data, use the first one
        if csv_content is None and csv_files:
            csv_path = csv_files[0]
            with open(csv_path, "r", encoding="utf-8", errors="replace") as f:
                csv_content = f.read()
            log(f"Fallback: using first CSV: {csv_path}")

        if csv_content is None:
            # Last resort: search the entire output directory
            all_csv = list(Path(output_dir).rglob("*.csv"))
            log(f"Last resort search found {len(all_csv)} CSV file(s) in entire output dir")
            if all_csv:
                csv_path = all_csv[0]
                with open(csv_path, "r", encoding="utf-8", errors="replace") as f:
                    csv_content = f.read()
                log(f"Using: {csv_path}")

        if csv_content:
            result = {
                "success": True,
                "csv_path": str(csv_path),
                "csv_content": csv_content,
                "results_dir": str(output_dir),
            }
            log(f"SUCCESS! CSV has {len(csv_content)} chars")
            print(json.dumps(result))
        else:
            print(json.dumps({
                "success": False,
                "error": "Simulation completed but no CSV output file found anywhere in the output directory."
            }))
            sys.exit(1)

    except Exception as e:
        error_str = traceback.format_exc()
        log(f"EXCEPTION: {error_str}")

        # Detect specific model quality issues and provide helpful messages
        user_error = str(e)
        error_code = "UNKNOWN"

        if "No buildings found" in error_str:
            error_code = "NO_BUILDING"
            user_error = (
                "Das IFC-Modell enthält kein erkennbares Gebäude (IfcBuilding). "
                "Bitte stellen Sie sicher, dass das Modell eine korrekte Gebäudehierarchie "
                "(IfcProject → IfcSite → IfcBuilding) enthält."
            )
        elif "No .idf file generated" in str(e):
            error_code = "NO_IDF"
            user_error = (
                "Die IFC-zu-IDF-Konvertierung ist fehlgeschlagen. Das Modell konnte nicht "
                "in ein EnergyPlus-Simulationsmodell umgewandelt werden. Mögliche Ursachen: "
                "fehlende Räume (IfcSpace), fehlende Space Boundaries oder unvollständige Geometrie."
            )
        elif "SpaceBoundary" in error_str and "0" in error_str:
            error_code = "NO_SPACE_BOUNDARIES"
            user_error = (
                "Das IFC-Modell enthält keine Space Boundaries (IfcRelSpaceBoundary). "
                "Für die Energiesimulation müssen 2nd Level Space Boundaries exportiert werden. "
                "Bitte aktivieren Sie den Space-Boundary-Export in Ihrer CAD-Software."
            )
        elif "EnrichMaterial" in error_str:
            error_code = "MATERIAL_ENRICHMENT_FAILED"
            user_error = (
                "Die Materialanreicherung ist fehlgeschlagen. Das Modell enthält möglicherweise "
                "keine ausreichenden Materialinformationen oder die Gebäudestruktur ist unvollständig. "
                "Prüfen Sie, ob alle Bauteile korrekte Materialzuweisungen haben."
            )
        elif "ZeroDivisionError" in error_str:
            error_code = "GEOMETRY_ERROR"
            user_error = (
                "Ein geometrischer Berechnungsfehler ist aufgetreten. Das Modell enthält "
                "möglicherweise ungültige Flächen oder Volumen (Nullwerte). "
                "Bitte überprüfen Sie die Modellgeometrie in Ihrer CAD-Software."
            )

        print(json.dumps({
            "success": False,
            "error": user_error,
            "errorCode": error_code,
        }))
        sys.exit(1)

if __name__ == '__main__':
    main()

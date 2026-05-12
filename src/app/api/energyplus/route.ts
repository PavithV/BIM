import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { writeFile, mkdir, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { auth } from '@/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { parseEnergyPlusCsv } from '@/utils/energyPlusParser';

/**
 * POST /api/energyplus
 *
 * Runs an EnergyPlus simulation for a given IFC project.
 *
 * Body: { projectId: string, fileStoragePath: string, useDemoData?: boolean }
 * Returns: { success: true, data: EnergyPassData } | { success: false, error: string }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Nicht authentifiziert' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { projectId, fileStoragePath, useDemoData } = body;

    if (useDemoData) {
      console.log('[EnergyPlus API] Demo data requested');
      return NextResponse.json({ success: true, data: getDemoData() });
    }

    if (!projectId || !fileStoragePath) {
      return NextResponse.json({ success: false, error: 'projectId and fileStoragePath are required' }, { status: 400 });
    }

    console.log(`[EnergyPlus API] Starting simulation for project: ${projectId}`);
    console.log(`[EnergyPlus API] Storage path: ${fileStoragePath}`);

    // Download IFC file from Supabase Storage
    console.log('[EnergyPlus API] Downloading IFC from Supabase...');
    const { data: blob, error: downloadError } = await supabaseAdmin.storage
      .from('ifc-models')
      .download(fileStoragePath);

    if (downloadError || !blob) {
      console.error('[EnergyPlus API] Download failed:', downloadError);
      return NextResponse.json({
        success: false,
        error: `Datei konnte nicht heruntergeladen werden: ${downloadError?.message || 'Unknown error'}`
      }, { status: 500 });
    }

    console.log(`[EnergyPlus API] IFC downloaded: ${blob.size} bytes`);

    // Save IFC to temp directory
    const tempDir = join(process.cwd(), '.energyplus-temp', projectId);
    await mkdir(tempDir, { recursive: true });

    const ifcPath = join(tempDir, 'model.ifc');
    const buffer = Buffer.from(await blob.arrayBuffer());
    await writeFile(ifcPath, buffer);
    console.log(`[EnergyPlus API] IFC saved to: ${ifcPath}`);

    const outputDir = join(tempDir, 'output');
    await mkdir(outputDir, { recursive: true });

    // Check if Python script exists
    const scriptPath = join(process.cwd(), 'scripts', 'run_energyplus.py');
    if (!existsSync(scriptPath)) {
      console.warn('[EnergyPlus API] Python script not found at:', scriptPath);
      await cleanupTemp(tempDir);
      return NextResponse.json({
        success: true,
        data: getDemoData(),
        note: 'Python-Skript nicht gefunden. Demo-Daten werden angezeigt.'
      });
    }

    // Run the Python script
    console.log('[EnergyPlus API] Starting Python script...');
    const startTime = Date.now();
    const result = await runPythonScript(scriptPath, ifcPath, outputDir);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[EnergyPlus API] Python script finished in ${elapsed}s`);
    console.log(`[EnergyPlus API] Script result success: ${result.success}`);

    if (!result.success) {
      console.error('[EnergyPlus API] Script error:', result.error);

      // If EnergyPlus/bim2sim not available, return demo data
      if (result.error?.includes('not installed') || result.error?.includes('not found')) {
        await cleanupTemp(tempDir);
        return NextResponse.json({
          success: true,
          data: getDemoData(),
          note: `EnergyPlus nicht verfügbar: ${result.error}. Demo-Daten werden angezeigt.`
        });
      }

      // Classify the error for user-friendly display
      const classified = classifySimulationError(result.error || '', result.stderr || '');
      await cleanupTemp(tempDir);
      return NextResponse.json({
        success: false,
        error: classified.message,
        errorCode: classified.code,
        errorHints: classified.hints,
      }, { status: 500 });
    }

    // Parse CSV content from the script output
    if (result.csv_content) {
      console.log(`[EnergyPlus API] Parsing CSV (${result.csv_content.length} chars) from script output`);

      // DEBUG: Save CSV to file for inspection
      const debugCsvPath = join(process.cwd(), 'debug_eplustbl.csv');
      await writeFile(debugCsvPath, result.csv_content, 'utf-8');
      console.log(`[EnergyPlus API] DEBUG: CSV saved to ${debugCsvPath}`);

      // DEBUG: Log first 30 lines that contain "Site" or "Source" or "End Use"
      const csvLines = result.csv_content.split('\n');
      console.log(`[EnergyPlus API] DEBUG: CSV has ${csvLines.length} lines total`);
      for (let i = 0; i < csvLines.length && i < 2000; i++) {
        const line = csvLines[i];
        if (line.includes('Site') || line.includes('Source') || line.includes('End Use') || line.includes('Total Energy')) {
          console.log(`[EnergyPlus API] CSV line ${i}: ${line.slice(0, 200)}`);
        }
      }

      try {
        const energyPassData = parseEnergyPlusCsv(result.csv_content);
        console.log('[EnergyPlus API] Parsed successfully:', JSON.stringify({
          siteEnergy: energyPassData.siteEnergy,
          efficiencyClass: energyPassData.efficiencyClass,
          endUsesCount: energyPassData.endUses.length,
        }));
        await cleanupTemp(tempDir);
        return NextResponse.json({ success: true, data: energyPassData });
      } catch (parseError: any) {
        console.error('[EnergyPlus API] CSV parse error:', parseError.message);
        console.error('[EnergyPlus API] CSV content preview:', result.csv_content.slice(0, 500));
        await cleanupTemp(tempDir);
        return NextResponse.json({
          success: false,
          error: `CSV konnte nicht geparst werden: ${parseError.message}`
        }, { status: 500 });
      }
    }

    // Fallback: try reading CSV from path
    if (result.csv_path && existsSync(result.csv_path)) {
      console.log('[EnergyPlus API] Reading CSV from file:', result.csv_path);
      const csvContent = await readFile(result.csv_path, 'utf-8');
      const energyPassData = parseEnergyPlusCsv(csvContent);
      await cleanupTemp(tempDir);
      return NextResponse.json({ success: true, data: energyPassData });
    }

    console.error('[EnergyPlus API] No CSV content or file found in script output');
    console.error('[EnergyPlus API] Full script result:', JSON.stringify(result).slice(0, 1000));
    await cleanupTemp(tempDir);
    return NextResponse.json({
      success: false,
      error: 'Simulation abgeschlossen, aber keine CSV-Ergebnisdatei gefunden.'
    }, { status: 500 });

  } catch (error: any) {
    console.error('[EnergyPlus API] Unhandled error:', error.message);
    console.error('[EnergyPlus API] Stack:', error.stack);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unbekannter Fehler bei der Simulation'
    }, { status: 500 });
  }
}

/**
 * Run the Python script as a subprocess and return the parsed JSON output.
 */
function runPythonScript(
  scriptPath: string,
  ifcPath: string,
  outputDir: string
): Promise<any> {
  return new Promise((resolve) => {
    // Use the specific Python environment that has bim2sim installed.
    // Configurable via PYTHON_BIM2SIM_PATH in .env
    const pythonCmd = process.env.PYTHON_BIM2SIM_PATH
      || (process.platform === 'win32'
          ? 'C:\\Users\\pavit\\micromamba\\envs\\bim2sim\\python.exe'
          : '/home/ubuntu/.local/share/mamba/envs/bim2sim/bin/python');

    console.log('[EnergyPlus API] Python executable:', pythonCmd);
    console.log('[EnergyPlus API] Script path:', scriptPath);
    console.log('[EnergyPlus API] IFC path:', ifcPath);
    console.log('[EnergyPlus API] Output dir:', outputDir);

    const child = spawn(pythonCmd, [scriptPath, ifcPath, outputDir], {
      cwd: process.cwd(),
      env: { ...process.env },
      timeout: 600000, // 10 minute timeout
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      // Stream stderr to console in real-time for progress monitoring
      process.stdout.write(chunk);
    });

    child.on('close', (code) => {
      console.log(`[EnergyPlus API] Python exited with code: ${code}`);
      console.log(`[EnergyPlus API] stdout length: ${stdout.length} chars`);
      console.log(`[EnergyPlus API] stderr length: ${stderr.length} chars`);

      if (stdout.length > 0) {
        // Show first 300 chars of stdout for debugging
        console.log(`[EnergyPlus API] stdout preview: ${stdout.slice(0, 300)}`);
      }

      try {
        const result = JSON.parse(stdout);
        result.stderr = stderr; // Attach for error classification
        resolve(result);
      } catch (parseErr) {
        // FALLBACK: EnergyPlus may have written to stdout before our JSON.
        // Try to extract the JSON object from the end of stdout.
        console.warn('[EnergyPlus API] Direct JSON.parse failed, trying to extract JSON from mixed output...');
        const jsonMatch = extractLastJson(stdout);
        if (jsonMatch) {
          console.log('[EnergyPlus API] Successfully extracted JSON from mixed stdout');
          jsonMatch.stderr = stderr; // Attach for error classification
          resolve(jsonMatch);
        } else {
          console.error('[EnergyPlus API] Could not find JSON in stdout');
          console.error('[EnergyPlus API] stdout (first 1000):', stdout.slice(0, 1000));
          console.error('[EnergyPlus API] stderr (last 500):', stderr.slice(-500));
          resolve({
            success: false,
            error: `Python-Ausgabe konnte nicht als JSON gelesen werden. Exit code: ${code}. Stdout: ${stdout.slice(0, 300)}. Stderr (Ende): ${stderr.slice(-300)}`,
            stderr,
          });
        }
      }
    });

    child.on('error', (err) => {
      console.error('[EnergyPlus API] Failed to start Python process:', err.message);
      resolve({
        success: false,
        error: `Python konnte nicht gestartet werden: ${err.message}. Stellen Sie sicher, dass Python installiert und erreichbar ist.`
      });
    });
  });
}

/**
 * Extract the last valid JSON object from a string that may contain
 * mixed text (e.g. EnergyPlus progress output + our JSON on stdout).
 */
function extractLastJson(text: string): any | null {
  // Search backwards for the last '{' that could start a JSON object
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === '{') {
      const candidate = text.slice(i);
      try {
        return JSON.parse(candidate);
      } catch {
        // Not valid JSON from this position, keep searching
      }
    }
  }
  return null;
}

async function cleanupTemp(dir: string) {
  try {
    console.log('[EnergyPlus API] Cleaning up temp dir:', dir);
    await rm(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Classify simulation errors into user-friendly messages with hints.
 */
function classifySimulationError(
  error: string,
  stderr: string
): { code: string; message: string; hints: string[] } {
  const combined = `${error}\n${stderr}`;

  if (combined.includes('No buildings found') || (combined.includes('No .idf file generated') && combined.includes('EnrichMaterial'))) {
    return {
      code: 'MODEL_INCOMPLETE',
      message: 'Das IFC-Modell ist nicht für die Energiesimulation geeignet.',
      hints: [
        'Das Modell enthält kein erkennbares Gebäude (IfcBuilding) oder keine Räume (IfcSpace).',
        'Für die Energiesimulation werden 2nd Level Space Boundaries benötigt.',
        'Bitte exportieren Sie das Modell mit aktiviertem Space-Boundary-Export aus Ihrer CAD-Software.',
        'Unterstützt werden Modelle aus Revit, ArchiCAD und Allplan mit korrekter Raummodellierung.',
      ],
    };
  }

  if (combined.includes('No .idf file generated')) {
    return {
      code: 'NO_IDF',
      message: 'Die IFC-zu-IDF-Konvertierung ist fehlgeschlagen.',
      hints: [
        'Das Modell konnte nicht in ein EnergyPlus-Simulationsmodell umgewandelt werden.',
        'Mögliche Ursachen: fehlende Räume, fehlende Space Boundaries oder unvollständige Geometrie.',
        'Prüfen Sie, ob das Modell IfcSpace-Elemente und Materialzuweisungen enthält.',
      ],
    };
  }

  if (combined.includes('EnrichMaterial')) {
    return {
      code: 'MATERIAL_ERROR',
      message: 'Die Materialinformationen im Modell sind unvollständig.',
      hints: [
        'Die Materialanreicherung konnte nicht durchgeführt werden.',
        'Stellen Sie sicher, dass alle Bauteile korrekte Materialzuweisungen haben.',
        'Wände, Decken und Fenster benötigen vollständige Schichtaufbauten.',
      ],
    };
  }

  if (combined.includes('EnergyPlus CLI failed') || combined.includes('EnergyPlus Terminated')) {
    return {
      code: 'SIMULATION_CRASHED',
      message: 'Die EnergyPlus-Simulation ist fehlgeschlagen.',
      hints: [
        'Die Geometrie des Modells konnte möglicherweise nicht korrekt verarbeitet werden.',
        'Überprüfen Sie, ob das Modell konsistente Geometrie und geschlossene Räume enthält.',
        'Versuchen Sie, das Modell in der CAD-Software zu bereinigen und erneut zu exportieren.',
      ],
    };
  }

  // Generic fallback
  return {
    code: 'UNKNOWN',
    message: error || 'Ein unbekannter Fehler ist bei der Simulation aufgetreten.',
    hints: [
      'Bitte überprüfen Sie, ob EnergyPlus korrekt installiert ist.',
      'Stellen Sie sicher, dass das IFC-Modell gültig und vollständig ist.',
    ],
  };
}

/**
 * Demo data for UI development and testing when EnergyPlus is not installed.
 */
function getDemoData() {
  return {
    siteEnergy: { total: 21958.22, perArea: 105.29 },
    sourceEnergy: { total: 73280.96, perArea: 351.39 },
    endUses: [
      { category: 'Heizung', value: 12450.30 },
      { category: 'Kühlung', value: 3210.55 },
      { category: 'Beleuchtung (innen)', value: 2890.12 },
      { category: 'Geräte (innen)', value: 1845.60 },
      { category: 'Lüftung', value: 980.40 },
      { category: 'Warmwasser', value: 421.25 },
      { category: 'Pumpen', value: 160.00 },
    ],
    buildingInfo: {
      name: 'Gebäude',
      area: 208.55,
      environment: 'Aachen NW DEU ISD-TMYx',
    },
    efficiencyClass: 'D',
  };
}

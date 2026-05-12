/**
 * Parser for EnergyPlus CSV output files (eplustbl.csv).
 * Extracts the "Annual Building Utility Performance Summary" data
 * and maps it to the EnergyPassData interface.
 *
 * IMPORTANT: EnergyPlus CSV data rows have an EMPTY first column, so:
 *   ",Total Site Energy,21958.22,105.29,105.29"
 * splits to: ["", "Total Site Energy", "21958.22", "105.29", "105.29"]
 *
 * End Uses rows also start with an empty first column:
 *   ",Heating,0.00,12450.30,0.00,...,12450.30"
 * Values are split across fuel columns and need to be summed.
 */

import type { EnergyPassData, EnergyEfficiencyClass, EnergyEndUse } from '@/lib/types';

/**
 * Determines the German energy efficiency class based on
 * primary energy demand in kWh/(m²·a) according to GEG/EnEV thresholds.
 */
export function getEfficiencyClass(kwhPerM2: number): EnergyEfficiencyClass {
  if (kwhPerM2 <= 30)  return 'A+';
  if (kwhPerM2 <= 50)  return 'A';
  if (kwhPerM2 <= 75)  return 'B';
  if (kwhPerM2 <= 100) return 'C';
  if (kwhPerM2 <= 130) return 'D';
  if (kwhPerM2 <= 160) return 'E';
  if (kwhPerM2 <= 200) return 'F';
  if (kwhPerM2 <= 250) return 'G';
  return 'H';
}

/** Known EnergyPlus end-use categories (English) → German labels */
const END_USE_LABELS: Record<string, string> = {
  'Heating': 'Heizung',
  'Cooling': 'Kühlung',
  'Interior Lighting': 'Beleuchtung (innen)',
  'Exterior Lighting': 'Beleuchtung (außen)',
  'Interior Equipment': 'Geräte (innen)',
  'Exterior Equipment': 'Geräte (außen)',
  'Fans': 'Lüftung',
  'Pumps': 'Pumpen',
  'Heat Rejection': 'Wärmeabfuhr',
  'Humidification': 'Befeuchtung',
  'Heat Recovery': 'Wärmerückgewinnung',
  'Water Systems': 'Warmwasser',
  'Refrigeration': 'Kälte',
  'Generators': 'Generatoren',
};

/**
 * Split a CSV line, respecting that data rows often start with a comma
 * (empty first field). Returns trimmed parts.
 */
function splitCsvLine(line: string): string[] {
  return line.split(',').map(p => p.trim());
}

/**
 * Sum all numeric values in a parts array starting from a given index.
 * Skips non-numeric entries.
 */
function sumNumericParts(parts: string[], startIdx: number): number {
  let sum = 0;
  for (let i = startIdx; i < parts.length; i++) {
    const val = parseFloat(parts[i]);
    if (!isNaN(val)) sum += val;
  }
  return sum;
}

/**
 * Parse the EnergyPlus CSV (tbl.csv) output into structured EnergyPassData.
 */
export function parseEnergyPlusCsv(csvContent: string): EnergyPassData {
  const lines = csvContent.split(/\r?\n/);

  // --- Extract building info ---
  let buildingName = 'Gebäude';
  let environment = '';

  for (const line of lines) {
    if (line.startsWith('Building:,')) {
      const name = line.split(',')[1]?.trim();
      if (name && name !== 'None' && name !== '') buildingName = name;
    }
    if (line.startsWith('Environment:,')) {
      const envRaw = line.split(',').slice(1).join(',').trim();
      const envMatch = envRaw.match(/\*\*\s*(.+?)(?:\s+WMO|$)/);
      environment = envMatch ? envMatch[1].trim() : envRaw;
    }
  }

  // --- Extract Site and Source Energy ---
  // The section looks like:
  //   Site and Source Energy
  //   (header row)
  //   ,Total Site Energy,21958.22,105.29,105.29
  //   ,Net Site Energy,...
  //   ,Total Source Energy,...
  let siteEnergyTotal = 0;
  let siteEnergyPerArea = 0;
  let sourceEnergyTotal = 0;
  let sourceEnergyPerArea = 0;
  let buildingArea = 0;

  let inSiteSourceSection = false;
  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.includes('Site and Source Energy')) {
      inSiteSourceSection = true;
      continue;
    }

    if (inSiteSourceSection) {
      // Section ends at a dashed line or next REPORT:
      if (trimmed.startsWith('---') || trimmed.startsWith('REPORT:')) {
        inSiteSourceSection = false;
        continue;
      }

      const parts = splitCsvLine(line);

      // Find the label — it could be in parts[0] or parts[1] (when first col is empty)
      const labelIdx = parts[0] === '' ? 1 : 0;
      const label = parts[labelIdx];
      const valStartIdx = labelIdx + 1;

      if (label === 'Total Site Energy' && parts.length > valStartIdx + 1) {
        siteEnergyTotal = parseFloat(parts[valStartIdx]) || 0;
        siteEnergyPerArea = parseFloat(parts[valStartIdx + 1]) || 0;
        if (siteEnergyPerArea > 0) {
          buildingArea = siteEnergyTotal / siteEnergyPerArea;
        }
      }
      if (label === 'Total Source Energy' && parts.length > valStartIdx + 1) {
        sourceEnergyTotal = parseFloat(parts[valStartIdx]) || 0;
        sourceEnergyPerArea = parseFloat(parts[valStartIdx + 1]) || 0;
      }
    }
  }

  // --- Extract End Uses ---
  // The End Uses table has multiple fuel columns:
  //   ,,Electricity [kWh],Natural Gas [kWh],...
  //   ,Heating,0.00,12345.67,...
  //   ,Cooling,3456.78,0.00,...
  //   ,...
  // We sum all fuel columns per end-use category.
  const endUses: EnergyEndUse[] = [];
  let inEndUseSection = false;
  let endUseDataStarted = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Look for "End Uses" section — but NOT "End Uses by Subcategory"
    if (trimmed.includes('End Uses') && !trimmed.includes('End Uses by Subcategory') && !inEndUseSection) {
      inEndUseSection = true;
      endUseDataStarted = false;
      continue;
    }

    if (inEndUseSection) {
      // Section ends at dashed line or new REPORT
      if (trimmed.startsWith('---') || (trimmed.startsWith('REPORT:') && endUseDataStarted)) {
        inEndUseSection = false;
        continue;
      }

      const parts = splitCsvLine(line);

      // Skip completely empty lines
      if (parts.every(p => p === '')) continue;

      // Find the label position
      const labelIdx = parts[0] === '' ? 1 : 0;
      const label = parts[labelIdx];

      // Skip header rows (contain [kWh], [GJ], or column labels)
      if (!label || label.includes('[') || label.includes(']')) {
        endUseDataStarted = true;
        continue;
      }

      // Skip "Total End Uses" summary row
      if (label === 'Total End Uses') continue;

      // Check if this looks like an end-use category
      const knownCategory = Object.keys(END_USE_LABELS).includes(label);
      if (!knownCategory && !label.match(/^[A-Z]/)) continue;

      // Sum all numeric values after the label
      const totalValue = sumNumericParts(parts, labelIdx + 1);

      if (totalValue > 0) {
        endUseDataStarted = true;
        endUses.push({
          category: END_USE_LABELS[label] || label,
          value: totalValue,
        });
      }
    }
  }

  // If no end uses found but we have site energy, create a fallback
  if (endUses.length === 0 && siteEnergyTotal > 0) {
    endUses.push({ category: 'Gesamtenergie', value: siteEnergyTotal });
  }

  // Determine efficiency class based on source energy per area
  const efficiencyClass = getEfficiencyClass(siteEnergyPerArea);

  // Log parsed values for debugging
  console.log('[EnergyPlus Parser] Site Energy:', siteEnergyTotal, 'kWh, per m²:', siteEnergyPerArea);
  console.log('[EnergyPlus Parser] Source Energy:', sourceEnergyTotal, 'kWh, per m²:', sourceEnergyPerArea);
  console.log('[EnergyPlus Parser] Building area:', buildingArea, 'm²');
  console.log('[EnergyPlus Parser] End uses:', endUses.length, 'categories');
  console.log('[EnergyPlus Parser] Efficiency class:', efficiencyClass);

  return {
    siteEnergy: {
      total: Math.round(siteEnergyTotal * 100) / 100,
      perArea: Math.round(siteEnergyPerArea * 100) / 100,
    },
    sourceEnergy: {
      total: Math.round(sourceEnergyTotal * 100) / 100,
      perArea: Math.round(sourceEnergyPerArea * 100) / 100,
    },
    endUses: endUses.map(eu => ({
      ...eu,
      value: Math.round(eu.value * 100) / 100,
    })),
    buildingInfo: {
      name: buildingName,
      area: Math.round(buildingArea * 100) / 100,
      environment,
    },
    efficiencyClass,
  };
}

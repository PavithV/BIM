/**
 * Quick test for the EnergyPlus CSV parser
 * Run: npx tsx scripts/test-parser.ts
 */

// Simulate the exact CSV format from a real EnergyPlus eplustbl.csv
const sampleCsv = `Program Version:,EnergyPlus, Version 9.4.0-998c4b761e, YMD=2026.04.30 08:59
Tabular Output Report in Format: ,Comma

Building:,None
Environment:,RUN PERIOD 1 ** Aachen NW DEU ISD-TMYx WMO#=105010

----------------------------------------------------------------------------------------------------
REPORT:,Annual Building Utility Performance Summary
FOR:,Entire Facility
Values gathered over      8760.00 hours

Site and Source Energy

,,Total Energy [kWh],Energy Per Total Building Area [kWh/m2],Energy Per Conditioned Building Area [kWh/m2]
,Total Site Energy,21958.22,105.29,105.29
,Net Site Energy,21958.22,105.29,105.29
,Total Source Energy,73280.96,351.39,351.39
,Net Source Energy,73280.96,351.39,351.39

----------------------------------------------------------------------------------------------------

End Uses

,,Electricity [kWh],Natural Gas [kWh],Gasoline [kWh],Diesel [kWh],Coal [kWh],Fuel Oil No 1 [kWh],Fuel Oil No 2 [kWh],Propane [kWh],Other Fuel 1 [kWh],Other Fuel 2 [kWh],District Cooling [kWh],District Heating [kWh],Steam [kWh]
,Heating,0.00,12450.30,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00
,Cooling,3210.55,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00
,Interior Lighting,2890.12,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00
,Interior Equipment,1845.60,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00
,Fans,980.40,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00
,Pumps,160.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00
,Water Systems,421.25,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00

----------------------------------------------------------------------------------------------------
REPORT:,Some Other Report
`;

// Import parser dynamically
import { parseEnergyPlusCsv, getEfficiencyClass } from '../src/utils/energyPlusParser';

const result = parseEnergyPlusCsv(sampleCsv);

console.log('\n=== PARSER TEST RESULTS ===\n');
console.log('Site Energy:');
console.log('  Total:', result.siteEnergy.total, 'kWh');
console.log('  Per m²:', result.siteEnergy.perArea, 'kWh/m²');
console.log('\nSource Energy:');
console.log('  Total:', result.sourceEnergy.total, 'kWh');
console.log('  Per m²:', result.sourceEnergy.perArea, 'kWh/m²');
console.log('\nBuilding:');
console.log('  Name:', result.buildingInfo.name);
console.log('  Area:', result.buildingInfo.area, 'm²');
console.log('  Environment:', result.buildingInfo.environment);
console.log('\nEfficiency Class:', result.efficiencyClass);
console.log('\nEnd Uses:');
for (const eu of result.endUses) {
  console.log(`  ${eu.category}: ${eu.value} kWh`);
}

// Assertions
let passed = 0;
let failed = 0;
function assert(name: string, condition: boolean) {
  if (condition) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.error(`  ❌ ${name}`); }
}

console.log('\n=== ASSERTIONS ===\n');
assert('siteEnergy.total = 21958.22', result.siteEnergy.total === 21958.22);
assert('siteEnergy.perArea = 105.29', result.siteEnergy.perArea === 105.29);
assert('sourceEnergy.total = 73280.96', result.sourceEnergy.total === 73280.96);
assert('sourceEnergy.perArea = 351.39', result.sourceEnergy.perArea === 351.39);
assert('buildingInfo.area ≈ 208.55', Math.abs(result.buildingInfo.area - 208.55) < 1);
assert('efficiencyClass = H', result.efficiencyClass === 'H');
assert('endUses has 7 items', result.endUses.length === 7);
assert('Heizung = 12450.30', result.endUses.find(e => e.category === 'Heizung')?.value === 12450.3);
assert('Kühlung = 3210.55', result.endUses.find(e => e.category === 'Kühlung')?.value === 3210.55);

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

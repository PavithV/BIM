export const BKI_COSTS: Record<string, { name: string, unit: 'm2' | 'm3', pricePerUnit: number }> = {
    "310": { name: "Baugrube / Erdbau", unit: "m3", pricePerUnit: 70 },
    "320": { name: "Gründung, Unterbau", unit: "m2", pricePerUnit: 342 },
    "330": { name: "Außenwände", unit: "m2", pricePerUnit: 518 },
    "334": { name: "Außentüren und -fenster", unit: "m2", pricePerUnit: 650 }, // Schätzwert als Fallback
    "340": { name: "Innenwände", unit: "m2", pricePerUnit: 250 },
    "344": { name: "Innentüren und -fenster", unit: "m2", pricePerUnit: 400 }, // Schätzwert als Fallback
    "350": { name: "Decken", unit: "m2", pricePerUnit: 487 },
    "360": { name: "Dächer", unit: "m2", pricePerUnit: 522 },
    "370": { name: "Baukonstruktive Einbauten", unit: "m2", pricePerUnit: 150 }, // Fallback
    "390": { name: "Sonstige Maßnahmen", unit: "m2", pricePerUnit: 100 }
};

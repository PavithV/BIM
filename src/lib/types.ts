import { z } from 'zod';

// Cost Estimation Schemas
export const EstimatedCostSchema = z.object({
  name: z.string().describe('Der Name des Materials.'),
  percentage: z.number().describe('Der prozentuale Anteil am Gesamtvolumen.'),
  estimatedCost: z.string().describe('Die geschätzten Kosten für dieses Material als formatierter String (z.B. "€1,200,000").'),
  explanation: z.string().describe('Eine kurze Erklärung, wie die Kosten geschätzt wurden.'),
});

export const CostEstimationResultSchema = z.object({
  totalEstimatedCost: z.string().describe('Die geschätzten Gesamtkosten als formatierter String.'),
  materials: z.array(EstimatedCostSchema),
});

export const MaterialCompositionInputSchema = z.object({
  materials: z.array(z.object({
    name: z.string(),
    value: z.number().describe('Der prozentuale Anteil des Materials.'),
  })),
  totalBuildingArea: z.number().describe('Die Bruttogeschossfläche (BGF) des Gebäudes in Quadratmetern.')
});

export type MaterialCompositionInput = z.infer<typeof MaterialCompositionInputSchema>;

export type CostEstimationResult = z.infer<typeof CostEstimationResultSchema>;

export type IFCModel = {
  id: string;
  userId: string;
  fileName: string;
  fileSize: number;
  fileContent?: string | null; // Optional: may be null for large files stored in Storage
  fileUrl?: string | null; // URL to file in Firebase Storage for large files
  fileStoragePath?: string | null; // Storage path for direct access via Storage SDK (more reliable than URL extraction)
  uploadDate: any;
  analysisData?: AnalysisResult | null;
  costEstimationData?: CostEstimationResult | null; // New field for cost data
  replacements?: Record<string, string> | null; // Persisted material replacements
};

// Zod Schema for validation
const IndicatorSchema = z.object({
  name: z.string(),
  value: z.string(),
  unit: z.string(),
  a: z.string(),
  rating: z.enum(['low', 'medium', 'high']),
});

const MaterialCompositionSchema = z.object({
  name: z.string(),
  value: z.number(),
  fill: z.string(),
});

export const AnalysisResultSchema = z.object({
  summary: z.string(),
  indicators: z.array(IndicatorSchema),
  materialComposition: z.array(MaterialCompositionSchema),
});

// TypeScript type inferred from the schema
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export const GenerateAnalysisFromIfcInputSchema = z.object({
  ifcFileContent: z.string().describe('The full text content of the IFC model file.'),
});
export type GenerateAnalysisFromIfcInput = z.infer<typeof GenerateAnalysisFromIfcInputSchema>;

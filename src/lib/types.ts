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

export type CostEstimationResult = z.infer<typeof CostEstimationResultSchema>;

export type IFCModel = {
  id: string;
  userId: string;
  fileName: string;
  fileSize: number;
  fileContent: string;
  uploadDate: any;
  analysisData?: AnalysisResult | null;
  costEstimationData?: CostEstimationResult | null; // New field for cost data
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

import { z } from 'zod';

export type IFCModel = {
  id: string;
  userId: string;
  fileName: string;
  fileSize: number;
  fileContent: string;
  uploadDate: any;
  analysisData?: AnalysisResult | null;
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

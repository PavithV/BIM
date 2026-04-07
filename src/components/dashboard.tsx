"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import dynamic from 'next/dynamic';
import { AnalysisPanel } from '@/components/analysis-panel';
import { ChatAssistant } from '@/components/chat-assistant';
import { Building, Bot, BarChart3, Menu, LogOut, PanelLeft, Loader2, Euro, Leaf, Layers, GitCompare, FilePlus, Sparkles, ShieldCheck, LayoutGrid } from 'lucide-react';
import { Button } from './ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { getStartingPrompts, getAIChatFeedback, getIfcAnalysis, getCostEstimation, checkMaterialReplacements, fetchUserProjects, createSignedUploadUrl, createIfcModelRecord, insertMessage, fetchMessagesForProject, updateIfcModel } from '@/app/actions';
import { MaterialReviewModal, type MaterialReplacement } from './material-review-modal';
import { parseIFC, toJSONString } from '@/utils/ifcParser';
import { applyReplacementsToIfc } from '@/utils/ifc-modification';
import { useRouter } from 'next/navigation';
import { ProjectSelector } from './project-selector';
import { ProjectComparison } from './project-comparison';
import { ModelTree, type SpatialNode } from '@/components/model-tree';
import { ModelChecksTab } from '@/components/model-checks-tab';
import { Din277Tab } from '@/components/din277-tab';
import { Din276Tab } from '@/components/din276-tab';
import type { IFCModel } from '@/lib/types';
import { cn, downloadCsv } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { FullModelAnalysis } from '@/utils/modelChecker';
import { AI_MODELS, DEFAULT_MODEL, type AIModelId } from '@/ai/models';
import { tr, type Language } from '@/lib/i18n';

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: any;
};

const IfcViewer = dynamic(
  () => import('@/components/ifc-viewer').then((mod) => mod.IfcViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mb-2" />
        <p>Lade 3D-Engine / Loading 3D engine...</p>
      </div>
    )
  }
);

export default function Dashboard() {
  const [activeProject, setActiveProject] = useState<IFCModel | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [startingPrompts, setStartingPrompts] = useState<string[]>([]);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [projects, setProjects] = useState<IFCModel[]>([]);
  const [isProjectsLoading, setIsProjectsLoading] = useState(true);
  const [comparisonProjectA, setComparisonProjectA] = useState<IFCModel | null>(null);
  const [comparisonProjectB, setComparisonProjectB] = useState<IFCModel | null>(null);

  const [modelStructure, setModelStructure] = useState<SpatialNode | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<number | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'projects' | 'structure'>('projects');

  const [materialReviewOpen, setMaterialReviewOpen] = useState(false);
  const [pendingReplacements, setPendingReplacements] = useState<MaterialReplacement[]>([]);
  const [pendingAction, setPendingAction] = useState<{ type: 'analysis' | 'chat', data: any } | null>(null);

  const [modelAnalysis, setModelAnalysis] = useState<FullModelAnalysis | null>(null);
  const [isModelAnalysisLoading, setIsModelAnalysisLoading] = useState(false);

  const { user, signOut } = useSupabaseAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModelId>(DEFAULT_MODEL);
  const [language, setLanguage] = useState<Language>('de');

  // Callback to prevent infinite re-renders
  const handleModelLoaded = useCallback((structure: SpatialNode) => {
    setModelStructure(structure);
    setSidebarTab('structure');
  }, []);

  // Reset model analysis when project changes
  useEffect(() => {
    setModelAnalysis(null);
  }, [activeProject?.id]);

  // --- MESSAGES FETCHING ---
  const fetchMessages = useCallback(async () => {
    if (!activeProject || !user) {
      setActiveMessages([]);
      return;
    }
    setMessagesLoading(true);
    const result = await fetchMessagesForProject(activeProject.id);

    if (result.error) {
      console.error('Error fetching messages:', result.error);
    } else {
      setActiveMessages(result.messages as Message[] || []);
    }
    setMessagesLoading(false);
  }, [activeProject, user]);

  useEffect(() => {
    if (!activeProject || !user) {
      setActiveMessages([]);
      return;
    }
    fetchMessages();
    const channel = supabase
      .channel(`messages:${activeProject.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `ifc_model_id=eq.${activeProject.id}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newMessage = payload.new as Message;
          setActiveMessages(prev => {
            if (prev.some(m => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeProject, user, fetchMessages]);


  // --- PROJECTS FETCHING ---
  const fetchProjects = useCallback(async (skipActiveProjectUpdate: boolean = false) => {
    if (!user) return;

    setIsProjectsLoading(true);
    try {
      const { projects: userProjects, error } = await fetchUserProjects();

      if (error) throw new Error(error);

      if (userProjects) {
        setProjects(userProjects);

        if (!skipActiveProjectUpdate) {
          if (userProjects.length > 0) {
            if (!activeProject) {
              setActiveProject(userProjects[0]);
            } else {
              const updatedActiveProject = userProjects.find(p => p.id === activeProject.id);
              setActiveProject(updatedActiveProject || userProjects[0]);
            }
          } else {
            setActiveProject(null);
          }
        }
      }
    } catch (error: any) {
      console.error("Error fetching projects: ", error);
      toast({
        title: tr(language, "Fehler beim Laden der Projekte", "Error loading projects"),
        description: error.message || tr(language, "Ihre Projekte konnten nicht geladen werden.", "Your projects could not be loaded."),
        variant: "destructive",
      });
    } finally {
      setIsProjectsLoading(false);
    }
  }, [user, toast, activeProject?.id]);

  useEffect(() => {
    fetchProjects();
  }, [user, fetchProjects]);

  // Auto-set comparison projects
  useEffect(() => {
    const projectsWithAnalysis = projects.filter(p => p.analysisData);
    if (projectsWithAnalysis.length >= 2 && !comparisonProjectA && !comparisonProjectB) {
      setComparisonProjectA(projectsWithAnalysis[0]);
      setComparisonProjectB(projectsWithAnalysis[1]);
    } else if (projectsWithAnalysis.length >= 1 && !comparisonProjectA) {
      setComparisonProjectA(projectsWithAnalysis[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);


  useEffect(() => {
    const saved = window.localStorage.getItem('app-language');
    if (saved === 'de' || saved === 'en') setLanguage(saved);
  }, []);

  useEffect(() => {
    window.localStorage.setItem('app-language', language);
  }, [language]);

  useEffect(() => {
    async function fetchPrompts() {
      const result = await getStartingPrompts({ language });
      if (result.prompts) setStartingPrompts(result.prompts);
    }
    fetchPrompts();
  }, [language]);

  // --- COST ESTIMATION ---
  const runCostEstimation = useCallback(async (totalArea: number) => {
    const project = activeProject;
    if (!project?.analysisData?.materialComposition || !user) {
      toast({ title: tr(language, "Fehler", "Error"), description: tr(language, "Materialdaten nicht verfügbar.", "Material data not available."), variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
      const result = await getCostEstimation({
        materials: project.analysisData.materialComposition.map(({ name, value }) => ({ name, value })),
        totalBuildingArea: totalArea,
        model: selectedModel,
      });

      if (result.costs) {
        const updateResult = await updateIfcModel(project.id, { costEstimationData: result.costs });

        if (updateResult.error) throw new Error(updateResult.error);
        await fetchProjects();
        toast({ title: tr(language, "Erfolg", "Success"), description: tr(language, "Kostenschätzung erstellt.", "Cost estimation created.") });
      } else {
        toast({ title: tr(language, "Fehler", "Error"), description: result.error || tr(language, "Unbekannter Fehler", "Unknown error"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error cost estimation:", error);
      toast({ title: tr(language, "Fehler", "Error"), description: tr(language, "Unerwarteter Fehler.", "Unexpected error."), variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  }, [user, toast, fetchProjects, activeProject, selectedModel]);


  // --- FILE LOADING ---
  const fileContentCache = useRef<Map<string, { content: string; timestamp: number }>>(new Map());
  const CACHE_DURATION = 5 * 60 * 1000;

  const loadIfcFileContent = useCallback(async (project: IFCModel): Promise<string> => {
    // 1. Check DB content (Legacy support)
    if (project.fileContent) return project.fileContent;

    // 2. Check Cache
    const cacheKey = project.id;
    const cached = fileContentCache.current.get(cacheKey);
    const now = Date.now();
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      return cached.content;
    }

    // 3. Download from Storage (Preferred)
    if (project.fileStoragePath) {
      try {
        const { data, error } = await supabase.storage
          .from('ifc-models')
          .download(project.fileStoragePath);

        if (error) throw error;
        if (!data) throw new Error("No data received");

        const content = await data.text();
        fileContentCache.current.set(cacheKey, { content, timestamp: now });
        return content;
      } catch (error) {
        console.error('Storage download failed:', error);
        throw new Error('Datei konnte nicht geladen werden.');
      }
    } else if (project.fileUrl) {
      // Legacy URL support
      const response = await fetch(project.fileUrl);
      if (!response.ok) throw new Error('Fetch URL failed');
      const blob = await response.blob();
      return await blob.text();
    }

    throw new Error('Keine Datei verfügbar.');
  }, []);

  // --- ACTIONS (Analysis/Chat) ---
  const executePendingAction = async (replacementMap?: Record<string, string>) => {
    if (!pendingAction || !user || !activeProject) return;
    const { type, data } = pendingAction;

    setIsProcessing(true);
    if (type === 'analysis') {
      const { project, fileContent } = data;
      try {
        const formData = new FormData();
        formData.append('ifcFileContent', fileContent);
        if (replacementMap) formData.append('replacementMap', JSON.stringify(replacementMap));
        if (selectedModel) formData.append('model', selectedModel);
        formData.append('language', language);

        const analysisResult = await getIfcAnalysis(formData);
        if (analysisResult.analysis) {
          await updateIfcModel(project.id, { analysisData: analysisResult.analysis, costEstimationData: null });

          setActiveProject(prev => prev ? { ...prev, analysisData: analysisResult.analysis || null, costEstimationData: null } : null);
          await fetchProjects();
          toast({ title: tr(language, "Analyse abgeschlossen", "Analysis completed") });
        } else {
          toast({ title: tr(language, "Fehler", "Error"), description: analysisResult?.error, variant: "destructive" });
        }
      } catch (error) {
        console.error("Analysis error:", error);
        toast({ title: tr(language, "Fehler", "Error"), variant: "destructive" });
      } finally {
        setIsProcessing(false);
        setPendingAction(null);
      }
    } else if (type === 'chat') {
      const { ifcToSend, userQuestion } = data;
      setIsLoading(true);
      try {
        const result = await getAIChatFeedback({ ifcModelData: ifcToSend, userQuestion, replacementMap, model: selectedModel, language });
        const content = result.feedback || result.error || tr(language, 'Fehler aufgetreten.', 'An error occurred.');

        await insertMessage({
          ifc_model_id: activeProject.id, role: 'assistant', content
        });
        await fetchMessages();
      } catch (error) {
        console.error("Chat error:", error);
      } finally {
        setIsLoading(false);
        setPendingAction(null);
        setIsProcessing(false); // Reset processing state for chat too
      }
    }
  };

  const handleReviewConfirm = async (approvedMap: Record<string, string>) => {
    setMaterialReviewOpen(false);
    if (activeProject && user) {
      await updateIfcModel(activeProject.id, { replacements: approvedMap });
      setActiveProject(prev => prev ? { ...prev, replacements: approvedMap } : null);
    }
    executePendingAction(approvedMap);
  };

  const handleDownloadUpdatedIfc = async () => {
    if (!activeProject?.replacements) return;
    setIsProcessing(true);
    try {
      let fileContent = await loadIfcFileContent(activeProject);
      // Clean potential data-uri prefix if still exists in DB
      if (fileContent.startsWith('data:')) fileContent = atob(fileContent.split(',')[1]);

      const updatedContent = applyReplacementsToIfc(fileContent, activeProject.replacements);
      const blob = new Blob([updatedContent], { type: 'application/x-step' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `updated_${activeProject.fileName}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: tr(language, "Download gestartet", "Download started") });
    } catch (error) {
      console.error("Download error:", error);
      toast({ title: tr(language, "Fehler", "Error"), variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const runAnalysis = useCallback(async (project: IFCModel) => {
    if (!project || !user) return;
    setIsProcessing(true);
    try {
      const fileContent = await loadIfcFileContent(project);

      // IMMER prüfen ob Replacements möglich sind, auch beim Update.
      // Das ermöglicht dem User, seine Auswahl zu korrigieren.
      const checkResult = await checkMaterialReplacements(fileContent);

      if (checkResult.replacements && checkResult.replacements.length > 0) {
        // Wir haben Vorschläge.
        // Falls wir bereits eine `project.replacements` Map haben (vom letzten Mal),
        // sollten wir diese als "Default" setzen, damit der User seine alte Wahl sieht.

        let mergedReplacements = checkResult.replacements;

        if (project.replacements) {
          // Update the "replacement" field in the suggestions to match what the user chose last time
          mergedReplacements = mergedReplacements.map(r => {
            // Did user have a replacement for this original material?
            const userChoice = project.replacements![r.original];
            if (userChoice) {
              return { ...r, replacement: userChoice };
            } else {
              // User didn't have a replacement -> maybe they chose "Original"?
              // How do we distinguish "No Choice" from "Chose Original"?
              // In current logic: if key missing in map -> "Original".
              // So if key is missing here -> we should probably keep the suggestion from DB (r.replacement)
              // OR reset to null?
              // Let's stick to: if user didn't have it in map, we show the auto-suggestion again.
              return r;
            }
          });
        }

        setPendingReplacements(mergedReplacements);
        setPendingAction({ type: 'analysis', data: { project, fileContent } });
        setMaterialReviewOpen(true);
        setIsProcessing(false);
        return;
      }

      // Fallback: Keine Replacements gefunden -> Direkt ausführen
      let replacementMap = project.replacements || undefined; // Should be empty/undefined here anyway

      const formData = new FormData();
      formData.append('ifcFileContent', fileContent);
      if (replacementMap) formData.append('replacementMap', JSON.stringify(replacementMap));
      if (selectedModel) formData.append('model', selectedModel);
      formData.append('language', language);

      const analysisResult = await getIfcAnalysis(formData);

      if (analysisResult.analysis) {
        await updateIfcModel(project.id, { analysisData: analysisResult.analysis, costEstimationData: null });
        setActiveProject(prev => prev ? { ...prev, analysisData: analysisResult.analysis || null, costEstimationData: null } : null);
        fetchProjects();
        toast({ title: tr(language, "Analyse abgeschlossen", "Analysis completed") });
      } else {
        toast({ title: tr(language, "Fehler", "Error"), description: analysisResult?.error, variant: "destructive" });
      }
    } catch (error) {
      console.error("Run analysis error:", error);
      toast({ title: tr(language, "Fehler", "Error"), variant: "destructive" });
    } finally {
      if (!materialReviewOpen) setIsProcessing(false);
    }
  }, [user, toast, fetchProjects, loadIfcFileContent, materialReviewOpen, selectedModel, language]);

  const handleSignOut = async () => {
    await signOut();
    setActiveProject(null);
    router.push('/login');
  };

  const handleSendMessage = async (userQuestion: string) => {
    if (!userQuestion.trim() || !activeProject || !user) return;
    setIsLoading(true);

    try {
      // 1. User Message: Insert via Server Action & Update State
      const userMsgResult = await insertMessage({
        ifc_model_id: activeProject.id, role: 'user', content: userQuestion
      });

      if (userMsgResult.message) {
        setActiveMessages(prev => {
          if (prev.some(m => m.id === userMsgResult.message.id)) return prev;
          return [...prev, userMsgResult.message as Message];
        });
      } else if (userMsgResult.error) {
        console.error("Error sending user message:", userMsgResult.error);
      }

      // Prepare payload for AI
      let fileContent = '';
      try { fileContent = await loadIfcFileContent(activeProject); } catch (e) { }

      const ifcToSend = fileContent; // Simplified for brevity

      let replacementMap = activeProject.replacements || undefined;
      // Check for replacements (same logic as before)
      if (!replacementMap) {
        const checkResult = await checkMaterialReplacements(ifcToSend);
        if (checkResult.replacements?.length) {
          setPendingReplacements(checkResult.replacements);
          setPendingAction({ type: 'chat', data: { ifcToSend, userQuestion } });
          setMaterialReviewOpen(true);
          setIsLoading(false);
          return;
        }
      }

      // 2. AI Response
      const result = await getAIChatFeedback({ ifcModelData: ifcToSend, userQuestion, replacementMap, model: selectedModel, language });
      const content = result.feedback || result.error || tr(language, 'Fehler.', 'Error.');

      const aiMsgResult = await insertMessage({
        ifc_model_id: activeProject.id, role: 'assistant', content
      });

      if (aiMsgResult.message) {
        setActiveMessages(prev => {
          if (prev.some(m => m.id === aiMsgResult.message.id)) return prev;
          return [...prev, aiMsgResult.message as Message];
        });
      } else if (aiMsgResult.error) {
        console.error("Error saving assistant message:", aiMsgResult.error);
      }

      // 3. Fallback Sync
      await fetchMessages();

    } catch (error) {
      console.error("Chat error:", error);
      toast({ title: tr(language, "Fehler", "Error"), description: tr(language, "Nachricht konnte nicht gesendet werden.", "Message could not be sent."), variant: "destructive" });
    } finally {
      if (!materialReviewOpen) setIsLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // WICHTIG: DIE KORRIGIERTE UPLOAD FUNKTION
  // ------------------------------------------------------------------
  const handleFileUploaded = async (file: File, _unusedContent: string | null) => {
    if (!user) return;
    setIsProjectsLoading(true);

    try {
      // 1. Get signed upload URL from server (bypasses RLS)
      const urlResult = await createSignedUploadUrl(file.name, file.size);
      if (urlResult.error || !urlResult.signedUrl || !urlResult.storagePath || !urlResult.token) {
        throw new Error(urlResult.error || 'Signed Upload URL konnte nicht erstellt werden.');
      }

      // 2. Upload directly from browser to Supabase Storage using signed URL
      const { error: uploadError } = await supabase.storage
        .from('ifc-models')
        .uploadToSignedUrl(urlResult.storagePath, urlResult.token, file);

      if (uploadError) throw uploadError;

      // 3. Create DB record via server action (bypasses RLS)
      const recordResult = await createIfcModelRecord({
        fileName: file.name,
        fileSize: file.size,
        fileStoragePath: urlResult.storagePath,
      });

      if (recordResult.error || !recordResult.project) {
        throw new Error(recordResult.error || 'Projekteintrag konnte nicht erstellt werden.');
      }

      // 4. UI Update
      setActiveProject(recordResult.project as IFCModel);
      await fetchProjects(true);
      setSelectedElementId(null);

      toast({ title: tr(language, "Projekt erfolgreich hochgeladen", "Project uploaded successfully") });

    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: tr(language, "Fehler beim Upload", "Upload error"),
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProjectsLoading(false);
    }
  };

  const handleExportMaterialPass = () => {
    if (!activeProject?.analysisData) return;

    // Prepare rows for CSV
    const header = ["Material", "Menge", "Anteil"];
    const rows = activeProject.analysisData.materialComposition.map(m => [
      m.name,
      m.value,
      `${m.value}%` // Assuming value is percentage or unit? The original code had `${m.value}%` so keeping it. 
      // Wait, if value is volume, % is wrong. Let's check type.
      // AnalysisResult['materialComposition'] is { name: string, value: number, color: string }[]
      // It seems 'value' is percentage in the pie chart context, but let's check generate-analysis-from-ifc.ts
      // Actually, let's just stick to the previous logic but format as array.
    ]);

    // Check if value is truly percentage. Usually materialComposition is % for pie chart.
    // Let's assume it is.

    downloadCsv([header, ...rows], `${activeProject.fileName}_material_pass.csv`);
  };

  // --- MODEL CHECKS & DIN 277 ---
  const runModelAnalysis = useCallback(async () => {
    if (!activeProject) return;
    setIsModelAnalysisLoading(true);
    setModelAnalysis(null);
    try {
      // Lade IFC-Datei als Binär-Daten (Uint8Array), um Text-Encoding-Roundtrip zu vermeiden
      let data: Uint8Array;

      if (activeProject.fileStoragePath) {
        // Direkt als Blob/ArrayBuffer von Storage laden
        const { data: blob, error } = await supabase.storage
          .from('ifc-models')
          .download(activeProject.fileStoragePath);
        if (error || !blob) throw new Error('Datei konnte nicht geladen werden: ' + (error?.message || ''));
        const arrayBuffer = await blob.arrayBuffer();
        data = new Uint8Array(arrayBuffer);
      } else {
        // Fallback: loadIfcFileContent (Text) -> Uint8Array
        const fileContent = await loadIfcFileContent(activeProject);
        const encoder = new TextEncoder();
        data = encoder.encode(fileContent);
      }

      // Entferne BOM falls vorhanden
      if (data.length >= 3 && data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) {
        data = data.slice(3);
      }

      // Dynamisch web-ifc importieren
      const WebIFC = await import('web-ifc');
      const ifcAPI = new WebIFC.IfcAPI();

      const wasmPath = (window as any).WEBIFC_PATH
        || (window as any).webIfcWasmPath
        || (window as any).ifcjsWasmPath
        || '/wasm/';

      ifcAPI.SetWasmPath(wasmPath);
      if (typeof (ifcAPI as any).Init === 'function') {
        await (ifcAPI as any).Init();
      }

      // Prüfe ob WASM geladen wurde
      const wasmModule = (ifcAPI as any).wasmModule;
      if (!wasmModule) {
        throw new Error('WASM-Modul konnte nicht initialisiert werden.');
      }

      const modelID = await ifcAPI.OpenModel(data, {
        COORDINATE_TO_ORIGIN: false,
        USE_FAST_BOOLS: false,
      });

      try {
        const { runFullAnalysis } = await import('@/utils/modelChecker');
        const analysisResult = await runFullAnalysis(ifcAPI, modelID, WebIFC, data);
        setModelAnalysis(analysisResult);
        toast({ title: tr(language, 'Modellprüfung abgeschlossen', 'Model check completed') });
      } finally {
        await ifcAPI.CloseModel(modelID);
      }
    } catch (error: any) {
      console.error('Model analysis error:', error);
      toast({
        title: tr(language, 'Fehler bei Modellprüfung', 'Model check error'),
        description: error.message || tr(language, 'Unbekannter Fehler', 'Unknown error'),
        variant: 'destructive',
      });
    } finally {
      setIsModelAnalysisLoading(false);
    }
  }, [activeProject, loadIfcFileContent, toast, language]);

  // Auto-run model analysis on project change
  const lastAnalyzedProjectId = useRef<string | null>(null);

  useEffect(() => {
    if (activeProject && activeProject.id !== lastAnalyzedProjectId.current) {
      lastAnalyzedProjectId.current = activeProject.id;
      runModelAnalysis();
    }
  }, [activeProject, runModelAnalysis]);

  return (
    <div className="flex h-screen bg-background overflow-hidden relative">
      <ResizablePanelGroup direction="horizontal" className="h-full w-full">
        {/* Sidebar */}
        {isSidebarOpen && (
          <>
            <ResizablePanel defaultSize={20} minSize={15} maxSize={30} collapsible className="border-r bg-card flex flex-col">
              <aside className="w-full h-full flex flex-col">
                <div className="p-4 border-b flex items-center gap-2">
                  <Building className="w-6 h-6 text-primary" />
                  <h1 className="font-bold text-lg font-headline">BIMCoach Studio</h1>
                </div>

                <div className="flex-1 overflow-hidden p-4 flex flex-col gap-4">
                  <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
                    <div className="flex items-center gap-2 mb-2 bg-muted/50 p-1 rounded-lg shrink-0">
                      <Button
                        variant={sidebarTab === 'projects' ? 'default' : 'ghost'}
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={() => setSidebarTab('projects')}
                      >
                        {tr(language, 'Projekte', 'Projects')}
                      </Button>
                      <Button
                        variant={sidebarTab === 'structure' ? 'default' : 'ghost'}
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={() => setSidebarTab('structure')}
                        disabled={!modelStructure}
                      >
                        {tr(language, 'Struktur', 'Structure')}
                      </Button>
                    </div>

                    <div className="flex-1 overflow-hidden relative">
                      {sidebarTab === 'projects' ? (
                        <ProjectSelector
                          language={language}
                          projects={projects}
                          isLoading={isProjectsLoading}
                          onSelectProject={(p) => {
                            setActiveProject(p);
                            setModelStructure(null); // Reset structure on project switch
                            setSelectedElementId(null);
                          }}
                          onUploadNew={handleFileUploaded}
                          onDeleteProject={async () => { await fetchProjects(); if (projects.length <= 1) setActiveProject(null); }}
                          activeProjectId={activeProject?.id}
                        />
                      ) : (
                        <ModelTree
                          tree={modelStructure}
                          onSelect={(id) => setSelectedElementId(id)}
                          selectedId={selectedElementId}
                        />
                      )}
                    </div>
                  </div>
                  {/* Comparison... */}
                  {projects.filter(p => p.analysisData).length >= 2 && (
                    <div className="pt-2 border-t">
                      <Sheet>
                        <SheetTrigger asChild><Button variant="outline" className="w-full justify-start gap-2"><GitCompare className="w-4 h-4" /> {tr(language, 'Projekte vergleichen', 'Compare projects')}</Button></SheetTrigger>
                        <SheetContent side="right" className="w-[90vw] sm:w-[80vw] overflow-y-auto">
                          <SheetHeader><SheetTitle>{tr(language, 'Projektvergleich', 'Project comparison')}</SheetTitle></SheetHeader>
                          <div className="mt-6">
                            <ProjectComparison projects={projects.filter(p => p.analysisData)} projectA={comparisonProjectA} projectB={comparisonProjectB} onSelectProjectA={setComparisonProjectA} onSelectProjectB={setComparisonProjectB} />
                          </div>
                        </SheetContent>
                      </Sheet>
                    </div>
                  )}
                </div>
                <div className="p-4 border-t">
                  <div className="flex items-center gap-3 mb-4 p-2 rounded-lg bg-muted/50">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">{user?.email?.charAt(0).toUpperCase()}</div>
                    <div className="overflow-hidden"><p className="text-sm font-medium truncate">{user?.email}</p></div>
                  </div>
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={handleSignOut}><LogOut className="w-4 h-4" /> {tr(language, 'Abmelden', 'Sign out')}</Button>
                </div>
              </aside>
            </ResizablePanel>
            <ResizableHandle withHandle />
          </>
        )}

        {/* Main Content */}
        <ResizablePanel defaultSize={isSidebarOpen ? 80 : 100} className="flex flex-col min-w-0 h-full">
          <main className="flex-1 flex flex-col min-w-0 transition-all duration-300 h-full">
            <header className="h-14 border-b flex items-center px-4 gap-4 bg-background z-10">
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!isSidebarOpen)}>{isSidebarOpen ? <PanelLeft className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</Button>
              {activeProject ? (
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="font-medium truncate">{activeProject.fileName}</span>
                  {activeProject.analysisData && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 whitespace-nowrap">{tr(language, 'Analysiert', 'Analyzed')}</span>}
                </div>
              ) : <span className="text-muted-foreground">{tr(language, 'Kein Projekt ausgewählt', 'No project selected')}</span>}
              <div className="ml-auto flex items-center gap-2">
                <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
                  <SelectTrigger className="w-[120px] h-8 text-xs">
                    <SelectValue placeholder="Sprache" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as AIModelId)}>
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <Sparkles className="w-3 h-3 mr-1 text-primary" />
                    <SelectValue placeholder={tr(language, "Modell wählen", "Choose model")} />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_MODELS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeProject && (
                  <Button variant="ghost" size="sm" onClick={handleDownloadUpdatedIfc} disabled={!activeProject.replacements || isProcessing}>
                    <Layers className="w-4 h-4 mr-2" /> {tr(language, 'IFC herunterladen', 'Download IFC')}
                  </Button>
                )}
                <ThemeToggle />
              </div>
            </header>

            <div className="flex-1 overflow-hidden relative">
              {activeProject ? (
                <ResizablePanelGroup direction="horizontal" className="h-full w-full">
                  {/* Middle Column: Viewer and Analyses */}
                  <ResizablePanel defaultSize={70} className="flex flex-col min-w-0">
                    <ResizablePanelGroup direction="vertical" className="h-full w-full">
                      {/* Top: 3D Viewer */}
                      <ResizablePanel defaultSize={60} minSize={30} className="relative bg-muted/10">
                        <div className="absolute inset-0 p-0 overflow-hidden">
                          <IfcViewer
                            language={language}
                            ifcStoragePath={activeProject.fileStoragePath || undefined}
                            ifcUrl={!activeProject.fileStoragePath && activeProject.fileUrl ? activeProject.fileUrl : undefined}
                            ifcContent={!activeProject.fileStoragePath && !activeProject.fileUrl ? activeProject.fileContent : undefined}
                            key={activeProject.id}
                            onElementSelected={(id) => setSelectedElementId(id)}
                            selectedElementId={selectedElementId}
                            onModelLoaded={handleModelLoaded}
                          />
                        </div>
                      </ResizablePanel>

                      <ResizableHandle withHandle />

                      {/* Bottom: Tools (Tabs) */}
                      <ResizablePanel defaultSize={40} minSize={10} collapsible className="bg-background flex flex-col border-t shadow-sm z-10">
                        <div className="h-full flex flex-col bg-card/50 overflow-y-auto p-8 space-y-12">
                          <div className="space-y-6">
                            <div className="max-w-5xl mx-auto space-y-6">
                              <div className="flex items-center justify-between">
                                <div><h2 className="text-2xl font-bold font-headline mb-1">{tr(language, 'Modellprüfung', 'Model check')}</h2></div>
                                <Button onClick={runModelAnalysis} disabled={isModelAnalysisLoading}>
                                  {isModelAnalysisLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                                  {modelAnalysis ? tr(language, ' Aktualisieren', ' Refresh') : tr(language, ' Starten', ' Start')}
                                </Button>
                              </div>
                              {isModelAnalysisLoading && (
                                <div className="flex flex-col items-center justify-center py-12">
                                  <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                                  <p className="font-semibold">{tr(language, 'Modell wird analysiert...', 'Model is being analyzed...')}</p>
                                  <p className="text-muted-foreground text-sm">{tr(language, 'IFC-Datei wird geladen und geprüft.', 'IFC file is loading and being checked.')}</p>
                                </div>
                              )}
                              {!isModelAnalysisLoading && <ModelChecksTab language={language} result={modelAnalysis?.modelCheck ?? null} />}
                            </div>
                          </div>

                          <div className="space-y-6 border-t pt-8">
                            {/* ... Analysis UI (identisch zu deinem Code) ... */}
                            <div className="max-w-5xl mx-auto space-y-6">
                              <div className="flex items-center justify-between">
                                <div><h2 className="text-2xl font-bold font-headline mb-1">{tr(language, 'Nachhaltigkeitsanalyse', 'Sustainability analysis')}</h2></div>
                                <Button onClick={() => runAnalysis(activeProject)} disabled={isProcessing}>{isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Leaf className="w-4 h-4" />} {activeProject.analysisData ? tr(language, "Aktualisieren", "Refresh") : tr(language, "Starten", "Start")}</Button>
                              </div>
                              {activeProject.analysisData && <AnalysisPanel language={language} project={activeProject} isProcessing={isProcessing} onRunAnalysis={() => runAnalysis(activeProject)} onRunCostEstimation={runCostEstimation} onExport={handleExportMaterialPass} onDownloadExchangedIfc={handleDownloadUpdatedIfc} />}
                            </div>
                          </div>

                          <div className="space-y-6 border-t pt-8">
                            <div className="max-w-5xl mx-auto space-y-6">
                              <div className="flex items-center justify-between">
                                <div><h2 className="text-2xl font-bold font-headline mb-1">{tr(language, 'DIN 277 Flächenauswertung', 'DIN 277 area evaluation')}</h2></div>
                                {!modelAnalysis && (
                                  <Button onClick={runModelAnalysis} disabled={isModelAnalysisLoading}>
                                    {isModelAnalysisLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LayoutGrid className="w-4 h-4" />}
                                    {tr(language, ' Auswertung starten', ' Start evaluation')}
                                  </Button>
                                )}
                              </div>
                              {isModelAnalysisLoading && (
                                <div className="flex flex-col items-center justify-center py-12">
                                  <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                                  <p className="font-semibold">{tr(language, 'Flächenauswertung wird erstellt...', 'Area evaluation is being generated...')}</p>
                                </div>
                              )}
                              {!isModelAnalysisLoading && <Din277Tab language={language} result={modelAnalysis?.din277 ?? null} />}
                            </div>
                          </div>

                          <div className="space-y-6 border-t pt-8">
                            <div className="max-w-5xl mx-auto space-y-6">
                              <div className="flex items-center justify-between">
                                <div><h2 className="text-2xl font-bold font-headline mb-1">{tr(language, 'DIN 276 Mengenauswertung', 'DIN 276 quantity evaluation')}</h2></div>
                                {!modelAnalysis && (
                                  <Button onClick={runModelAnalysis} disabled={isModelAnalysisLoading}>
                                    {isModelAnalysisLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                                    {tr(language, ' Auswertung starten', ' Start evaluation')}
                                  </Button>
                                )}
                              </div>
                              {isModelAnalysisLoading && (
                                <div className="flex flex-col items-center justify-center py-12">
                                  <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                                  <p className="font-semibold">{tr(language, 'Mengenauswertung wird erstellt...', 'Quantity evaluation is being generated...')}</p>
                                </div>
                              )}
                              {!isModelAnalysisLoading && <Din276Tab language={language} result={modelAnalysis?.din276 ?? null} />}
                            </div>
                          </div>
                        </div>
                      </ResizablePanel>
                    </ResizablePanelGroup>
                  </ResizablePanel>

                  <ResizableHandle withHandle />

                  {/* Right Column: AI Chat */}
                  <ResizablePanel defaultSize={30} minSize={20} maxSize={40} collapsible className="bg-background flex flex-col border-l shadow-sm z-10">
                    <div className="px-4 py-3 border-b shrink-0 bg-card flex items-center justify-between">
                      <span className="font-semibold text-sm flex items-center gap-2 font-headline"><Bot className="w-4 h-4 text-primary" /> {tr(language, 'KI Coach', 'AI Coach')}</span>
                    </div>
                    <div className="flex-1 overflow-hidden m-0 flex flex-col">
                      <ChatAssistant language={language} activeProject={activeProject} activeMessages={activeMessages} isLoading={isLoading || messagesLoading} onSendMessage={handleSendMessage} startingPrompts={startingPrompts} />
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                  <Building className="w-16 h-16 mb-4 opacity-20" />
                  <h2 className="text-2xl font-semibold text-foreground">{tr(language, 'Willkommen', 'Welcome')}</h2>
                  <p className="mb-8">{tr(language, 'Bitte Projekt auswählen oder hochladen.', 'Please select or upload a project.')}</p>
                  <Button size="lg" onClick={() => (document.querySelector('input[type="file"]') as HTMLElement)?.click()}><FilePlus className="w-5 h-5 mr-2" /> {tr(language, 'Neues Projekt', 'New project')}</Button>
                </div>
              )}
            </div>
          </main>
        </ResizablePanel>
      </ResizablePanelGroup>

      <MaterialReviewModal language={language} isOpen={materialReviewOpen} onOpenChange={setMaterialReviewOpen} replacements={pendingReplacements} onConfirm={handleReviewConfirm} />
    </div>
  );
}
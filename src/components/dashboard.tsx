
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, addDoc, serverTimestamp, query, orderBy, doc, setDoc, getDoc, updateDoc, getDocs } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileUploader } from '@/components/file-uploader';
import { ModelViewer } from '@/components/model-viewer';
import { AnalysisPanel } from '@/components/analysis-panel';
import { ChatAssistant } from '@/components/chat-assistant';
import { Building, Bot, BarChart3, Menu, LogOut, PanelLeft, Loader2, Euro } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { getStartingPrompts, getAIChatFeedback, getIfcAnalysis, getCostEstimation } from '@/app/actions';
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { ProjectSelector } from './project-selector';
import type { IFCModel, AnalysisResult, CostEstimationResult } from '@/lib/types';
import { cn, downloadCsv } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';


export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: any;
};

export default function Dashboard() {
  const [activeProject, setActiveProject] = useState<IFCModel | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [startingPrompts, setStartingPrompts] = useState<string[]>([]);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false); // Combined state for analysis and cost estimation
  const [projects, setProjects] = useState<IFCModel[]>([]);
  const [isProjectsLoading, setIsProjectsLoading] = useState(true);
  const [modelUrl, setModelUrl] = useState<string | null>(null);

  const auth = useAuth();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const messagesRef = useMemoFirebase(() => {
    if (!user || !firestore || !activeProject) return null;
    return collection(firestore, 'users', user.uid, 'ifcModels', activeProject.id, 'messages');
  }, [user, firestore, activeProject]);

  const messagesQuery = useMemoFirebase(() => {
    if (!messagesRef) return null;
    return query(messagesRef, orderBy('createdAt', 'asc'));
  }, [messagesRef]);

  const { data: activeMessages, isLoading: messagesLoading } = useCollection<Message>(messagesQuery);
  
  const fetchProjects = useCallback(async () => {
    if (!user || !firestore) return;
    setIsProjectsLoading(true);
    try {
      const projectsRef = collection(firestore, 'users', user.uid, 'ifcModels');
      const q = query(projectsRef, orderBy('uploadDate', 'desc'));
      const querySnapshot = await getDocs(q);
      const userProjects = querySnapshot.docs.map(doc => ({...doc.data(), id: doc.id}) as IFCModel);
      setProjects(userProjects);
      if (userProjects.length > 0 && !activeProject) {
        setActiveProject(userProjects[0]);
      } else if (activeProject) {
        const updatedActiveProject = userProjects.find(p => p.id === activeProject.id);
        if (updatedActiveProject) {
          setActiveProject(updatedActiveProject);
        } else {
          setActiveProject(userProjects.length > 0 ? userProjects[0] : null);
        }
      } else if (userProjects.length === 0) {
        setActiveProject(null);
      }
    } catch (error) {
      console.error("Error fetching projects: ", error);
      toast({
        title: "Fehler beim Laden der Projekte",
        description: "Ihre Projekte konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setIsProjectsLoading(false);
    }
  }, [user, firestore, toast, activeProject?.id]);

  useEffect(() => {
    fetchProjects();
  }, [user, fetchProjects]);

  useEffect(() => {
    if (activeProject?.fileContent) {
        try {
            const pureBase64 = activeProject.fileContent.split(',')[1] || activeProject.fileContent;
            const byteCharacters = atob(pureBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            setModelUrl(url);

            return () => {
                if (url) {
                    URL.revokeObjectURL(url);
                }
            };
        } catch (e) {
            console.error("Failed to decode base64 content or create URL:", e);
            setModelUrl(null);
        }
    } else {
        setModelUrl(null);
    }
  }, [activeProject]);
  
  useEffect(() => {
    async function fetchPrompts() {
      const result = await getStartingPrompts();
      if (result.prompts) {
        setStartingPrompts(result.prompts);
      }
    }
    fetchPrompts();
  }, []);
  
const runCostEstimation = useCallback(async (totalArea: number) => {
    const project = activeProject;
    if (!project?.analysisData?.materialComposition || !user || !firestore) {
        toast({ title: "Fehler", description: "Materialdaten für Kostenschätzung nicht verfügbar.", variant: "destructive" });
        return;
    }
    setIsProcessing(true);
    try {
        const input = {
            materials: project.analysisData.materialComposition.map(({ name, value }) => ({ name, value })),
            totalBuildingArea: totalArea, 
        };

        const result = await getCostEstimation(input);

        if (result.costs) {
            const projectRef = doc(firestore, 'users', user.uid, 'ifcModels', project.id);
            await updateDoc(projectRef, { costEstimationData: result.costs });
            await fetchProjects();
            toast({ title: "Kostenschätzung abgeschlossen", description: "Die Kostenschätzung wurde erfolgreich erstellt." });
        } else {
            toast({ title: "Kostenschätzung Fehlgeschlagen", description: result.error || "Ein unbekannter Fehler ist aufgetreten.", variant: "destructive", duration: 9000 });
        }

    } catch (error) {
        console.error("Error running cost estimation:", error);
        toast({ title: "Kostenschätzung Fehlgeschlagen", description: "Ein unerwarteter Fehler ist aufgetreten.", variant: "destructive" });
    } finally {
        setIsProcessing(false);
    }
}, [user, firestore, toast, fetchProjects, activeProject]);


  const runAnalysisAndCosts = useCallback(async (project: IFCModel) => {
    if (!project || !user || !firestore) return;

    setIsProcessing(true);
    try {
      // Step 1: Run Sustainability Analysis
      const analysisResult = await getIfcAnalysis({ ifcFileContent: project.fileContent });
      
      if (analysisResult.analysis) {
        const projectRef = doc(firestore, 'users', user.uid, 'ifcModels', project.id);
        await updateDoc(projectRef, { analysisData: analysisResult.analysis });
        
        toast({
          title: "Analyse abgeschlossen",
          description: "Nachhaltigkeitsanalyse erfolgreich. Starte Kostenschätzung...",
        });

        // Step 2: Run Cost Estimation with placeholder area, user can re-run later
        const costInput = {
            materials: analysisResult.analysis.materialComposition.map(({ name, value }) => ({ name, value })),
            totalBuildingArea: 5000, 
        };
        const costResult = await getCostEstimation(costInput);

        if (costResult.costs) {
            await updateDoc(projectRef, { costEstimationData: costResult.costs });
            toast({ title: "Kostenschätzung abgeschlossen", description: "Alle Analysen sind fertig. Sie können die Schätzung mit einer exakten BGF erneut durchführen." });
        } else {
            toast({ title: "Kostenschätzung fehlgeschlagen", description: costResult.error || "Konnte Kosten nicht schätzen.", variant: "destructive", duration: 9000 });
        }

        await fetchProjects();

      } else {
        toast({
          title: "Analyse Fehlgeschlagen",
          description: analysisResult?.error || "Ein unbekannter Fehler ist aufgetreten.",
          variant: "destructive",
          duration: 9000,
        });
      }
    } catch (error) {
      console.error("Error running analysis pipeline:", error);
      toast({
        title: "Analyse-Pipeline Fehlgeschlagen",
        description: "Ein unerwarteter Fehler ist aufgetreten.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [user, firestore, toast, fetchProjects]);

  const handleSignOut = async () => {
    await signOut(auth);
    setActiveProject(null);
    router.push('/login');
  };

  const handleSendMessage = async (userQuestion: string) => {
    if (!userQuestion.trim() || !activeProject || !messagesRef) return;

    const userMessage: Omit<Message, 'id'> = {
      role: 'user',
      content: userQuestion,
      createdAt: serverTimestamp(),
    };
    
    setIsLoading(true);

    try {
      await addDoc(messagesRef, userMessage);
      
      const result = await getAIChatFeedback({
        ifcModelData: activeProject.fileContent || '',
        userQuestion: userQuestion,
      });

      const assistantMessageContent = result.feedback || result.error || 'Entschuldigung, ein Fehler ist aufgetreten.';
      
      const assistantMessage: Omit<Message, 'id'> = {
        role: 'assistant',
        content: assistantMessageContent,
        createdAt: serverTimestamp(),
      };
      
      await addDoc(messagesRef, assistantMessage);

    } catch (error: any) {
        console.error("Error in handleSendMessage flow:", error);
        
        let errorMessageContent = 'Das KI-Feedback konnte nicht abgerufen werden. Bitte versuchen Sie es später erneut.';

       const errorMessage: Omit<Message, 'id'> = {
        role: 'assistant',
        content: errorMessageContent,
        createdAt: serverTimestamp(),
      };
      if (messagesRef) {
        await addDoc(messagesRef, errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleFileUploaded = async (file: File, fileContent: string) => {
    if (!user || !firestore) return;

    setIsProjectsLoading(true);
    setActiveProject(null);
    setModelUrl(null);
    try {
        const newProjectRef = doc(collection(firestore, 'users', user.uid, 'ifcModels'));
        const newProjectData: Omit<IFCModel, 'id'> = {
            userId: user.uid,
            fileName: file.name,
            fileSize: file.size,
            fileContent: fileContent,
            uploadDate: serverTimestamp(),
            analysisData: null,
            costEstimationData: null,
        }
        await setDoc(newProjectRef, newProjectData);
        await fetchProjects();

    } catch(error) {
        console.error("Error saving new project:", error);
        toast({
          title: "Fehler beim Upload",
          description: "Das neue Projekt konnte nicht gespeichert werden.",
          variant: "destructive",
        })
    } finally {
        setIsProjectsLoading(false);
    }
  };


  const handleExportMaterialPass = () => {
    if (!activeProject || !activeProject.analysisData) return;

    const headers = ["Kategorie", "Name", "Wert", "Einheit/Info"];
    
    const indicatorRows = activeProject.analysisData.indicators.map(item => ["Indikator", item.name, item.value, `${item.unit} (${item.a})`]);
    const materialRows = activeProject.analysisData.materialComposition.map(item => ["Material", item.name, item.value.toString(), "%"]);
    
    const allRows = [headers, ...indicatorRows, ...materialRows];
    
    const fileName = `Materialpass_${activeProject.fileName.replace('.ifc', '')}.csv`;
    
    downloadCsv(allRows, fileName);
  };

  const handleSelectProject = (project: IFCModel | null) => {
    setActiveProject(project);
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };
  
  const memoizedMessages = useMemo(() => activeMessages || [], [activeMessages]);


  const Header = () => (
    <header className="flex items-center justify-between p-4 border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10 h-16">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="w-8 h-8 md:hidden" onClick={() => setSidebarOpen(!isSidebarOpen)}>
            <PanelLeft className="w-5 h-5" />
        </Button>
        <Building className="w-6 h-6 text-foreground" />
        <h1 className="text-lg font-bold font-headline text-foreground">BIMCoach Studio</h1>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
        <Button variant="ghost" size="icon" onClick={handleSignOut} title="Abmelden">
          <LogOut className="w-5 h-5" />
        </Button>
      </div>
    </header>
  );

  return (
    <div className="flex h-screen bg-muted/40">
       <aside className={cn(
           "fixed z-20 h-full w-72 border-r bg-card p-4 transition-transform md:relative md:translate-x-0",
           isSidebarOpen ? "translate-x-0" : "-translate-x-full"
       )}>
           <div className="flex flex-col h-full">
              <div className="px-2 mb-4">
                <h2 className="text-lg font-semibold font-headline">Meine Projekte</h2>
                <p className="text-sm text-muted-foreground">Wählen oder erstellen Sie ein Projekt.</p>
              </div>
              <div className="flex-1 overflow-y-auto">
                <ProjectSelector 
                    projects={projects}
                    isLoading={isProjectsLoading}
                    onSelectProject={handleSelectProject} 
                    onUploadNew={handleFileUploaded} 
                    activeProjectId={activeProject?.id}
                    onDeleteProject={fetchProjects} 
                />
              </div>
              <div className="mt-4">
                  <Button variant="ghost" onClick={handleSignOut} className="w-full justify-start">
                    <LogOut className="mr-2 h-4 w-4" />
                    Abmelden
                  </Button>
              </div>
           </div>
       </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {activeProject ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
              <div className="lg:col-span-2 h-full min-h-[400px] lg:min-h-0">
                 <ModelViewer modelUrl={modelUrl} />
              </div>
              <div className="lg:col-span-1 flex flex-col bg-card rounded-lg border min-h-0">
                 <div className="p-4 border-b">
                    <h2 className="font-semibold font-headline truncate" title={activeProject.fileName}>{activeProject.fileName}</h2>
                    <p className="text-sm text-muted-foreground">{(activeProject.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                 </div>
                 <Tabs defaultValue="coach" className="flex-1 flex flex-col min-h-0">
                    <div className="px-4 pt-4">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="analysis"><BarChart3 className="w-4 h-4 mr-2" />Analyse</TabsTrigger>
                            <TabsTrigger value="coach"><Bot className="w-4 h-4 mr-2" />KI-Coach</TabsTrigger>
                        </TabsList>
                    </div>
                    <TabsContent value="analysis" className="flex-1 overflow-y-auto p-4">
                      <AnalysisPanel 
                        project={activeProject} 
                        isProcessing={isProcessing}
                        onRunAnalysis={() => runAnalysisAndCosts(activeProject)}
                        onRunCostEstimation={runCostEstimation}
                        onExport={handleExportMaterialPass} 
                      />
                    </TabsContent>
                    <TabsContent value="coach" className="m-0 flex-1 flex flex-col min-h-0">
                       <ChatAssistant 
                          messages={memoizedMessages}
                          startingPrompts={startingPrompts}
                          isLoading={isLoading || messagesLoading}
                          onSendMessage={handleSendMessage}
                        />
                    </TabsContent>
                  </Tabs>
              </div>
            </div>
          ) : isProjectsLoading || isProcessing ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p>{isProjectsLoading ? 'Lade Projekte...' : 'Verarbeite Daten...'}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
               <div className="text-center">
                    <Building className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4"/>
                    <h2 className="text-xl font-semibold">Kein Projekt ausgewählt</h2>
                    <p className="text-muted-foreground">Bitte wählen Sie ein Projekt aus der Seitenleiste aus, um zu beginnen.</p>
               </div>
            </div>
          )}
        </main>
      </div>
      {/* Overlay for mobile */}
      {isSidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/40 z-10 md:hidden" />}
    </div>
  );
}

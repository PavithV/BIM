
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, addDoc, serverTimestamp, query, orderBy, doc, setDoc, getDoc, updateDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileUploader } from '@/components/file-uploader';
import { IfcViewer } from '@/components/ifc-viewer';
import { AnalysisPanel } from '@/components/analysis-panel';
import { ChatAssistant } from '@/components/chat-assistant';
import { Building, Bot, BarChart3, Menu, LogOut, PanelLeft, Loader2, Euro, Leaf, Layers, GitCompare } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { getStartingPrompts, getAIChatFeedback, getIfcAnalysis, getCostEstimation } from '@/app/actions';
import { useAuth, useUser, useFirestore, useStorage, useCollection, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { ProjectSelector } from './project-selector';
import { ProjectComparison } from './project-comparison';
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
  const [comparisonProjectA, setComparisonProjectA] = useState<IFCModel | null>(null);
  const [comparisonProjectB, setComparisonProjectB] = useState<IFCModel | null>(null);

  const auth = useAuth();
  const firestore = useFirestore();
  const storage = useStorage();
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
  
  const fetchProjects = useCallback(async (skipActiveProjectUpdate: boolean = false) => {
    if (!user || !firestore) {
      console.log('fetchProjects: Missing dependencies', { user: !!user, firestore: !!firestore });
      return;
    }
    
    console.log('fetchProjects: Starting...', { skipActiveProjectUpdate });
    setIsProjectsLoading(true);
    try {
      const projectsRef = collection(firestore, 'users', user.uid, 'ifcModels');
      const q = query(projectsRef, orderBy('uploadDate', 'desc'));
      console.log('fetchProjects: Executing query...');
      const querySnapshot = await getDocs(q);
      console.log('fetchProjects: Query completed, found', querySnapshot.docs.length, 'projects');
      const userProjects = querySnapshot.docs.map(doc => ({...doc.data(), id: doc.id}) as IFCModel);
      setProjects(userProjects);
      
      // Nur aktives Projekt aktualisieren, wenn nicht übersprungen werden soll
      if (!skipActiveProjectUpdate) {
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
      }
      console.log('fetchProjects: Completed successfully');
    } catch (error) {
      console.error("Error fetching projects: ", error);
      toast({
        title: "Fehler beim Laden der Projekte",
        description: "Ihre Projekte konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      console.log('fetchProjects: Setting isLoading to false');
      setIsProjectsLoading(false);
    }
  }, [user, firestore, toast, activeProject?.id]);

  useEffect(() => {
    fetchProjects();
  }, [user, fetchProjects]);

  // Auto-setze Vergleichsprojekte wenn verfügbar
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


  const runAnalysis = useCallback(async (project: IFCModel) => {
    if (!project || !user || !firestore) return;

    setIsProcessing(true);
    try {
      // Lade Dateiinhalt: entweder aus fileContent oder aus Storage
      let fileContent: string;
      if (project.fileContent) {
        fileContent = project.fileContent;
      } else if (project.fileUrl) {
        // Lade Datei aus Storage
        const response = await fetch(project.fileUrl);
        if (!response.ok) {
          throw new Error('Datei konnte nicht aus Storage geladen werden.');
        }
        fileContent = await response.text();
      } else {
        throw new Error('Keine Datei verfügbar.');
      }

      const analysisResult = await getIfcAnalysis({ ifcFileContent: fileContent });
      
      if (analysisResult.analysis) {
        const projectRef = doc(firestore, 'users', user.uid, 'ifcModels', project.id);
        await updateDoc(projectRef, { analysisData: analysisResult.analysis, costEstimationData: null });
        
        await fetchProjects();

        toast({
          title: "Analyse abgeschlossen",
          description: "Nachhaltigkeitsanalyse erfolgreich. Sie können nun eine Kostenschätzung durchführen.",
        });

      } else {
        toast({
          title: "Analyse Fehlgeschlagen",
          description: analysisResult?.error || "Ein unbekannter Fehler ist aufgetreten.",
          variant: "destructive",
          duration: 9000,
        });
      }
    } catch (error) {
      console.error("Error running analysis:", error);
      toast({
        title: "Analyse Fehlgeschlagen",
        description: error instanceof Error ? error.message : "Ein unerwarteter Fehler ist aufgetreten.",
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
      
      // Lade Dateiinhalt: entweder aus fileContent oder aus Storage
      let fileContent: string;
      if (activeProject.fileContent) {
        fileContent = activeProject.fileContent;
      } else if (activeProject.fileUrl) {
        // Lade Datei aus Storage
        const response = await fetch(activeProject.fileUrl);
        if (!response.ok) {
          throw new Error('Datei konnte nicht aus Storage geladen werden.');
        }
        fileContent = await response.text();
      } else {
        fileContent = '';
      }
      
      const result = await getAIChatFeedback({
        ifcModelData: fileContent,
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
  
  const handleFileUploaded = async (file: File, fileContent: string | null) => {
    if (!user || !firestore) {
      console.error('Missing dependencies:', { user: !!user, firestore: !!firestore });
      return;
    }

    console.log('handleFileUploaded started:', { fileName: file.name, fileSize: file.size, hasContent: !!fileContent, hasStorage: !!storage });
    setIsProjectsLoading(true);
    
    try {
        console.log('Creating project reference...');
        const newProjectRef = doc(collection(firestore, 'users', user.uid, 'ifcModels'));
        const projectId = newProjectRef.id;
        
        // Firestore hat ein Limit von ~1MB pro Feld
        // Base64 erhöht die Dateigröße um ~33%, daher sollte die Datei max. ~750KB sein
        // Um sicher zu gehen, verwenden wir 700KB als Schwellenwert
        const FILE_SIZE_THRESHOLD = 700 * 1024; // 700KB
        let fileUrl: string | null = null;
        let finalFileContent: string | null = null;

        // Prüfe, ob Storage verfügbar ist und ob die Datei zu groß für Firestore ist
        const isLargeFile = file.size > FILE_SIZE_THRESHOLD || fileContent === null;
        const canUseStorage = !!storage;
        let storagePath: string | null = null;

        if (isLargeFile && canUseStorage) {
          // Große Datei UND Storage verfügbar: In Firebase Storage hochladen
          console.log('Uploading large file to Storage...');
          
          // Bereinige den Dateinamen: Ersetze Leerzeichen und Sonderzeichen
          const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          storagePath = `users/${user.uid}/ifcModels/${projectId}/${sanitizedFileName}`;
          const storageRef = ref(storage, storagePath);
          
          console.log('Storage path:', storagePath);
          
          toast({
            title: "Datei wird hochgeladen...",
            description: `Bitte warten Sie, während ${(file.size / 1024 / 1024).toFixed(1)} MB hochgeladen werden.`,
          });
          
          try {
            // Lade Datei direkt in Storage hoch
            console.log('Starting uploadBytes...', { fileSize: file.size, fileName: sanitizedFileName });
            await uploadBytes(storageRef, file);
            console.log('uploadBytes completed, getting download URL...');
            fileUrl = await getDownloadURL(storageRef);
            console.log('Download URL received:', fileUrl);
            finalFileContent = null; // Nicht in Firestore speichern
          } catch (storageError: any) {
            console.error('Storage upload error:', storageError);
            console.error('Storage error details:', {
              code: storageError?.code,
              message: storageError?.message,
              serverResponse: storageError?.serverResponse
            });
            throw new Error(`Fehler beim Hochladen in Storage: ${storageError?.message || 'Unbekannter Fehler'}`);
          }
        } else if (isLargeFile && !canUseStorage) {
          // Große Datei ABER Storage nicht verfügbar: Fehler
          const errorMsg = `Datei zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB). Bitte aktivieren Sie Firebase Storage in der Firebase Console, um Dateien größer als 700KB hochzuladen.`;
          throw new Error(errorMsg);
        } else {
          console.log('Saving small file directly to Firestore...');
          // Kleine Datei: Direkt in Firestore speichern
          finalFileContent = fileContent;
          fileUrl = null;
          storagePath = null;
        }

        console.log('Saving project to Firestore...', { hasFileContent: !!finalFileContent, hasFileUrl: !!fileUrl, hasStoragePath: !!storagePath });
        const newProjectData: Omit<IFCModel, 'id'> = {
            userId: user.uid,
            fileName: file.name,
            fileSize: file.size,
            fileContent: finalFileContent,
            fileUrl: fileUrl,
            fileStoragePath: storagePath,
            uploadDate: serverTimestamp(),
            analysisData: null,
            costEstimationData: null,
        }
        await setDoc(newProjectRef, newProjectData);
        console.log('Project saved to Firestore');
        
        // Warte kurz, damit Firestore die Daten synchronisiert hat
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Lade das neue Projekt direkt aus Firestore, um sicherzustellen, dass alle Daten korrekt sind
        console.log('Loading project from Firestore...');
        const savedProjectDoc = await getDoc(newProjectRef);
        if (!savedProjectDoc.exists()) {
          throw new Error('Projekt konnte nicht gespeichert werden.');
        }
        
        const savedProjectData = savedProjectDoc.data();
        const savedProject: IFCModel = {
          ...savedProjectData,
          id: savedProjectDoc.id,
          fileContent: savedProjectData.fileContent ?? null,
          fileUrl: savedProjectData.fileUrl ?? null,
          fileStoragePath: savedProjectData.fileStoragePath ?? null,
        } as IFCModel;
        
        console.log('Neues Projekt geladen:', {
          id: savedProject.id,
          fileName: savedProject.fileName,
          hasFileContent: !!savedProject.fileContent,
          hasFileUrl: !!savedProject.fileUrl,
          hasFileStoragePath: !!savedProject.fileStoragePath,
          fileUrl: savedProject.fileUrl,
          fileStoragePath: savedProject.fileStoragePath
        });
        
        // Setze das neue Projekt ZUERST als aktiv, damit der Viewer es sofort erkennt
        setActiveProject(savedProject);
        
        // Aktualisiere die Projekte-Liste danach
        console.log('Fetching projects...');
        await fetchProjects(true);
        console.log('Projects fetched');

        toast({
          title: "Projekt hochgeladen",
          description: "Das Projekt wurde erfolgreich hochgeladen.",
        });

    } catch(error: any) {
        console.error("Error saving new project:", error);
        const errorMessage = error?.message || "Das neue Projekt konnte nicht gespeichert werden.";
        toast({
          title: "Fehler beim Upload",
          description: errorMessage,
          variant: "destructive",
        });
        // Stelle sicher, dass der Loading-State zurückgesetzt wird
        setIsProjectsLoading(false);
    } finally {
        console.log('handleFileUploaded completed');
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
            <Tabs defaultValue="viewer" className="w-full h-full flex flex-col">
              <TabsList className="grid w-full max-w-md grid-cols-2 mb-2">
                <TabsTrigger value="viewer"><Layers className="w-4 h-4 mr-2" />Viewer</TabsTrigger>
                <TabsTrigger value="comparison"><GitCompare className="w-4 h-4 mr-2" />Projektvergleich</TabsTrigger>
              </TabsList>
              <TabsContent value="viewer" className="flex-1 flex flex-col min-h-0 mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                  <div className="lg:col-span-2 h-full min-h-[400px] lg:min-h-0">
                    <IfcViewer 
                      key={activeProject.id} 
                      ifcContent={activeProject.fileContent ?? null} 
                      ifcUrl={activeProject.fileUrl ?? null}
                      ifcStoragePath={activeProject.fileStoragePath ?? null}
                    />
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
                          onRunAnalysis={() => runAnalysis(activeProject)}
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
              </TabsContent>
              <TabsContent value="comparison" className="flex-1 overflow-y-auto mt-0 pt-0">
                <ProjectComparison
                  projects={projects.filter(p => p.analysisData)}
                  projectA={comparisonProjectA}
                  projectB={comparisonProjectB}
                  onSelectProjectA={setComparisonProjectA}
                  onSelectProjectB={setComparisonProjectB}
                />
              </TabsContent>
            </Tabs>
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

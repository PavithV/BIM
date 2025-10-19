"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, serverTimestamp, query, orderBy, doc, getDocs, setDoc, getDoc } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileUploader } from '@/components/file-uploader';
import { ModelViewer } from '@/components/model-viewer';
import { AnalysisPanel } from '@/components/analysis-panel';
import { ChatAssistant } from '@/components/chat-assistant';
import { Building, Bot, BarChart3, Menu, LogOut, PanelLeft } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { getStartingPrompts, getAIChatFeedback } from '@/app/actions';
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { ProjectSelector } from './project-selector';
import type { IFCModel } from '@/lib/types';
import { cn } from '@/lib/utils';


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

  const auth = useAuth();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();

  const messagesRef = useMemoFirebase(() => {
    if (!user || !firestore || !activeProject) return null;
    return collection(firestore, 'users', user.uid, 'ifcModels', activeProject.id, 'messages');
  }, [user, firestore, activeProject]);

  const messagesQuery = useMemoFirebase(() => {
    if (!messagesRef) return null;
    return query(messagesRef, orderBy('createdAt', 'asc'));
  }, [messagesRef]);

  const { data: activeMessages, isLoading: messagesLoading } = useCollection<Message>(messagesQuery);
  
  useEffect(() => {
    async function fetchPrompts() {
      const result = await getStartingPrompts();
      if (result.prompts) {
        setStartingPrompts(result.prompts);
      }
    }
    fetchPrompts();
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    setActiveProject(null);
    router.push('/login');
  };

  const handleSendMessage = async (userQuestion: string) => {
    if (!userQuestion.trim() || !activeProject?.fileContent || !messagesRef) return;

    const userMessage: Omit<Message, 'id'> = {
      role: 'user',
      content: userQuestion,
      createdAt: serverTimestamp(),
    };
    
    setIsLoading(true);

    try {
      await addDoc(messagesRef, userMessage);
      
      const result = await getAIChatFeedback({
        ifcModelData: activeProject.fileContent,
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
        
        let errorMessageContent = 'Das KI-Feedback konnte nicht abgerufen werden. Der API-Schlüssel könnte ungültig sein oder das Modell ist überlastet. Bitte versuchen Sie es später erneut.';

        if (error.message) {
            if (error.message.includes("API key not valid") || error.message.includes("permission denied")) {
                errorMessageContent = "Das KI-Feedback konnte nicht abgerufen werden. Ihr API-Schlüssel ist ungültig. Bitte überprüfen Sie Ihren Schlüssel im .env File und in der Google AI Studio Konsole.";
            } else if (error.message.includes("Billing account")) {
                errorMessageContent = "Das KI-Feedback konnte nicht abgerufen werden. Für Ihr Google Cloud Projekt ist kein Abrechnungskonto aktiviert. Bitte fügen Sie eines in der Google Cloud Console hinzu, um die KI-Dienste zu nutzen.";
            } else if (error.message.includes("API not enabled")) {
                errorMessageContent = "Das KI-Feedback konnte nicht abgerufen werden. Die 'Generative Language API' ist für Ihr Projekt nicht aktiviert. Bitte aktivieren Sie sie in der Google Cloud Console.";
            } else if (error.message.includes("Content creation is blocked")) {
                errorMessageContent = 'Ihre Anfrage wurde aufgrund unserer Sicherheitsrichtlinien blockiert. Bitte versuchen Sie es mit einer anderen Anfrage.';
            } else if (error.message.includes("model is overloaded")) {
                 errorMessageContent = "Der KI-Dienst ist derzeit überlastet. Bitte versuchen Sie es später erneut.";
            }
        }

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
    
    setIsLoading(true);
    try {
        const newProjectRef = doc(collection(firestore, 'users', user.uid, 'ifcModels'));
        const newProject: IFCModel = {
            id: newProjectRef.id,
            userId: user.uid,
            fileName: file.name,
            fileSize: file.size,
            fileContent: fileContent,
            uploadDate: serverTimestamp(),
        }
        await setDoc(newProjectRef, newProject);
        setActiveProject(newProject);
    } catch(error) {
        console.error("Error saving new project:", error);
    } finally {
        setIsLoading(false);
    }
  };

  const resetProject = () => {
    setActiveProject(null);
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
                <ProjectSelector onSelectProject={(p) => { setActiveProject(p); if (window.innerWidth < 768) setSidebarOpen(false); }} onUploadNew={handleFileUploaded} activeProjectId={activeProject?.id} />
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
                <ModelViewer ifcModel={activeProject} />
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
                      <AnalysisPanel onExport={() => alert('Materialpass wird exportiert...')} />
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

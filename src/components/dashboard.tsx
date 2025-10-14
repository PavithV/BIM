"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, serverTimestamp, query, orderBy, doc, getDocs, setDoc, getDoc } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileUploader } from '@/components/file-uploader';
import { ModelViewer } from '@/components/model-viewer';
import { AnalysisPanel } from '@/components/analysis-panel';
import { ChatAssistant } from '@/components/chat-assistant';
import { Building, Bot, BarChart3, Menu, LogOut } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { getStartingPrompts, getAIChatFeedback } from '@/app/actions';
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { ProjectSelector } from './project-selector';
import type { IFCModel } from '@/lib/types';


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

    } catch (error) {
      console.error("Error in handleSendMessage flow:", error);
       const errorMessage: Omit<Message, 'id'> = {
        role: 'assistant',
        content: 'Ein unerwarteter Fehler ist aufgetreten beim Senden der Nachricht.',
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
    <header className="flex items-center justify-between p-4 border-b bg-card shadow-sm">
      <div className="flex items-center gap-3">
        <Building className="w-8 h-8 text-primary" />
        <h1 className="text-xl md:text-2xl font-bold font-headline text-primary">BIMCoach Studio</h1>
      </div>
      <div className="hidden md:flex items-center gap-4">
        <span className="text-sm text-muted-foreground">{user?.email}</span>
        {activeProject && (
          <Button variant="outline" onClick={resetProject}>Projektauswahl</Button>
        )}
        <Button variant="ghost" size="icon" onClick={handleSignOut} title="Abmelden">
          <LogOut className="w-5 h-5" />
        </Button>
      </div>
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu />
              <span className="sr-only">Menü öffnen</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full p-0 flex flex-col">
            <SheetHeader className="p-4 border-b">
                <SheetTitle>
                    <div className="flex items-center gap-3">
                        <Building className="w-8 h-8 text-primary" />
                        <span className="text-xl font-bold font-headline text-primary">BIMCoach Studio</span>
                    </div>
                </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-4">
              {activeProject ? (
                <>
                <div className="mb-4">
                   <h2 className="font-semibold">{activeProject.fileName}</h2>
                   <p className="text-sm text-muted-foreground">{(activeProject.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <Tabs defaultValue="analysis" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="analysis"><BarChart3 className="w-4 h-4 mr-2" />Analyse</TabsTrigger>
                    <TabsTrigger value="coach"><Bot className="w-4 h-4 mr-2" />KI-Coach</TabsTrigger>
                  </TabsList>
                  <TabsContent value="analysis" className="mt-4">
                    <AnalysisPanel onExport={() => alert('Materialpass wird exportiert...')} />
                  </TabsContent>
                  <TabsContent value="coach" className="mt-4 h-[calc(100vh-300px)]">
                    <ChatAssistant 
                      messages={memoizedMessages}
                      startingPrompts={startingPrompts}
                      isLoading={isLoading || messagesLoading}
                      onSendMessage={handleSendMessage}
                    />
                  </TabsContent>
                </Tabs>
                </>
              ) : (
                <div className="pt-10">
                    <ProjectSelector onSelectProject={setActiveProject} onUploadNew={handleFileUploaded} />
                </div>
              )}
            </div>
            <div className="p-4 border-t space-y-2">
                {activeProject && <Button variant="outline" onClick={resetProject} className="w-full">Projektauswahl</Button>}
                <Button variant="outline" onClick={handleSignOut} className="w-full">
                  <LogOut className="mr-2 h-4 w-4" />
                  Abmelden
                </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />
      <main className="flex-1 overflow-hidden">
        {activeProject ? (
          <div className="flex h-full">
            <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
              <ModelViewer file={new File([], activeProject.fileName)} />
            </div>
            <div className="hidden md:flex flex-col w-[400px] lg:w-[450px] border-l bg-card h-full">
              <div className="p-4 lg:p-6 border-b">
                <h2 className="font-semibold font-headline truncate" title={activeProject.fileName}>{activeProject.fileName}</h2>
                <p className="text-sm text-muted-foreground">{(activeProject.fileSize / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <Tabs defaultValue="analysis" className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 lg:px-6 pt-4">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="analysis">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Analyse
                        </TabsTrigger>
                        <TabsTrigger value="coach">
                        <Bot className="w-4 h-4 mr-2" />
                        KI-Coach
                        </TabsTrigger>
                    </TabsList>
                </div>
                <TabsContent value="analysis" className="flex-1 overflow-y-auto p-4 lg:p-6">
                  <AnalysisPanel onExport={() => alert('Materialpass wird exportiert...')} />
                </TabsContent>
                <TabsContent value="coach" className="flex-1 flex flex-col m-0 overflow-hidden">
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
          <div className="flex items-center justify-center h-full p-4">
            <ProjectSelector onSelectProject={setActiveProject} onUploadNew={handleFileUploaded} />
          </div>
        )}
      </main>
    </div>
  );
}

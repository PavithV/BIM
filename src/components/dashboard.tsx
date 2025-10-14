"use client";

import { useState, useEffect, useMemo } from 'react';
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
import { Timestamp, collection, addDoc, orderBy, query } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Timestamp;
};

export default function Dashboard() {
  const [ifcFile, setIfcFile] = useState<File | null>(null);
  const [ifcData, setIfcData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [startingPrompts, setStartingPrompts] = useState<string[]>([]);
  
  const auth = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const firestore = useFirestore();

  const messagesRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'messages');
  }, [user, firestore]);

  const messagesQuery = useMemoFirebase(() => {
    if (!messagesRef) return null;
    return query(messagesRef, orderBy('createdAt', 'asc'));
  }, [messagesRef]);

  const { data: messages, isLoading: messagesLoading } = useCollection<Message>(messagesQuery);

  const [activeMessages, setActiveMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (messages) {
      setActiveMessages(messages);
    }
  }, [messages]);


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
    router.push('/login');
  };

  const handleSendMessage = async (userQuestion: string) => {
    if (!userQuestion.trim() || !ifcData || !messagesRef) return;
  
    const newUserMessage: Omit<Message, 'id'> = {
      role: 'user',
      content: userQuestion,
      createdAt: Timestamp.now(),
    };
    
    addDocumentNonBlocking(messagesRef, newUserMessage);
    setIsLoading(true);
  
    try {
      const result = await getAIChatFeedback({
        ifcModelData: ifcData,
        userQuestion: userQuestion,
      });
  
      const assistantMessageContent = result.feedback || result.error || 'Entschuldigung, ein Fehler ist aufgetreten.';
      
      const newAssistantMessage: Omit<Message, 'id'> = {
        role: 'assistant',
        content: assistantMessageContent,
        createdAt: Timestamp.now(),
      };
      addDocumentNonBlocking(messagesRef, newAssistantMessage);

    } catch (error) {
      console.error("Error in handleSendMessage flow:", error);
      const errorMessage: Omit<Message, 'id'> = {
        role: 'assistant',
        content: 'Ein unerwarteter Fehler ist aufgetreten.',
        createdAt: Timestamp.now(),
      };
      addDocumentNonBlocking(messagesRef, errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUploaded = (file: File, data: string) => {
    setIfcFile(file);
    setIfcData(data);
    setActiveMessages([]); // Reset chat when a new file is uploaded
  };

  const resetProject = () => {
    setIfcFile(null);
    setIfcData(null);
    setActiveMessages([]);
  };

  const Header = () => (
    <header className="flex items-center justify-between p-4 border-b bg-card shadow-sm">
      <div className="flex items-center gap-3">
        <Building className="w-8 h-8 text-primary" />
        <h1 className="text-xl md:text-2xl font-bold font-headline text-primary">BIMCoach Studio</h1>
      </div>
      <div className="hidden md:flex items-center gap-4">
        <span className="text-sm text-muted-foreground">{user?.email}</span>
        {ifcFile && (
          <Button variant="outline" onClick={resetProject}>Neues Projekt</Button>
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
              {ifcFile ? (
                <>
                <div className="mb-4">
                   <h2 className="font-semibold">{ifcFile.name}</h2>
                   <p className="text-sm text-muted-foreground">{(ifcFile.size / 1024 / 1024).toFixed(2)} MB</p>
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
                      messages={activeMessages}
                      startingPrompts={startingPrompts}
                      isLoading={isLoading || messagesLoading}
                      onSendMessage={handleSendMessage}
                    />
                  </TabsContent>
                </Tabs>
                </>
              ) : (
                <div className="pt-10">
                    <FileUploader onFileUploaded={handleFileUploaded} />
                </div>
              )}
            </div>
            <div className="p-4 border-t space-y-2">
                {ifcFile && <Button variant="outline" onClick={resetProject} className="w-full">Neues Projekt</Button>}
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
        {ifcFile ? (
          <div className="flex h-full">
            <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
              <ModelViewer file={ifcFile} />
            </div>
            <div className="hidden md:flex flex-col w-[400px] lg:w-[450px] border-l bg-card h-full">
              <div className="p-4 lg:p-6 border-b">
                <h2 className="font-semibold font-headline truncate" title={ifcFile.name}>{ifcFile.name}</h2>
                <p className="text-sm text-muted-foreground">{(ifcFile.size / 1024 / 1024).toFixed(2)} MB</p>
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
                      messages={activeMessages}
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
            <FileUploader onFileUploaded={handleFileUploaded} />
          </div>
        )}
      </main>
    </div>
  );
}

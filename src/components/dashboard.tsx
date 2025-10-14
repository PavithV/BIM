"use client";

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileUploader } from '@/components/file-uploader';
import { ModelViewer } from '@/components/model-viewer';
import { AnalysisPanel } from '@/components/analysis-panel';
import { ChatAssistant } from '@/components/chat-assistant';
import { Building, Bot, BarChart3, Menu } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { getStartingPrompts, getAIChatFeedback } from '@/app/actions';

export type Message = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
};

export default function Dashboard() {
  const [ifcFile, setIfcFile] = useState<File | null>(null);
  const [ifcData, setIfcData] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [startingPrompts, setStartingPrompts] = useState<string[]>([]);
  
  useEffect(() => {
    async function fetchPrompts() {
      const result = await getStartingPrompts();
      if (result.prompts) {
        setStartingPrompts(result.prompts);
      }
    }
    fetchPrompts();
  }, []);

  const handleSendMessage = async (userQuestion: string) => {
    if (!userQuestion.trim() || !ifcData) return;

    const newUserMessage: Message = { id: Date.now(), role: 'user', content: userQuestion };
    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);

    const result = await getAIChatFeedback({
      ifcModelData: ifcData,
      userQuestion: userQuestion,
    });

    setIsLoading(false);

    if (result.feedback) {
      const newAssistantMessage: Message = { id: Date.now() + 1, role: 'assistant', content: result.feedback };
      setMessages(prev => [...prev, newAssistantMessage]);
    } else {
      const errorMessage: Message = { id: Date.now() + 1, role: 'assistant', content: result.error || 'Entschuldigung, ein Fehler ist aufgetreten.' };
      setMessages(prev => [...prev, errorMessage]);
    }
  };


  const handleFileUploaded = (file: File, data: string) => {
    setIfcFile(file);
    setIfcData(data);
    setMessages([]);
  };

  const resetProject = () => {
    setIfcFile(null);
    setIfcData(null);
    setMessages([]);
  };

  const Header = () => (
    <header className="flex items-center justify-between p-4 border-b bg-card shadow-sm">
      <div className="flex items-center gap-3">
        <Building className="w-8 h-8 text-primary" />
        <h1 className="text-xl md:text-2xl font-bold font-headline text-primary">BIMCoach Studio</h1>
      </div>
      <div className="hidden md:flex items-center gap-4">
        {ifcFile && (
          <Button variant="outline" onClick={resetProject}>Neues Projekt</Button>
        )}
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
                      messages={messages}
                      startingPrompts={startingPrompts}
                      isLoading={isLoading}
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
            <div className="p-4 border-t">
                {ifcFile && <Button variant="outline" onClick={resetProject} className="w-full">Neues Projekt</Button>}
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
                      messages={messages}
                      startingPrompts={startingPrompts}
                      isLoading={isLoading}
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

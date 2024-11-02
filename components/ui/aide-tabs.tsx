import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

interface AideTabsProps {
  activeTab: "threads" | "messages" | "models";
  setActiveTab: (tab: "threads" | "messages" | "models") => void;
  renderThreadsList: () => React.ReactNode;
  renderMessages: () => React.ReactNode;
  renderModelConfig: () => React.ReactNode;
}

const AideTabs: React.FC<AideTabsProps> = ({
  activeTab,
  setActiveTab,
  renderThreadsList,
  renderMessages,
  renderModelConfig,
}) => {
  return (
    <div className="h-screen flex flex-col md:flex-row p-2 overflow-hidden ">
      <div className="sm:hidden bg-transparent">
        {/* Mobile layout with tabs for threads, messages, and models */}
        <Tabs
          value={activeTab}
          onValueChange={(value) =>
            setActiveTab(value as "threads" | "messages" | "models")
          }
          className="w-full flex flex-col"
        >
          <TabsContent
            value="threads"
            className="overflow-y-clip fixed top-0 left-2 right-2 pb-20"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            {renderThreadsList()}
          </TabsContent>
          <TabsContent
            value="messages"
            className="overflow-y-clip fixed top-0 left-2 right-2 pb-20"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            {renderMessages()}
          </TabsContent>
          <TabsContent
            value="models"
            className="overflow-y-clip fixed top-0 left-2 right-2 pb-20"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            {renderModelConfig()}
          </TabsContent>
          <TabsList
            className="grid 
              bg-transparent
              custom-shadow
              w-full 
              fixed 
              bottom-0 
              left-0 
              right-0 
              pb-14 
              grid-cols-3
              select-none"
          >
            <TabsTrigger
              value="threads"
              className="bg-transparent hover:bg-secondary hover:custom-shadow data-[state=active]:bg-muted"
            >
              Threads
            </TabsTrigger>
            <TabsTrigger
              value="messages"
              className="bg-transparent hover:bg-secondary hover:custom-shadow data-[state=active]:bg-muted"
            >
              Messages
            </TabsTrigger>
            <TabsTrigger
              value="models"
              className="bg-transparent hover:bg-secondary hover:custom-shadow data-[state=active]:bg-muted"
            >
              Models
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div
        className="hidden sm:block w-full h-full"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
        }}
      >
        {/* Desktop layout with resizable panels */}
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={31} minSize={26} maxSize={50}>
            <Tabs
              value={activeTab}
              onValueChange={(value) =>
                setActiveTab(value as "threads" | "models")
              }
              className="w-full flex flex-col"
            >
              <TabsList className="grid w-full grid-cols-2 bg-transparent custom-shadow select-none">
                <TabsTrigger
                  className="bg-transparent transition-scale-zoom hover:bg-secondary hover:custom-shadow data-[state=active]:bg-background"
                  value="threads"
                >
                  Threads
                </TabsTrigger>
                <TabsTrigger
                  className="bg-transparent transition-scale-zoom hover:bg-secondary hover:custom-shadow data-[state=active]:bg-background"
                  value="models"
                >
                  Models
                </TabsTrigger>
              </TabsList>
              <TabsContent
                value="threads"
                className="flex-grow overflow-y-clip"
              >
                {renderThreadsList()}
              </TabsContent>
              <TabsContent value="models" className="flex-grow overflow-y-clip">
                {renderModelConfig()}
              </TabsContent>
            </Tabs>
          </ResizablePanel>
          <ResizableHandle className="mx-2 p-px bg-gradient-to-b from-background via-transparent to-background" />
          <ResizablePanel defaultSize={69}>
            <div className="h-full overflow-y-auto">{renderMessages()}</div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default AideTabs;
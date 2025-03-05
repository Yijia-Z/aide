import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Code, X, Copy, Check, View, LayoutPanelLeft, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { gruvboxDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReactDOM from "react-dom";

interface HTMLPreviewProps {
  htmlContent: string;
}

const HTMLPreview: React.FC<HTMLPreviewProps> = ({ htmlContent }) => {
  const [showPopup, setShowPopup] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("preview");
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // Mount check for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Handle escape key to close popup
  useEffect(() => {
    if (!showPopup) return;

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowPopup(false);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showPopup]);

  // Preprocess HTML to ensure scripts run
  const preprocessHtml = (html: string): string => {
    // Add necessary meta tags and ensure doctype if not present
    if (!html.includes('<!DOCTYPE')) {
      html = `<!DOCTYPE html>${html}`;
    }

    if (!html.includes('<html')) {
      html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${html}</body></html>`;
    }

    return html;
  };

  // Set iframe content
  useEffect(() => {
    if (showPopup && iframeRef.current && activeTab === "preview") {
      const iframe = iframeRef.current;

      // Using onload to ensure scripts run properly
      iframe.onload = () => {
        const iframeWindow = iframe.contentWindow;
        const iframeDocument = iframe.contentDocument || iframeWindow?.document;

        if (iframeDocument && iframeWindow) {
          try {
            // Add base target to open links in new tabs
            if (iframeDocument.head) {
              const baseTag = iframeDocument.createElement('base');
              baseTag.target = '_blank';
              iframeDocument.head.appendChild(baseTag);
            }

            // Helper function to ensure canvas elements are properly initialized
            const initializeCanvasElements = () => {
              const canvasElements = iframeDocument.getElementsByTagName('canvas');
              for (let i = 0; i < canvasElements.length; i++) {
                const canvas = canvasElements[i];
                // Ensure canvas has proper dimensions if not specified
                if (!canvas.hasAttribute('width')) {
                  canvas.width = canvas.clientWidth || 300;
                }
                if (!canvas.hasAttribute('height')) {
                  canvas.height = canvas.clientHeight || 150;
                }
              }
            };

            // Create a function in the iframe to evaluate scripts with proper scope
            // Use Function constructor instead of eval for type safety
            const runScriptFunc = new Function('window', `
              window.runScript = function(scriptContent) {
                try {
                  eval(scriptContent);
                } catch(e) {
                  console.error('Error executing script:', e);
                }
              }

              // Add a safe getContext helper to the window
              window.safeGetCanvasContext = function(canvasId, contextType) {
                const canvas = document.getElementById(canvasId);
                if (!canvas) {
                  console.warn('Canvas element not found:', canvasId);
                  return null;
                }
                try {
                  return canvas.getContext(contextType || '2d');
                } catch (e) {
                  console.error('Error getting canvas context:', e);
                  return null;
                }
              }
            `);
            runScriptFunc(iframeWindow);

            // Re-evaluate all scripts to ensure they run in the iframe's context
            const scriptElements = iframeDocument.getElementsByTagName('script');
            for (let i = 0; i < scriptElements.length; i++) {
              const script = scriptElements[i];

              if (script.src) {
                // For external scripts, create a new script element
                const newScript = iframeDocument.createElement('script');
                Array.from(script.attributes).forEach(attr => {
                  newScript.setAttribute(attr.name, attr.value);
                });

                // Add error handling to script loading
                newScript.onerror = (e) => {
                  console.error('Error loading external script:', e);
                };

                // Ensure script is loaded after DOM is ready
                const appendScript = () => {
                  if (script.parentNode) {
                    script.parentNode.replaceChild(newScript, script);
                  }
                };

                // Check if DOM is already loaded
                if (iframeDocument.readyState === 'complete' ||
                  iframeDocument.readyState === 'interactive') {
                  setTimeout(() => {
                    initializeCanvasElements();
                    appendScript();
                  }, 50);
                } else {
                  iframeDocument.addEventListener('DOMContentLoaded', () => {
                    setTimeout(() => {
                      initializeCanvasElements();
                      appendScript();
                    }, 50);
                  });
                }
              } else if (script.textContent) {
                // For inline scripts, use Function constructor instead of runScript
                try {
                  // Wrap the script execution in a setTimeout to ensure the DOM is fully rendered
                  // and use DOMContentLoaded check to ensure all elements are available
                  const scriptContent = script.textContent;
                  const executeScript = () => {
                    try {
                      const scriptFunction = new Function(scriptContent);
                      scriptFunction.call(iframeWindow);
                    } catch (e) {
                      console.error('Error executing inline script:', e);
                    }
                  };

                  // Check if DOM is already loaded, otherwise wait for it
                  if (iframeDocument.readyState === 'complete' ||
                    iframeDocument.readyState === 'interactive') {
                    setTimeout(() => {
                      initializeCanvasElements();
                      executeScript();
                    }, 50); // Small delay to ensure DOM is fully processed
                  } else {
                    iframeDocument.addEventListener('DOMContentLoaded', () => {
                      setTimeout(() => {
                        initializeCanvasElements();
                        executeScript();
                      }, 50);
                    });
                  }
                } catch (e) {
                  console.error('Error setting up inline script execution:', e);
                }
              }
            }
          } catch (err) {
            console.error('Error setting up iframe scripts:', err);
          }
        }
      };

      // Preprocess and write the content to the iframe
      try {
        const processedHtml = preprocessHtml(htmlContent);
        const iframeDocument = iframe.contentDocument || iframe.contentWindow?.document;

        if (iframeDocument) {
          iframeDocument.open();
          iframeDocument.write(processedHtml);
          iframeDocument.close();
        }
      } catch (err) {
        console.error('Error writing to iframe:', err);
      }
    }
  }, [showPopup, htmlContent, activeTab]);

  // Handle copy code
  const handleCopyCode = () => {
    navigator.clipboard.writeText(htmlContent);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  // Calculate a preview snippet (first 50 chars)
  const htmlPreview = htmlContent.length > 50
    ? htmlContent.substring(0, 50) + "..."
    : htmlContent;

  // Render the popup in a portal to ensure it's not constrained by parent elements
  const renderPopup = () => {
    if (!mounted || !showPopup) return null;

    return ReactDOM.createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
        <div
          ref={popupRef}
          className={cn(
            "bg-background shadow-lg flex flex-col",
            isFullscreen
              ? "fixed inset-0 w-full h-full rounded-none z-[200]"
              : "w-[80vw] h-[80vh] max-w-6xl rounded-lg"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center p-4 border-b">
            <h3 className="font-semibold">HTML Content</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyCode}
                className="flex items-center gap-1 p-2 h-8"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                <span>Copy HTML</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1 h-8 w-8"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowPopup(false);
                  setIsFullscreen(false);
                }}
                className="p-1 h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="px-4 pt-2">
              <TabsList className="grid grid-cols-2 w-[200px]">
                <TabsTrigger value="preview" className="flex items-center gap-1">
                  <View className="h-4 w-4" />
                  <span>Preview</span>
                </TabsTrigger>
                <TabsTrigger value="source" className="flex items-center gap-1">
                  <LayoutPanelLeft className="h-4 w-4" />
                  <span>Source</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 p-4 overflow-hidden">
              <TabsContent value="preview" className="h-full m-0 p-0">
                <iframe
                  ref={iframeRef}
                  className="w-full h-full rounded border border-border"
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-pointer-lock"
                  title="HTML Preview"
                  style={{ backgroundColor: 'white' }}
                />
              </TabsContent>

              <TabsContent value="source" className="h-full m-0 p-0 overflow-auto">
                <div className="relative rounded border border-border h-full">
                  <SyntaxHighlighter
                    language="html"
                    style={gruvboxDark}
                    customStyle={{
                      margin: 0,
                      height: '100%',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                    showLineNumbers
                    wrapLines
                    wrapLongLines
                  >
                    {htmlContent}
                  </SyntaxHighlighter>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <span className="inline-block">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowPopup(true)}
        className="flex items-center gap-1 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950 dark:hover:bg-amber-900 border-amber-200 dark:border-amber-800"
      >
        <Code className="h-4 w-4" />
        <span>HTML</span>
      </Button>

      {renderPopup()}
    </span>
  );
};

export default HTMLPreview;
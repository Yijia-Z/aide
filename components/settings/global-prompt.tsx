import React, { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BookPlus, Check, Edit, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PromptCombobox } from "./prompt-combobox";
import { motion } from "framer-motion";

interface GlobalPromptProps {
  globalPrompt: string | null;
  saveGlobalPrompt: (prompt: string) => void;
  isSignedIn: boolean;
}

export function GlobalPrompt({ globalPrompt, saveGlobalPrompt, isSignedIn }: GlobalPromptProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [promptText, setPromptText] = useState(globalPrompt || "");
  const [savedPrompts, setSavedPrompts] = useState<{ label: string; value: string }[]>([
    { label: "Default Assistant", value: "You are a helpful, harmless, and honest AI assistant." },
    { label: "Code Assistant", value: "You are a code assistant. Help the user write and debug code. Provide explanations when needed." },
    { label: "Math Tutor", value: "You are a math tutor. Help the user understand mathematical concepts and solve problems." },
  ]);
  const [selectedPrompt, setSelectedPrompt] = useState<string>("");
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");

  useEffect(() => {
    if (globalPrompt) {
      setPromptText(globalPrompt);
    }
  }, [globalPrompt]);

  // Load saved templates from localStorage
  useEffect(() => {
    const savedTemplatesJson = localStorage.getItem("globalPromptTemplates");
    if (savedTemplatesJson) {
      try {
        const templates = JSON.parse(savedTemplatesJson);
        if (Array.isArray(templates) && templates.length > 0) {
          setSavedPrompts(prev => {
            // Combine default templates with saved ones, avoiding duplicates
            const combinedPrompts = [...prev];
            templates.forEach(template => {
              if (!combinedPrompts.some(p => p.label === template.label)) {
                combinedPrompts.push(template);
              }
            });
            return combinedPrompts;
          });
        }
      } catch (e) {
        console.error("Error loading saved prompt templates:", e);
      }
    }
  }, []);

  const handlePromptSelection = (value: string) => {
    const selectedPromptObj = savedPrompts.find(p => p.value === value);
    if (selectedPromptObj) {
      setPromptText(selectedPromptObj.value);
    }
    setSelectedPrompt(value);
  };

  const handleSavePrompt = () => {
    saveGlobalPrompt(promptText);
    setIsEditing(false);
  };

  const handleAddTemplate = () => {
    if (newTemplateName.trim() && promptText.trim()) {
      const newTemplate = {
        label: newTemplateName.trim(),
        value: promptText.trim()
      };

      setSavedPrompts(prev => {
        const updatedPrompts = [...prev, newTemplate];
        // Save to localStorage
        localStorage.setItem("globalPromptTemplates", JSON.stringify(
          updatedPrompts.filter(p =>
            !["Default Assistant", "Code Assistant", "Math Tutor"].includes(p.label)
          )
        ));
        return updatedPrompts;
      });

      setSelectedPrompt(newTemplate.value);
      setNewTemplateName("");
      setIsAddingTemplate(false);
    }
  };

  const handleDeleteTemplate = (value: string) => {
    setSavedPrompts(prev => {
      const updatedPrompts = prev.filter(p => p.value !== value);
      // Save to localStorage
      localStorage.setItem("globalPromptTemplates", JSON.stringify(
        updatedPrompts.filter(p =>
          !["Default Assistant", "Code Assistant", "Math Tutor"].includes(p.label)
        )
      ));
      return updatedPrompts;
    });

    // If the deleted template was selected, reset selection
    if (selectedPrompt === value) {
      setSelectedPrompt("");
    }
  };

  return (
    <motion.div
      key="global-prompt"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={isEditing ? undefined : { y: -2 }}
      className={`group p-2 rounded-lg mb-2 ${isEditing
        ? "custom-shadow"
        : "md:hover:shadow-[inset_0_0_10px_10px_rgba(128,128,128,0.2)] bg-background cursor-pointer"
        }`}
      onDoubleClick={() => {
        if (isSignedIn && !isEditing) {
          setIsEditing((prev) => !prev);
        }
      }}
    >
      <div>
        <div className="flex cursor-pointer justify-between items-start">
          <h3 className="font-bold text-xl">Global Prompt</h3>
          {isSignedIn && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              className="md:opacity-0 md:group-hover:opacity-100 transition-opacity"
            >
              {isEditing ? <Check className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
            </Button>
          )}
        </div>

        {isSignedIn && (
          <div className="mt-2">
            {isEditing ? (
              <div className="space-y-2">
                <div className="pb-1 flex justify-between items-center">
                  <Label>Template</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddingTemplate(!isAddingTemplate)}
                    className="text-xs"
                  >
                    {isAddingTemplate ? (
                      <X className="h-4 w-4 " />
                    ) : (
                      <BookPlus className="h-4 w-4" />
                    )}
                    <span className="hidden md:inline">
                      {isAddingTemplate ? "Cancel" : "Add Template"}
                    </span>
                  </Button>
                </div>
                {isAddingTemplate ? (
                  <div className="space-y-2">
                    <Input
                      placeholder="Template name"
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      className="w-full"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddTemplate}
                      className="w-full"
                      disabled={!newTemplateName.trim() || !promptText.trim()}
                    >
                      Save Template
                    </Button>
                  </div>
                ) : (
                  <PromptCombobox
                    options={savedPrompts}
                    value={selectedPrompt}
                    onValueChange={handlePromptSelection}
                    onDeleteOption={handleDeleteTemplate}
                    placeholder="Select a template"
                  />
                )}
                <div className="pt-2 pb-1">
                  <Label>Prompt</Label>
                </div>
                <Textarea
                  className="min-font-size text-foreground min-h-[200px]"
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="Enter a global prompt that will be included at the beginning of all system prompts"
                />
                <div className="flex justify-end mt-2">
                  <Button variant="outline" size="sm" onClick={handleSavePrompt}>
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-sm">
                {globalPrompt ? (
                  <div className="text-muted-foreground border rounded-md p-2 line-clamp-2">
                    {globalPrompt}
                  </div>
                ) : (
                  <span className="text-muted-foreground italic">
                    No global prompt set. Double-click or click Edit to add one.
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {!isSignedIn && (
          <div className="text-muted-foreground flex items-center gap-2 mt-2">
            <Lock className="h-4 w-4" />
            Sign in to set global prompt
          </div>
        )}
      </div>
    </motion.div>
  );
}
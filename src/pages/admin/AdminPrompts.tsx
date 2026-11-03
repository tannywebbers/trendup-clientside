import { useState, useEffect } from "react";
import { 
  MessageSquare, 
  Edit, 
  Save,
  Loader2,
  Check,
  X,
  Plus,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AIPrompt {
  id: string;
  task_type: string;
  prompt_name: string;
  prompt_content: string;
  is_active: boolean;
  confidence_threshold: number;
  created_at: string;
  updated_at: string;
}

const taskTypeColors: Record<string, string> = {
  like: "bg-red-500/10 text-red-400 border-red-500/20",
  comment: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  save: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  follow: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  combo_mini: "bg-gradient-to-r from-red-500/10 via-blue-500/10 to-yellow-500/10 text-neutral-100 border-neutral-500/20",
  combo_large: "bg-gradient-to-r from-red-500/10 via-blue-500/10 via-yellow-500/10 to-purple-500/10 text-neutral-100 border-neutral-500/20",
};

const taskTypeIcons: Record<string, string> = {
  like: "❤️",
  comment: "💬",
  save: "🔖",
  follow: "👤",
  combo_mini: "📦",
  combo_large: "🎁",
};

const ALL_TASK_TYPES = ["like", "comment", "save", "follow", "combo_mini", "combo_large"];

export default function AdminPrompts() {
  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPrompt, setEditingPrompt] = useState<AIPrompt | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newPrompt, setNewPrompt] = useState({
    task_type: "",
    prompt_name: "",
    prompt_content: "",
    confidence_threshold: 70,
  });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("ai_prompts")
        .select("*")
        .order("task_type");

      if (error) throw error;
      setPrompts(data || []);
    } catch (error) {
      console.error("Error fetching prompts:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to load prompts." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (prompt: AIPrompt) => {
    try {
      const { error } = await supabase
        .from("ai_prompts")
        .update({ is_active: !prompt.is_active })
        .eq("id", prompt.id);

      if (error) throw error;

      setPrompts(prev =>
        prev.map(p => (p.id === prompt.id ? { ...p, is_active: !p.is_active } : p))
      );

      toast({ title: "Updated", description: `Prompt ${!prompt.is_active ? "activated" : "deactivated"}.` });
    } catch (error) {
      console.error("Error toggling prompt:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to update prompt." });
    }
  };

  const handleSavePrompt = async () => {
    if (!editingPrompt) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("ai_prompts")
        .update({
          prompt_name: editingPrompt.prompt_name,
          prompt_content: editingPrompt.prompt_content,
          confidence_threshold: editingPrompt.confidence_threshold,
        })
        .eq("id", editingPrompt.id);

      if (error) throw error;

      setPrompts(prev =>
        prev.map(p => (p.id === editingPrompt.id ? editingPrompt : p))
      );
      setEditingPrompt(null);

      toast({ title: "Saved", description: "Prompt updated successfully." });
    } catch (error) {
      console.error("Error saving prompt:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to save prompt." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddPrompt = async () => {
    if (!newPrompt.task_type || !newPrompt.prompt_name || !newPrompt.prompt_content) {
      toast({ variant: "destructive", title: "Error", description: "Please fill in all fields." });
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from("ai_prompts")
        .insert({
          task_type: newPrompt.task_type,
          prompt_name: newPrompt.prompt_name,
          prompt_content: newPrompt.prompt_content,
          confidence_threshold: newPrompt.confidence_threshold,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setPrompts(prev => [...prev, data]);
      setIsAddingNew(false);
      setNewPrompt({ task_type: "", prompt_name: "", prompt_content: "", confidence_threshold: 70 });

      toast({ title: "Added", description: "New prompt created successfully." });
    } catch (error) {
      console.error("Error adding prompt:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to add prompt." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePrompt = async (prompt: AIPrompt) => {
    if (!confirm(`Delete prompt "${prompt.prompt_name}"?`)) return;

    try {
      const { error } = await supabase
        .from("ai_prompts")
        .delete()
        .eq("id", prompt.id);

      if (error) throw error;

      setPrompts(prev => prev.filter(p => p.id !== prompt.id));
      toast({ title: "Deleted", description: "Prompt removed." });
    } catch (error) {
      console.error("Error deleting prompt:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete prompt." });
    }
  };

  // Get available task types for adding new prompts
  const usedTaskTypes = prompts.map(p => p.task_type);
  const availableTaskTypes = ALL_TASK_TYPES.filter(t => !usedTaskTypes.includes(t));

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100">AI Verification Prompts</h1>
          <p className="text-sm text-neutral-500 mt-1">Configure prompts for each task type verification</p>
        </div>
        {availableTaskTypes.length > 0 && (
          <Button
            onClick={() => setIsAddingNew(true)}
            className="bg-neutral-100 text-neutral-900 hover:bg-neutral-200"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Prompt
          </Button>
        )}
      </div>

      {prompts.length === 0 ? (
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="py-12 text-center">
            <MessageSquare className="w-12 h-12 mx-auto text-neutral-600 mb-4" />
            <h3 className="text-lg font-medium text-neutral-300 mb-2">No Prompts Configured</h3>
            <p className="text-neutral-500 mb-4">Add AI verification prompts for each task type.</p>
            <Button onClick={() => setIsAddingNew(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Prompt
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {prompts.map(prompt => (
            <Card
              key={prompt.id}
              className={`bg-neutral-900 border-neutral-800 ${!prompt.is_active ? "opacity-60" : ""}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl border ${taskTypeColors[prompt.task_type] || "bg-neutral-800"}`}>
                      {taskTypeIcons[prompt.task_type] || "📋"}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-neutral-100">{prompt.prompt_name}</h3>
                        <Badge className={`text-xs ${taskTypeColors[prompt.task_type] || "bg-neutral-700"}`}>
                          {prompt.task_type.replace("_", " ")}
                        </Badge>
                        {prompt.is_active ? (
                          <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-xs">
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-neutral-500/10 text-neutral-400 border-neutral-500/20 text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-neutral-500 line-clamp-2 mb-2">
                        {prompt.prompt_content}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-neutral-500">
                        <span>Confidence Threshold: {prompt.confidence_threshold}%</span>
                        <span>Updated: {new Date(prompt.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={prompt.is_active}
                      onCheckedChange={() => handleToggleActive(prompt)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingPrompt(prompt)}
                      className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeletePrompt(prompt)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingPrompt} onOpenChange={() => setEditingPrompt(null)}>
        <DialogContent className="bg-neutral-900 border-neutral-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-neutral-100">Edit Prompt</DialogTitle>
          </DialogHeader>

          {editingPrompt && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-neutral-300">Prompt Name</Label>
                <Input
                  value={editingPrompt.prompt_name}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, prompt_name: e.target.value })}
                  className="bg-neutral-800 border-neutral-700 text-neutral-100"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-neutral-300">Task Type</Label>
                <div className={`px-3 py-2 rounded-lg border capitalize ${taskTypeColors[editingPrompt.task_type] || "bg-neutral-800 border-neutral-700"}`}>
                  {taskTypeIcons[editingPrompt.task_type]} {editingPrompt.task_type.replace("_", " ")}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-neutral-300">Prompt Content</Label>
                <Textarea
                  value={editingPrompt.prompt_content}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, prompt_content: e.target.value })}
                  className="bg-neutral-800 border-neutral-700 text-neutral-100 min-h-[200px] font-mono text-sm"
                />
                <p className="text-xs text-neutral-500">
                  This prompt will be sent to the AI for verification. Be specific about what to look for.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-neutral-300">Confidence Threshold: {editingPrompt.confidence_threshold}%</Label>
                <Slider
                  value={[editingPrompt.confidence_threshold]}
                  onValueChange={([value]) => setEditingPrompt({ ...editingPrompt, confidence_threshold: value })}
                  min={50}
                  max={100}
                  step={5}
                  className="py-2"
                />
                <p className="text-xs text-neutral-500">
                  Submissions below this threshold will be flagged for manual review.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingPrompt(null)}
              className="border-neutral-700 text-neutral-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePrompt}
              disabled={isSaving}
              className="bg-neutral-100 text-neutral-900 hover:bg-neutral-200"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add New Prompt Dialog */}
      <Dialog open={isAddingNew} onOpenChange={setIsAddingNew}>
        <DialogContent className="bg-neutral-900 border-neutral-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-neutral-100">Add New Prompt</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-neutral-300">Task Type</Label>
              <Select
                value={newPrompt.task_type}
                onValueChange={(value) => setNewPrompt({ ...newPrompt, task_type: value })}
              >
                <SelectTrigger className="bg-neutral-800 border-neutral-700 text-neutral-100">
                  <SelectValue placeholder="Select task type" />
                </SelectTrigger>
                <SelectContent className="bg-neutral-800 border-neutral-700">
                  {availableTaskTypes.map(type => (
                    <SelectItem key={type} value={type} className="text-neutral-100 capitalize">
                      {taskTypeIcons[type]} {type.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-neutral-300">Prompt Name</Label>
              <Input
                value={newPrompt.prompt_name}
                onChange={(e) => setNewPrompt({ ...newPrompt, prompt_name: e.target.value })}
                className="bg-neutral-800 border-neutral-700 text-neutral-100"
                placeholder="e.g., Like Verification"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-neutral-300">Prompt Content</Label>
              <Textarea
                value={newPrompt.prompt_content}
                onChange={(e) => setNewPrompt({ ...newPrompt, prompt_content: e.target.value })}
                className="bg-neutral-800 border-neutral-700 text-neutral-100 min-h-[150px] font-mono text-sm"
                placeholder="Enter the AI verification instructions..."
              />
            </div>

            <div className="space-y-2">
              <Label className="text-neutral-300">Confidence Threshold: {newPrompt.confidence_threshold}%</Label>
              <Slider
                value={[newPrompt.confidence_threshold]}
                onValueChange={([value]) => setNewPrompt({ ...newPrompt, confidence_threshold: value })}
                min={50}
                max={100}
                step={5}
                className="py-2"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddingNew(false)}
              className="border-neutral-700 text-neutral-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddPrompt}
              disabled={isSaving}
              className="bg-neutral-100 text-neutral-900 hover:bg-neutral-200"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Add Prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

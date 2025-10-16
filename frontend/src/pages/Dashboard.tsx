import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, MessageSquare, Image as ImageIcon } from "lucide-react";
import HeaderBar from "@/components/dashboard/HeaderBar";
import ChatSection from "@/components/dashboard/ChatSection";
import GallerySection from "@/components/dashboard/GallerySection";
import HistorySection from "@/components/dashboard/HistorySection";
import { useDropzone } from "react-dropzone";
import { useToast } from "@/components/ui/toast";
import { api, useAuthStore } from "@/stores/authStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Thumbnail {
  _id: string;
  prompt: string;
  imageUrl: string;
  originalImageUrl?: string;
  queryRewrite?: string;
  createdAt: string;
}

// User interface is now handled by Zustand

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  imageUrl?: string;
  prompt?: string;
}

export default function Dashboard() {
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [prompt, setPrompt] = useState("");
  const [rewrittenPrompt, setRewrittenPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>("");
  const [activeTab, setActiveTab] = useState("chat");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [recentGenerated, setRecentGenerated] = useState<Array<{ imageUrl: string; prompt: string }>>([]);
  const [editTarget, setEditTarget] = useState<Thumbnail | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();
  const navigate = useNavigate();

  const { user, isLoading, checkAuth, logout } = useAuthStore();

  useEffect(() => {
    const checkAuthStatus = async () => {
      const isAuth = await checkAuth();
      if (!isAuth) {
        navigate("/", { replace: true });
        return;
      }
      loadThumbnails();
    };

    checkAuthStatus();

    // Restore chat and recents from localStorage
    try {
      const savedMessages = localStorage.getItem("chatMessages");
      if (savedMessages) {
        const parsed: ChatMessage[] = JSON.parse(savedMessages).map((m: any) => ({
          ...m,
          imageUrl: m.imageUrl && typeof m.imageUrl === 'string' && m.imageUrl.startsWith('blob:') ? undefined : m.imageUrl,
          timestamp: new Date(m.timestamp)
        }));
        setChatMessages(parsed);
      }
      const savedRecents = localStorage.getItem("recentGenerated");
      if (savedRecents) {
        setRecentGenerated(JSON.parse(savedRecents));
      }
    } catch {}
  }, [checkAuth, navigate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Persist chat and recent generated on change
  useEffect(() => {
    try {
      // Avoid persisting blob URLs which will break after reload
      const sanitized = chatMessages.map((m) => (
        m.imageUrl && m.imageUrl.startsWith('blob:')
          ? { ...m, imageUrl: undefined }
          : m
      ));
      localStorage.setItem("chatMessages", JSON.stringify(sanitized));
    } catch {}
  }, [chatMessages]);

  useEffect(() => {
    try {
      localStorage.setItem("recentGenerated", JSON.stringify(recentGenerated));
    } catch {}
  }, [recentGenerated]);

  const loadThumbnails = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        addToast('error', 'You are not logged in. Please sign in again.');
        return;
      }

      const response = await api.get('/generate/thumbnails');
      setThumbnails(response.data.thumbnails);
    } catch (error) {
      console.error("Failed to load thumbnails:", error);
    }
  };

  const handleLogout = () => {
    logout();
    localStorage.removeItem("chatMessages");
    localStorage.removeItem("recentGenerated");
  };

  const handleImageUpload = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setUploadedImage(file);
      setUploadedImageUrl(URL.createObjectURL(file));
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleImageUpload,
    accept: { "image/*": [] },
    multiple: false
  });

  const rewriteQuery = async () => {
    if (!prompt.trim()) return;

    setIsRewriting(true);
    try {
      // Create FormData to send both text and file
      const formData = new FormData();
      formData.append('prompt', prompt.trim());
      if (uploadedImage) {
        formData.append('referenceImage', uploadedImage);
      }

      const response = await api.post('/generate/rewrite-query', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setRewrittenPrompt(response.data.rewrittenPrompt);
      addToast('success', "Prompt enhanced successfully!");
    } catch (error: any) {
      console.error("Failed to rewrite query:", error);
      addToast('error', error.response?.data?.error || "Failed to enhance prompt");
    } finally {
      setIsRewriting(false);
    }
  };

  const applyCompositionConstraints = (basePrompt: string) => {
    const normalized = basePrompt.toLowerCase();
    const hasSize = normalized.includes("1280") || normalized.includes("720") || normalized.includes("16:9");
    const constraints = "YouTube thumbnail, 1280x720 (16:9). Center-focused composition. Avoid side color bands or empty margins. Ensure subject and text are centered and fill the frame edge-to-edge with clear focal point.";
    return hasSize ? `${basePrompt}. Center-focused composition. Avoid side color bands or empty margins. Ensure subject and text are centered and fill the frame.` : `${basePrompt}. ${constraints}`;
  };

  const generateThumbnail = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);

    // Add user message to chat
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: prompt,
      timestamp: new Date(),
      // Do not attach blob preview to message to avoid stale blob URLs after reload
      imageUrl: undefined
    };

    setChatMessages(prev => [...prev, userMessage]);

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const basePrompt = rewrittenPrompt || prompt;
      const finalPrompt = applyCompositionConstraints(basePrompt);

      // Create FormData to send both text and file
      const formData = new FormData();
      formData.append('prompt', finalPrompt);
      if (rewrittenPrompt) {
        formData.append('queryRewrite', rewrittenPrompt);
      }
      if (uploadedImage) {
        formData.append('referenceImage', uploadedImage);
      }

      const response = await api.post('/generate/images', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const urls: string[] | undefined = response?.data?.urls;
      if (!urls || urls.length === 0 || !urls[0]) {
        addToast('error', 'Generation succeeded but no image URL was returned.');
      } else {
        const firstUrl = urls[0];
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `Generated thumbnail for: "${finalPrompt}"`,
        timestamp: new Date(),
          imageUrl: firstUrl,
        prompt: finalPrompt
      };
      setChatMessages(prev => [...prev, assistantMessage]);

        // Update recent generated (keep last two)
        setRecentGenerated(prev => {
          const updated = [{ imageUrl: firstUrl, prompt: finalPrompt }, ...prev];
          return updated.slice(0, 2);
        });
      }

      // Reload thumbnails to show the new one
      await loadThumbnails();

      // Reset form
      setPrompt("");
      setRewrittenPrompt("");
      setUploadedImage(null);
      setUploadedImageUrl("");

      addToast('success', "Thumbnail generated successfully!");
    } catch (error: any) {
      console.error("Failed to generate thumbnail:", error);

      const code = error?.response?.data?.error?.code || error?.response?.status;
      const serverMsg = (error.response?.data?.error?.message as string) || (error.response?.data?.error as string) || 'Unknown error';
      if (code === 429) {
        addToast('error', 'Rate limit hit. Please wait a bit and try again.');
      } else {
        addToast('error', `Failed to generate thumbnail: ${serverMsg}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = async (imageUrl: string, prompt: string) => {
    try {
      const response = await fetch(imageUrl, { mode: 'cors' });
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `thumbnail_${prompt.slice(0, 30).replace(/[^a-z0-9_-]/gi, '_')}_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
      addToast('success', 'Image download started');
    } catch (error) {
      console.error("Failed to download image:", error);
      addToast('error', 'Unable to download image. Please try again.');
    }
  };

  const deleteThumbnail = async (thumbnailId: string) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      await api.delete(`/generate/thumbnails/${thumbnailId}`);

      // Reload thumbnails
      await loadThumbnails();
      addToast('success', "Thumbnail deleted successfully!");
    } catch (error) {
      console.error("Failed to delete thumbnail:", error);
      addToast('error', "Failed to delete thumbnail");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast('success', "Copied to clipboard!");
  };

  const startEdit = (thumbnail: Thumbnail) => {
    setEditTarget(thumbnail);
    setEditPrompt("");
  };

  const submitEdit = async () => {
    if (!editTarget || !editPrompt.trim()) {
      addToast('error', 'Please describe the changes you want.');
      return;
    }

    setIsEditing(true);
    try {
      const response = await api.post('/generate/edit', {
        thumbnailId: editTarget._id,
        editPrompt: editPrompt.trim(),
      });

      const urls: string[] | undefined = response?.data?.urls;
      if (!urls || urls.length === 0) {
        addToast('error', 'Editing succeeded but no image URL was returned.');
      } else {
        addToast('success', 'Image edited successfully!');
        await loadThumbnails();
      }

      setEditTarget(null);
      setEditPrompt("");
    } catch (error: any) {
      console.error('Failed to edit image:', error);
      const serverMsg = error.response?.data?.error || 'Unable to edit image.';
      addToast('error', serverMsg);
    } finally {
      setIsEditing(false);
    }
  };

  // Reserved for future loading states


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-4" />
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-gray-950">
      <HeaderBar user={user} onLogout={handleLogout} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="chat" className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4" />
              <span>Chat & Generate</span>
            </TabsTrigger>
            <TabsTrigger value="gallery" className="flex items-center space-x-2">
              <ImageIcon className="w-4 h-4" />
              <span>Gallery</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4" />
              <span>History</span>
            </TabsTrigger>
          </TabsList>

          {/* Chat Tab */}
          <TabsContent value="chat" className="space-y-6">
            <ChatSection
              chatMessages={chatMessages}
              isGenerating={isGenerating}
              isRewriting={isRewriting}
              prompt={prompt}
              setPrompt={setPrompt}
              rewrittenPrompt={rewrittenPrompt}
              onRewriteQuery={rewriteQuery}
              onGenerateThumbnail={generateThumbnail}
              downloadImage={downloadImage}
              copyToClipboard={copyToClipboard}
              getRootProps={getRootProps}
              getInputProps={getInputProps}
              isDragActive={isDragActive}
              uploadedImageUrl={uploadedImageUrl}
              uploadedImageName={uploadedImage?.name}
              clearUploadedImage={() => { setUploadedImage(null); setUploadedImageUrl(""); }}
              chatEndRef={chatEndRef}
              recentGenerated={recentGenerated}
            />
          </TabsContent>

          {/* Gallery Tab */}
          <TabsContent value="gallery" className="space-y-6">
            <GallerySection
              thumbnails={thumbnails}
              setActiveChat={() => setActiveTab("chat")}
              downloadImage={downloadImage}
              copyToClipboard={copyToClipboard}
              deleteThumbnail={deleteThumbnail}
              startEdit={startEdit}
            />
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            <HistorySection
              thumbnails={thumbnails}
              downloadImage={downloadImage}
              copyToClipboard={copyToClipboard}
              deleteThumbnail={deleteThumbnail}
              startEdit={startEdit}
            />
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) { setEditTarget(null); setEditPrompt(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Thumbnail</DialogTitle>
            <DialogDescription>
              Provide instructions to modify the selected thumbnail. The AI will apply these updates while keeping the original composition.
            </DialogDescription>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-4">
              <div className="rounded-lg overflow-hidden">
                <img src={editTarget.imageUrl} alt="Thumbnail to edit" className="w-full h-48 object-cover" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editPrompt">Describe the changes</Label>
                <Textarea
                  id="editPrompt"
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder="e.g., brighten the colors, add bold yellow text saying 'New Tips', make the subject smile"
                  className="min-h-[120px]"
                />
              </div>
            </div>
          )}
          <DialogFooter className="sm:justify-end">
            <DialogClose asChild>
              <Button variant="outline" disabled={isEditing}>Cancel</Button>
            </DialogClose>
            <Button onClick={submitEdit} disabled={isEditing}>
              {isEditing ? 'Applying changes...' : 'Apply Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
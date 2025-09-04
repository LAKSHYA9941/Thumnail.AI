import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  MessageSquare,
  Settings,
  LogOut,
  Plus,
  Image as ImageIcon,
  Wand2,
  Send,
  Bot,
  User,
  AlertCircle,
  CheckCircle,
  Loader2,
  Copy,
  Share2
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import { CopyQueryCard } from "@/components/ui/copyquery";
import { useToast } from "@/components/ui/toast";

interface Thumbnail {
  _id: string;
  prompt: string;
  imageUrl: string;
  originalImageUrl?: string;
  queryRewrite?: string;
  createdAt: string;
}

interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  isGoogleUser: boolean;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  imageUrl?: string;
  prompt?: string;
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [prompt, setPrompt] = useState("");
  const [rewrittenPrompt, setRewrittenPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>("");
  const [activeTab, setActiveTab] = useState("chat");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();
  const navigate = useNavigate();

  const API_BASE = "https://thumnail-ai.onrender.com/api";

  useEffect(() => {
    loadUserProfile();
    loadThumbnails();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const loadUserProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        // No token found, redirect to login
        navigate("/");
        return;
      }

      const response = await axios.get(`${API_BASE}/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data.user);
    } catch (error: any) {
      console.error("Failed to load user profile:", error);

      // If token is invalid or expired, redirect to login
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/");
        return;
      }

      setError("Failed to load user profile");
    } finally {
      setIsLoading(false);
    }
  };

  const loadThumbnails = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await axios.get(`${API_BASE}/generate/thumbnails`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setThumbnails(response.data.thumbnails);
    } catch (error) {
      console.error("Failed to load thumbnails:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
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

      const response = await axios.post(`${API_BASE}/generate/rewrite-query`, formData, {
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

  const generateThumbnail = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);

    // Add user message to chat
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: prompt,
      timestamp: new Date(),
      imageUrl: uploadedImageUrl || undefined
    };

    setChatMessages(prev => [...prev, userMessage]);

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const finalPrompt = rewrittenPrompt || prompt;

      // Create FormData to send both text and file
      const formData = new FormData();
      formData.append('prompt', finalPrompt);
      if (rewrittenPrompt) {
        formData.append('queryRewrite', rewrittenPrompt);
      }
      if (uploadedImage) {
        formData.append('referenceImage', uploadedImage);
      }

      const response = await axios.post(`${API_BASE}/generate/images`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      // Add assistant message with generated image
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `Generated thumbnail for: "${finalPrompt}"`,
        timestamp: new Date(),
        imageUrl: response.data.urls[0],
        prompt: finalPrompt
      };

      setChatMessages(prev => [...prev, assistantMessage]);

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

      // Add error message to chat
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `Failed to generate thumbnail: ${error.response?.data?.error || 'Unknown error'}`,
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, errorMessage]);
      addToast('error', error.response?.data?.error || "Failed to generate thumbnail");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = (imageUrl: string, prompt: string) => {
    const link = document.createElement("a");
    link.href = imageUrl.startsWith('http') ? imageUrl : `${imageUrl}`;
    link.download = `thumbnail_${prompt.slice(0, 20)}_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('success', "Image downloaded successfully!");
  };

  const deleteThumbnail = async (thumbnailId: string) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      await axios.delete(`${API_BASE}/generate/thumbnails/${thumbnailId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

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

  const SkeletonCard = () => (
    <div className="animate-pulse">
      <div className="bg-gray-200 rounded-lg h-48 mb-4"></div>
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      </div>
    </div>
  );


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-4" />
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-gray-950">
      {/* Header */}
      <header className="bg-black border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">ThumbnailAI</span>
            </div>

            <div className="flex items-center space-x-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2 text-slate-200">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={user?.avatar} />
                      <AvatarFallback>
                        {user?.name?.[0] || user?.email?.[0] || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden md:block">{user?.name || user?.email}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

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
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Bot className="w-5 h-5 text-purple-600" />
                  <span>AI Chat Assistant</span>
                </CardTitle>
                <p className="text-sm text-gray-500">Chat with AI to generate and improve your YouTube thumbnails</p>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ScrollArea className="flex-1 mb-4">
                  <div className="space-y-4">
                    {chatMessages.length === 0 && (
                      <div className="text-center py-8">
                        <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500 mb-2">Start a conversation to generate thumbnails!</p>
                        <p className="text-sm text-gray-400">Upload a reference image and describe your ideal thumbnail</p>
                      </div>
                    )}

                    <AnimatePresence>
                      {chatMessages.map((message) => (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[70%] ${message.type === 'user' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-900'} rounded-lg p-3`}>
                            <div className="flex items-start space-x-2">
                              {message.type === 'assistant' && <Bot className="w-4 h-4 mt-1 flex-shrink-0" />}
                              <div className="flex-1">
                                <p className="text-sm">{message.content}</p>
                                {message.imageUrl && (
                                  <div className="mt-3">
                                    <img
                                      src={message.imageUrl}
                                      alt="Generated thumbnail"
                                      className="w-full max-w-xs rounded-lg shadow-lg"
                                      onError={(e) => {
                                        console.error("Image failed to load:", message.imageUrl);
                                        e.currentTarget.src = "/placeholder-image.png"; // Optional: show a placeholder
                                      }}
                                    />
                                    <div className="flex space-x-2 mt-2">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => downloadImage(message.imageUrl!, message.prompt || 'thumbnail')}
                                        className="text-xs"
                                      >
                                        <Download className="w-3 h-3 mr-1" />
                                        Download
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => copyToClipboard(message.prompt || '')}
                                        className="text-xs"
                                      >
                                        <Copy className="w-3 h-3 mr-1" />
                                        Copy Prompt
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                              {message.type === 'user' && <User className="w-4 h-4 mt-1 flex-shrink-0" />}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {isGenerating && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start"
                      >
                        <div className="bg-gray-100 text-gray-900 rounded-lg p-3">
                          <div className="flex items-center space-x-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm">Generating your thumbnail...</span>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>

                <div className="space-y-3 border-t pt-4">
                  {/* Image Upload */}
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${isDragActive
                      ? "border-purple-500 bg-purple-50"
                      : "border-gray-300 hover:border-purple-400"
                    }`}
                  >
                    <input {...getInputProps()} />
                    {uploadedImageUrl ? (
                      <div className="flex items-center justify-center space-x-3">
                        <img
                          src={uploadedImageUrl}
                          alt="Uploaded reference"
                          className="w-12 h-12 object-cover rounded-lg"
                        />
                        <span className="text-sm text-gray-600">{uploadedImage?.name}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setUploadedImage(null);
                            setUploadedImageUrl("");
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-6 h-6 text-gray-400 mx-auto" />
                        <p className="text-sm text-gray-600">
                          {isDragActive ? "Drop image here" : "Upload reference image (optional)"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Prompt Input */}
                  <div className="flex space-x-2">
                    <Textarea
                      placeholder="Describe your ideal YouTube thumbnail..."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="flex-1 min-h-[60px] resize-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          generateThumbnail();
                        }
                      }}
                    />
                    <div className="flex flex-col space-y-2">
                      {/* Improve Query Button */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={rewriteQuery}
                        disabled={!prompt.trim() || isRewriting}
                        className="border-purple-300 text-purple-300 hover:bg-purple-300 hover:text-slate-900"
                      >
                        {isRewriting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <MessageSquare className="w-4 h-4" />
                        )}
                        Improve Query
                      </Button>

                      {/* Generate Thumbnail Button */}
                      <Button
                        onClick={generateThumbnail}
                        disabled={!prompt.trim() || isGenerating}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                      >
                        {isGenerating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Show Enhanced Prompt Card (after clicking "Improve Query") */}
                  {rewrittenPrompt && (
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Enhanced Prompt</Label>
                      <div className="p-4 bg-slate-900 border border-purple-200 rounded-lg">
                        <p className="text-slate-300 text-sm">{rewrittenPrompt}</p>
                        <CopyQueryCard rewrittenQuery={rewrittenPrompt} />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Gallery Tab */}
          <TabsContent value="gallery" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {thumbnails.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No thumbnails yet</h3>
                  <p className="text-gray-500 mb-4">
                    Generate your first thumbnail to see it here
                  </p>
                  <Button onClick={() => setActiveTab("chat")}>
                    <Plus className="w-4 h-4 mr-2" />
                    Start Chatting
                  </Button>
                </div>
              ) : (
                thumbnails.map((thumbnail) => (
                  <motion.div
                    key={thumbnail._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group"
                  >
                    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                      <div className="relative">
                        <img
                          src={`${thumbnail.imageUrl}`}
                          alt="YT-thumbnail"
                          className="w-full h-48 object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="secondary">
                                <Settings className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onClick={() => downloadImage(thumbnail.imageUrl, thumbnail.prompt)}>
                                <Download className="w-4 h-4 mr-2" />
                                Download
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => copyToClipboard(thumbnail.prompt)}>
                                <Copy className="w-4 h-4 mr-2" />
                                Copy Prompt
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => deleteThumbnail(thumbnail._id)}>
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <CardContent className="p-4">
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {thumbnail.prompt}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-gray-400">
                            {new Date(thumbnail.createdAt).toLocaleDateString()}
                          </p>
                          {thumbnail.queryRewrite && (
                            <Badge variant="secondary" className="text-xs">
                              Enhanced
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Generation History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {thumbnails.length === 0 ? (
                    <div className="text-center py-8">
                      <RefreshCw className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No generation history yet</p>
                    </div>
                  ) : (
                    thumbnails.map((thumbnail) => (
                      <div
                        key={thumbnail._id}
                        className="flex items-center space-x-4 p-4 border rounded-lg hover:bg-gray-700"
                      >
                        <img
                          src={`${thumbnail.imageUrl}`}
                          alt='YT-thumbnail'
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-50 truncate">
                            {thumbnail.prompt}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(thumbnail.createdAt).toLocaleString()}
                          </p>
                          {thumbnail.queryRewrite && (
                            <p className="text-xs text-purple-600 mt-1">
                              Enhanced prompt used
                            </p>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadImage(thumbnail.imageUrl, thumbnail.prompt)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(thumbnail.prompt)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteThumbnail(thumbnail._id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Upload, MessageSquare, Loader2, Send, Bot, User, Download, Copy } from "lucide-react";
import { CopyQueryCard } from "@/components/ui/copyquery";

type ChatMessage = {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  imageUrl?: string;
  prompt?: string;
};

interface RecentItem { imageUrl: string; prompt: string }

interface Props {
  chatMessages: ChatMessage[];
  isGenerating: boolean;
  isRewriting: boolean;
  prompt: string;
  setPrompt: (v: string) => void;
  rewrittenPrompt: string;
  onRewriteQuery: () => void;
  onGenerateThumbnail: () => void;
  downloadImage: (url: string, prompt: string) => void | Promise<void>;
  copyToClipboard: (text: string) => void;
  getRootProps: () => any;
  getInputProps: () => any;
  isDragActive: boolean;
  uploadedImageUrl: string;
  uploadedImageName?: string;
  clearUploadedImage: () => void;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  recentGenerated: RecentItem[];
}

export default function ChatSection(props: Props) {
  const {
    chatMessages,
    isGenerating,
    isRewriting,
    prompt,
    setPrompt,
    rewrittenPrompt,
    onRewriteQuery,
    onGenerateThumbnail,
    downloadImage,
    copyToClipboard,
    getRootProps,
    getInputProps,
    isDragActive,
    uploadedImageUrl,
    uploadedImageName,
    clearUploadedImage,
    chatEndRef,
    recentGenerated,
  } = props;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Bot className="w-5 h-5 text-purple-600" />
          <span>AI Chat Assistant</span>
        </CardTitle>
        <p className="text-sm text-gray-500">Chat with AI to generate and improve your YouTube thumbnails</p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {recentGenerated.length > 0 && (
          <div className="mb-4">
            <Label className="text-xs text-gray-400">Recent results</Label>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {recentGenerated.map((item, idx) => (
                <div key={`${item.imageUrl}-${idx}`} className="border rounded-lg overflow-hidden bg-gray-900">
                  <img src={item.imageUrl} alt="Recent thumbnail" className="w-full h-32 object-cover" />
                  <div className="p-2 flex items-center justify-between">
                    <Button size="sm" variant="secondary" onClick={() => downloadImage(item.imageUrl, item.prompt)}>
                      <Download className="w-3 h-3 mr-1" />
                      Download
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setPrompt(item.prompt)}>
                      <Copy className="w-3 h-3 mr-1" />
                      Use prompt
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
                                e.currentTarget.src = "/placeholder-image.png";
                              }}
                            />
                            <div className="flex space-x-2 mt-2">
                              <Button size="sm" variant="ghost" onClick={() => downloadImage(message.imageUrl!, message.prompt || 'thumbnail')} className="text-xs">
                                <Download className="w-3 h-3 mr-1" />
                                Download
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => copyToClipboard(message.prompt || '')} className="text-xs">
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
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
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
          <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${isDragActive ? "border-purple-500 bg-purple-50" : "border-gray-300 hover:border-purple-400"}`}>
            <input {...getInputProps()} />
            {uploadedImageUrl ? (
              <div className="flex items-center justify-center space-x-3">
                <img src={uploadedImageUrl} alt="Uploaded reference" className="w-12 h-12 object-cover rounded-lg" />
                <span className="text-sm text-gray-600">{uploadedImageName}</span>
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); clearUploadedImage(); }}>Remove</Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-6 h-6 text-gray-400 mx-auto" />
                <p className="text-sm text-gray-600">{isDragActive ? "Drop image here" : "Upload reference image (optional)"}</p>
              </div>
            )}
          </div>

          <div className="flex space-x-2">
            <Textarea
              placeholder="Describe your ideal YouTube thumbnail..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="flex-1 min-h-[60px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onGenerateThumbnail();
                }
              }}
            />
            <div className="flex flex-col space-y-2">
              <Button size="sm" variant="outline" onClick={onRewriteQuery} disabled={!prompt.trim() || isRewriting} className="border-purple-300 text-purple-300 hover:bg-purple-300 hover:text-slate-900">
                {isRewriting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                Improve Query
              </Button>
              <Button onClick={onGenerateThumbnail} disabled={!prompt.trim() || isGenerating} className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>

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
  );
}



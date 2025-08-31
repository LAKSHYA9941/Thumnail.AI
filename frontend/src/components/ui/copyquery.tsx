import { useState } from "react";
import { Check, Copy, Bot } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

interface CopyQueryCardProps {
  rewrittenQuery: string;
}

export function CopyQueryCard({ rewrittenQuery }: CopyQueryCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(rewrittenQuery).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    });
  };

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button variant="link" className="max-w-xs truncate">
          {rewrittenQuery}
        </Button>
      </HoverCardTrigger>

      <HoverCardContent side="top" align="start" className="w-80">
        <div className="flex gap-4">
          <Avatar>
            <AvatarImage src="https://github.com/vercel.png" />
            <AvatarFallback>
              <Bot className="w-4 h-4" />
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-2">
            <h4 className="text-sm font-semibold">AI-rewritten prompt</h4>
            <p className="text-sm break-words">{rewrittenQuery}</p>

            <Button
              size="sm"
              className="w-full "
              onClick={handleCopy}
              disabled={copied}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" /> Copy
                </>
              )}
            </Button>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
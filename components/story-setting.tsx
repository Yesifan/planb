"use client";

import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { BookOpen, ChevronDown, Sparkles, Tag } from "lucide-react";
import { Streamdown } from "streamdown";

import { Story } from "@/lib/db/schema";

import { Button } from "./ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

const streamdownPlugins = { cjk, code, math, mermaid };

export default function StorySetting({ story }: { story?: Story }) {
  return (
    <Collapsible defaultOpen={false} className="border-b">
      <div className="mx-auto max-w-3xl px-4 py-3">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="group flex h-auto items-center gap-2 px-0"
          >
            <span className="font-heading text-sm font-medium">故事设定</span>
            <ChevronDown className="size-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          {story ? (
            <div className="bg-muted/30 rounded-xl p-4">
              <Tabs defaultValue="basic">
                <TabsList>
                  <TabsTrigger value="basic">基本信息</TabsTrigger>
                  <TabsTrigger value="worldview">世界观</TabsTrigger>
                  <TabsTrigger value="describe">世界背景</TabsTrigger>
                </TabsList>
                <TabsContent value="basic" className="pt-4">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <BookOpen className="text-accent mt-0.5 size-4" />
                      <div>
                        <div className="text-muted-foreground text-xs font-medium">
                          故事来源
                        </div>
                        <div className="text-sm">{story.source}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Sparkles className="text-accent mt-0.5 size-4" />
                      <div>
                        <div className="text-muted-foreground text-xs font-medium">
                          特异点
                        </div>
                        <div className="text-sm">{story.singularity}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Tag className="text-accent mt-0.5 size-4" />
                      <div>
                        <div className="text-muted-foreground text-xs font-medium">
                          类型
                        </div>
                        <div className="text-sm">{story.type}</div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="worldview" className="pt-4">
                  {story.worldview ? (
                    <Streamdown
                      plugins={streamdownPlugins}
                      className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                    >
                      {story.worldview}
                    </Streamdown>
                  ) : (
                    <div className="text-muted-foreground text-sm">
                      暂无世界观设定
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="describe" className="pt-4">
                  {story.describe ? (
                    <Streamdown
                      plugins={streamdownPlugins}
                      className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                    >
                      {story.describe}
                    </Streamdown>
                  ) : (
                    <div className="text-muted-foreground text-sm">
                      暂无描述
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="bg-muted/10 text-muted-foreground rounded-xl p-4 text-center text-sm">
              暂无故事设定
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

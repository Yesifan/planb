declare module "@/planb/agents/*.md" {
  const content: {
    frontmatter: import("@/lib/llm/type").Agent;
    content: string;
  };
  export default content;
}

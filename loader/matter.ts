import { OnLoadArgs } from "bun";
import matter from "gray-matter";

/**
 * @param {string} source - Raw markdown file content
 * @returns {string} JavaScript module code
 */
export default function matterLoader(source: string) {
  try {
    const parsed = matter(source);

    const result = {
      frontmatter: parsed.data || {},
      content: parsed.content || "",
    };
    // Return a JavaScript module that exports the parsed markdown
    return `export default ${JSON.stringify(result)};`;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid YAML frontmatter: ${errorMessage}`);
  }
}

export async function matterBunLoader(args: OnLoadArgs) {
  const source = await Bun.file(args.path).text();

  try {
    const parsed = matter(source);
    const result = {
      frontmatter: parsed.data || {},
      content: parsed.content || "",
    };

    return {
      exports: { default: result },
      loader: "object" as const,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Invalid YAML frontmatter in ${args.path}: ${errorMessage}`,
    );
  }
}

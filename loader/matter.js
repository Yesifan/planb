import matter from "gray-matter";

/**
 * @param {string} source - Raw markdown file content
 * @returns {string} JavaScript module code
 */
export default function markdownLoader(source) {
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

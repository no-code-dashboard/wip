export {markdownToHtml}
/**
 * Main function to convert the limited Markdown text to HTML.
 * Supports: Bold, Italics, Links, Unordered Lists (*, -), Ordered Lists (N.)
 * @param {string} markdown - The raw markdown input string.
 * @returns {string} - The resulting HTML string.
 */
function markdownToHtml(markdown) {
  const lines = markdown.split("\n");
  let output = [];
  const xxxelements = { div: { class: "markdown" } };
  const xOutput = [];
  let inUnorderedList = false;
  let inOrderedList = false;

  function push(tag) {
    output.push(tag);
    if (tag.startsWith("</")) {
      // xOutput.pop()
      return;
    }
  }
  // Helper to close lists
  function closeLists() {
    if (inUnorderedList) {
      push("</ul>");
      inUnorderedList = false;
    }
    if (inOrderedList) {
      push("</ol>");
      inOrderedList = false;
    }
  }

  for (const line of lines) {
    const trimmedLine = line.trim();

    // 1. Handle Empty Lines (Ends any open list structure)
    if (trimmedLine === "") {
      closeLists();
      // Don't add anything for empty lines unless we are intentionally creating a break
      // For simplicity, we just close lists and continue.
      continue;
    }

    // 2. Check for Unordered List Item
    if (trimmedLine.startsWith("* ") || trimmedLine.startsWith("- ")) {
      // Start a new UL if not already in one, closing OL if necessary
      if (inOrderedList) {
        push("</ol>");
        inOrderedList = false;
      }
      if (!inUnorderedList) {
        push("<ul>");
        inUnorderedList = true;
      }

      // Extract content and process inline
      const listItemContent = trimmedLine.substring(2).trim();
      push(`<li>${processInline(listItemContent)}</li>`);
      continue; // Done with this line
    }

    // 3. Check for Ordered List Item
    // Regex: Matches digits followed by a dot and a space (e.g., "1. ")
    const olMatch = trimmedLine.match(/^(\d+\.\s)(.*)/);
    if (olMatch) {
      // Start a new OL if not already in one, closing UL if necessary
      if (inUnorderedList) {
        push("</ul>");
        inUnorderedList = false;
      }
      if (!inOrderedList) {
        push("<ol>");
        inOrderedList = true;
      }

      // Extract content and process inline (group 2 is the rest of the line)
      const listItemContent = olMatch[2].trim();
      push(`<li>${processInline(listItemContent)}</li>`);
      continue; // Done with this line
    }

    // 4. Handle Paragraph (If not a list item)
    closeLists();

    // Process inline elements and wrap in <p> tag
    const paragraph = processInline(trimmedLine);
    push(`<p>${paragraph}</p>`); 
    //create {p:{text: paragraph}} or {p:paragraph}
  }

  // Final check to close any open lists at the end of the document
  closeLists();

  // Join everything back into a single HTML string
  return output.join("\n");

  function processInline(text) {
    const rules = [
      //bold, italics and paragragh rules
      [/\*\*\s?([^\n]+)\*\*/g, "<b>$1</b>"],
      [/\*\s?([^\n]+)\*/g, "<i>$1</i>"],
      [/__([^_]+)__/g, "<b>$1</b>"],
      [/_([^_`]+)_/g, "<i>$1</i>"],
      // [/([^\n]+\n?)/g, "<p>$1</p>"],

      //links
      [/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>'],

      //Lists
      [/([^\n]+)(\+)([^\n]+)/g, "<ul><li>$3</li></ul>"],
      [/([^\n]+)(\*)([^\n]+)/g, "<ul><li>$3</li></ul>"],

      //Image
      // [
      //   /!\[([^\]]+)\]\(([^)]+)\s"([^")]+)"\)/g,
      //   '<img src="$2" alt="$1" title="$3" />',
      // ],
    ];
    let innerHTML = text;
    rules.forEach(
      ([rule, template]) => (innerHTML = innerHTML.replace(rule, template))
    );
    return innerHTML;

    // 1. Links: [text](url) -> <a href="url">text</a>
    // Note: Links must be processed first to prevent bold/italic markers inside the link text/url from being processed.
    let html = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // 2. Bold: **text** or __text__ -> <strong>text</strong>
    // Using non-greedy and ensuring no space around the content for typical markdown flavor
    html = html.replace(/\*\*([^\s].*?[^\s])\*\*/g, "<strong>$1</strong>");
    html = html.replace(/__([^\s].*?[^\s])__/g, "<strong>$1</strong>");
    // Handle cases where bold markers might be at the start/end of a line without surrounding space (if necessary, though the regex above should handle most cases)
    html = html.replace(/\*\*([^\*]+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/__([^_]+?)__/g, "<strong>$1</strong>");

    // 3. Italics: *text* or _text_ -> <em>text</em>
    // Using non-greedy and ensuring no space around the content
    html = html.replace(/\*([^\s][^\*]*?[^\s])\*/g, "<em>$1</em>");
    html = html.replace(/_([^\s][^_]*?[^\s])_/g, "<em>$1</em>");
    // Handle remaining cases
    html = html.replace(/\*([^\*]+?)\*/g, "<em>$1</em>");
    html = html.replace(/_([^_]+?)_/g, "<em>$1</em>");

    // let htmlx = text + "\n";
    // rules.forEach(
    //   ([rule, template]) => (htmlx = htmlx.replace(rule, template))
    // );
    // console.log({htmlx:htmlx.split("\n"),html})

    return html;
  }
}
/**
 * Simple Markdown Parser with Details/Summary support for '##' headings.
 * @param {string} markdownText The raw markdown string to parse.
 * @returns {string} The HTML representation of the markdown.
 */
function parseLimitedMarkdown(markdownText) {
    let html = markdownText;

    // --- 1. DETAILS/SUMMARY LOGIC (Handles '##' and content until the next '##') ---

    // Split the text by '##' to separate the detail sections.
    const sections = html.split(/^##\s*(.*)$/gm);
    let detailsHtml = '';

    // The first element might be text before the first '##', which we process normally.
    let remainingText = sections[0] || '';

    // Iterate through the captured content and titles (the split creates title/content pairs)
    for (let i = 1; i < sections.length; i += 2) {
        const title = sections[i].trim();
        const content = sections[i + 1] || '';

        // Add the collapsible structure
        detailsHtml += `\n<details>\n<summary>${title}</summary>\n${content}\n</details>\n`;
    }

    // Combine the initial text with the generated details/summary blocks
    html = remainingText + detailsHtml;


    // --- 2. REMAINING REGULAR EXPRESSION TRANSFORMATIONS ---

    // A. HEADERS (Other levels: # H1, ### H3, etc.)
    // We only process lines starting with #, ###, ####, #####, ###### now.
    html = html.replace(/^(\#|\#{3,6})\s*(.*)$/gm, (match, hashes, content) => {
        const level = hashes.length;
        return `<h${level}>${content.trim()}</h${level}>`;
    });

    // B. LINKS: [Text](url)
    html = html.replace(/\[([^]+?)\]\(([^)]+?)\)/g, '<a href="$2">$1</a>');

    // C. BOLD: **text** or __text__
    html = html.replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>');

    // D. ITALICS: *text* or _text_
    html = html.replace(/(\*|_)(.*?)\1/g, '<em>$2</em>');

    // E. LISTS (Unordered: * or - at the start of a line)
    // Step 1: Convert each list item line to an <li> tag.
    html = html.replace(/^[\*\-]\s+(.*)$/gm, '<li>$1</li>');

    // Step 2: Wrap all consecutive <li> items with <ul> tags.
    html = html.replace(/(<li>.*?<\/li>(\s*<li>.*?<\/li>)*)/gs, '<ul>\n$1\n</ul>');

    return html;
}
// Tiny markdown subset renderer (h2, h3, bold, ul, p) — no external dep
export default function ReactMarkdownLite({ text = "" }) {
  if (!text) return null;
  const lines = text.split(/\r?\n/);
  const out = [];
  let buf = [];
  let inList = false;
  const flushP = () => {
    if (buf.length) {
      out.push(<p key={out.length} dangerouslySetInnerHTML={{ __html: applyInline(buf.join(" ")) }} />);
      buf = [];
    }
  };
  const closeList = () => {
    if (inList) {
      const items = out.splice(out._listStart).map((el, i) => <li key={i} dangerouslySetInnerHTML={{ __html: applyInline(el) }} />);
      out.push(<ul key={`ul-${out.length}`}>{items}</ul>);
      inList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s+/.test(line)) {
      flushP(); closeList();
      out.push(<h2 key={out.length}>{line.replace(/^##\s+/, "")}</h2>);
    } else if (/^###\s+/.test(line)) {
      flushP(); closeList();
      out.push(<h3 key={out.length}>{line.replace(/^###\s+/, "")}</h3>);
    } else if (/^\s*[-*]\s+/.test(line)) {
      flushP();
      if (!inList) { inList = true; out._listStart = out.length; }
      out.push(line.replace(/^\s*[-*]\s+/, ""));
    } else if (/^\d+\.\s+/.test(line)) {
      flushP();
      if (!inList) { inList = true; out._listStart = out.length; }
      out.push(line.replace(/^\d+\.\s+/, ""));
    } else if (line.trim() === "") {
      flushP(); closeList();
    } else {
      buf.push(line);
    }
  }
  flushP(); closeList();
  return <>{out}</>;
}

function applyInline(s) {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    // [text](url) — only site-relative, http(s) and mailto targets, so a
    // `javascript:` URL typed into the CMS can never become a live link.
    // Quotes are already escaped above, so the href can't break out.
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:|\/)[^\s)]*)\)/g, (_, label, url) =>
      /^https?:/.test(url)
        ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
        : `<a href="${url}">${label}</a>`)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

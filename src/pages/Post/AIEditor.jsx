// src/app/pages/Post/AIEditor.jsx
import React from "react";
import { Button, Segment, Message, Input, Checkbox } from "semantic-ui-react";
import styles from "./AIEditor.module.css";
import { aiAssist } from "../../api/ai";

/* ---------- Minimal Markdown preview for assistant bubbles ---------- */
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark as prismOneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

const MarkdownPreview = ({ value = "" }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      code({ inline, className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || "");
        if (inline)
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        return (
          <SyntaxHighlighter
            style={prismOneDark}
            language={match ? match[1] : undefined}
            PreTag="div"
            showLineNumbers
            wrapLongLines
            {...props}
          >
            {String(children).replace(/\n$/, "")}
          </SyntaxHighlighter>
        );
      },
    }}
  >
    {value}
  </ReactMarkdown>
);

/* ---------- Helpers ---------- */

const sanitizeTag = (s) =>
  s
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9+-]/g, "")
    .trim();

const parseTags = (raw) => {
  if (!raw) return [];
  let s = raw.trim();
  s = s.replace(/^#?\s*tags?\s*:\s*/i, "");
  s = s.replace(/^[\s>*-]*[•*\-]\s*/gim, "");
  s = s.replace(/\n+/g, ",");
  const parts = s
    .split(/[,|;\/]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const fallback = parts.length <= 1 ? s.split(/\s+/).filter(Boolean) : parts;
  return fallback.map(sanitizeTag);
};

const sectionGrab = (text, name) => {
  const re = new RegExp(`#${name}\\s*\\n([\\s\\S]*?)(?=\\n#\\w+\\b|$)`, "i");
  const m = text.match(re);
  return m ? m[1].trim() : null;
};

const parseAiSections = (text) => ({
  title: sectionGrab(text, "TITLE"),
  abstract: sectionGrab(text, "ABSTRACT"),
  body: sectionGrab(text, "BODY_MD") || sectionGrab(text, "BODY"),
  tags: parseTags(sectionGrab(text, "TAGS")),
});

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ============================ Component ============================ */

export default function AIEditor({
  /** Function that returns a snapshot string of the current editing context. */
  getContext,

  /** "article" | "question" (affects some prompts) */
  postType,

  /** Existing tags to merge with AI-suggested tags */
  currentTags = [],

  /** Apply callbacks into parent state */
  onApplyTitle,
  onApplyAbstract,
  onReplaceBody,
  onAppendBody,
  onApplyTags,
}) {
  // UI/state for dock and chat
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [quota, setQuota] = React.useState(null);
  const [input, setInput] = React.useState("");
  const [msgs, setMsgs] = React.useState([]); // {role:'user'|'assistant', text, sections?}

  // Auto-apply only (UI simplified)
  const [autoApply, setAutoApply] = React.useState(true);

  // Resizable dock
  const [dockHeight, setDockHeight] = React.useState(480);
  const startResize = (e) => {
    const startY = e.clientY;
    const startH = dockHeight;
    const MIN = 260;
    const MAX = Math.max(360, window.innerHeight - 140);
    const onMove = (ev) =>
      setDockHeight(clamp(startH + (startY - ev.clientY), MIN, MAX));
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const mergeTags = (existing, add) =>
    Array.from(new Set([...(existing || []), ...add.map(sanitizeTag)]));

  /* ---------- Conversational-first intent with action JSON guidance ---------- */
  const intentPrompt = (raw) => {
    const ctx = (typeof getContext === "function" ? getContext() : "") || "";
    const m = raw.trim().match(/^\/(\w+)\s*(.*)$/);

    const actionGuide = [
      "After your natural-language reply, include at most one fenced JSON block when relevant:",
      "```json",
      '{"actions":[{"type":"REPLACE_BODY","body_md":"..."},{"type":"APPEND_BODY","body_md":"..."},{"type":"APPLY_TITLE","title":"..."},{"type":"APPLY_ABSTRACT","abstract":"..."},{"type":"APPLY_TAGS","tags":["..."]},{"type":"CONFIRM","question":"..."}],"confidence":0.0}',
      "```",
      "Only include this JSON if at least one action is appropriate. Confidence in [0,1].",
      "Prefer REPLACE_BODY when user clearly wants to swap full body; prefer APPEND_BODY for incremental snippets.",
    ].join("\n");

    // Slash commands retained; otherwise default to conversational chat
    if (!m) {
      return {
        feature: "chat",
        prompt: [
          "Chat naturally about their writing. Acknowledge briefly, then offer 1–3 specific suggestions.",
          "Ask at most one clarifying question when helpful.",
          "Keep outputs concise and concrete.",
          "If the user requests inserting/adding/replacing content, include the actions JSON.",
          "",
          "User message:",
          raw,
          "",
          actionGuide,
        ].join("\n"),
        context: ctx,
      };
    }

    const cmd = m[1].toLowerCase();
    const rest = (m[2] || "").trim();

    if (cmd === "title") {
      return {
        feature: "editor",
        prompt:
          "Propose an improved, succinct, compelling title. Return #TITLE only.\n" +
          actionGuide,
        context: ctx + "\nReturn #TITLE only.",
      };
    }
    if (cmd === "abstract") {
      return {
        feature: "editor",
        prompt:
          "Summarise the body into one crisp paragraph. Return #ABSTRACT only.\n" +
          actionGuide,
        context: ctx + "\nReturn #ABSTRACT only.",
      };
    }
    if (cmd === "tags") {
      return {
        feature: "editor",
        prompt:
          "Generate 3–6 relevant, short, lowercase tags, comma-separated. Return #TAGS only.\n" +
          actionGuide,
        context: ctx + "\nReturn #TAGS only.",
      };
    }
    if (cmd === "write") {
      return {
        feature: "editor",
        prompt:
          `Write an article on: ${rest}. Use Markdown headings and brief examples.\n` +
          actionGuide,
        context:
          ctx + "\nReturn #BODY_MD (and optionally #TITLE, #ABSTRACT, #TAGS).",
      };
    }
    if (cmd === "code") {
      return {
        feature: "editor",
        prompt:
          `Write code for: ${rest}. Provide fenced Markdown and a brief explanation.\n` +
          actionGuide,
        context: ctx + "\nReturn #BODY_MD only.",
      };
    }
    if (cmd === "improve") {
      return {
        feature: "editor",
        prompt:
          `Improve the current ${postType === "article" ? "article body" : "question description"} for clarity and structure while preserving author voice. Keep Markdown.\n` +
          actionGuide,
        context: ctx + "\nReturn #BODY_MD only.",
      };
    }

    // Unknown slash → conversational edit
    return {
      feature: "editor",
      prompt:
        `Acknowledge briefly, then provide concrete suggestions.\nUser message: ${raw}\n` +
        actionGuide,
      context: ctx,
    };
  };

  /* ---------- Action JSON parsing & application ---------- */

  const extractActionsFromText = (t) => {
    if (!t) return [];
    const blocks = [...t.matchAll(/```json\s*([\s\S]*?)\s*```/gi)];
    if (blocks.length === 0) return [];
    const last = blocks[blocks.length - 1][1];
    try {
      const parsed = JSON.parse(last);
      return Array.isArray(parsed.actions) ? parsed.actions : [];
    } catch {
      return [];
    }
  };

  const applyActions = (actions = []) => {
    for (const a of actions) {
      switch (a.type) {
        case "REPLACE_BODY":
          if (a.body_md && onReplaceBody) onReplaceBody(a.body_md);
          break;
        case "APPEND_BODY":
          if (a.body_md && onAppendBody) onAppendBody(a.body_md);
          break;
        case "APPLY_TITLE":
          if (a.title && onApplyTitle) onApplyTitle(a.title);
          break;
        case "APPLY_ABSTRACT":
          if (a.abstract && onApplyAbstract) onApplyAbstract(a.abstract);
          break;
        case "APPLY_TAGS":
          if (Array.isArray(a.tags) && onApplyTags)
            onApplyTags(mergeTags(currentTags, a.tags));
          break;
        case "CONFIRM":
        default:
          break;
      }
    }
  };

  /* ---------- Conversational fallback: remember last draft & infer intent ---------- */

  // Store last AI-proposed content so "insert it / replace it" can act even without JSON
  const lastProposedRef = React.useRef({ bodyMd: "", title: "", tags: [] });

  const extractPastedBody = (raw) => {
    const fence = raw.match(/```(?:md|markdown)?\s*([\s\S]*?)```/i);
    if (fence) return fence[1].trim();
    if (raw.split("\n").length >= 2 && raw.trim().length > 120)
      return raw.trim();
    return "";
  };

  const inferActionFromUser = (raw) => {
    const s = raw.toLowerCase();
    const wantsReplace =
      /(replace|overwrite)\b/.test(s) && /\b(body|article)\b/.test(s);
    const wantsInsert =
      /(insert|add|append|put)\b/.test(s) && /\b(body|article)\b/.test(s);
    const pasted = extractPastedBody(raw);
    const candidateBody = pasted || lastProposedRef.current.bodyMd || "";

    if (wantsReplace && candidateBody)
      return [{ type: "REPLACE_BODY", body_md: candidateBody }];
    if (wantsInsert && candidateBody)
      return [{ type: "APPEND_BODY", body_md: candidateBody }];
    return [];
  };

  const sendAi = async () => {
    const raw = input.trim();
    if (!raw || busy) return;
    setError("");
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", text: raw }]);
    setInput("");

    try {
      const { feature, prompt, context } = intentPrompt(raw);
      const r = await aiAssist({ feature, prompt, context });
      const text = r.text || "";
      const sections = parseAiSections(text);

      // Extract actions and optionally auto-apply
      const actions = extractActionsFromText(text);
      if (actions.length && autoApply) {
        try {
          applyActions(actions);
        } catch {}
      }

      // Capture latest proposed content from actions or sections for conversational fallback
      const captureFromActions = (alist = []) => {
        const out = { bodyMd: "", title: "", tags: [] };
        for (const a of alist) {
          if (
            (a.type === "REPLACE_BODY" || a.type === "APPEND_BODY") &&
            a.body_md
          )
            out.bodyMd = a.body_md;
          if (a.type === "APPLY_TITLE" && a.title) out.title = a.title;
          if (a.type === "APPLY_TAGS" && Array.isArray(a.tags))
            out.tags = a.tags;
        }
        return out;
      };
      const captured = captureFromActions(actions);
      if (!captured.bodyMd && sections?.body) captured.bodyMd = sections.body;
      if (!captured.title && sections?.title) captured.title = sections.title;
      if (
        (!captured.tags || captured.tags.length === 0) &&
        sections?.tags?.length
      )
        captured.tags = sections.tags;
      lastProposedRef.current = {
        bodyMd: captured.bodyMd || lastProposedRef.current.bodyMd,
        title: captured.title || lastProposedRef.current.title,
        tags:
          captured.tags && captured.tags.length
            ? captured.tags
            : lastProposedRef.current.tags,
      };

      // If no actions came back, try local inference (“insert it”, “replace the body”, etc.)
      if ((!actions || actions.length === 0) && autoApply) {
        const inferred = inferActionFromUser(raw);
        if (inferred.length) applyActions(inferred);
      }

      setMsgs((m) => [...m, { role: "assistant", text, sections }]);
      if (r.quota) setQuota(r.quota);
    } catch (e) {
      setError(e.message || "AI request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Floating toggle */}
      <Button
        circular
        icon="magic"
        title="AI Editor"
        onClick={() => setOpen((v) => !v)}
        className={`${styles.aiToggleBtn} ${open ? styles.aiToggleBtnOpen : styles.aiToggleBtnClosed}`}
        style={{ "--dock-height": `${dockHeight}px` }}
      />

      {/* Dock */}
      {open && (
        <Segment
          basic
          className={styles.aiDock}
          style={{ "--dock-height": `${dockHeight}px` }}
        >
          {/* Resize handle */}
          <div
            className={styles.aiResizeHandle}
            onMouseDown={startResize}
            title="Drag to resize"
          >
            <div className={styles.aiResizeGrip} />
          </div>

          {/* Header */}
          <div className={styles.aiHeader}>
            <strong>AI Editor</strong>
            <div className={styles.aiHeaderRight}>
              {quota && (
                <small>
                  Usage today: {quota.used}/{quota.limit}
                </small>
              )}
              <Button
                icon="close"
                circular
                size="mini"
                onClick={() => setOpen(false)}
              />
            </div>
          </div>

          {/* Body */}
          <div className={styles.aiGrid}>
            {/* Messages */}
            <div className={styles.aiMessages}>
              {msgs.length === 0 && (
                <Message size="small">
                  Talk naturally. You can also use slash commands like{" "}
                  <code>/write</code>, <code>/tags</code>,{" "}
                  <code>/abstract</code>, <code>/code</code>,{" "}
                  <code>/improve</code>.
                </Message>
              )}

              {msgs.map((m, i) => (
                <div
                  key={i}
                  className={`${styles.aiMessageRow} ${m.role === "user" ? styles.aiRowUser : styles.aiRowAssistant}`}
                >
                  <div
                    className={`${styles.aiMessageBubble} ${
                      m.role === "user"
                        ? styles.aiMessageBubbleUser
                        : styles.aiMessageBubbleAssistant
                    }`}
                  >
                    {m.role === "assistant" ? (
                      <MarkdownPreview value={m.text} />
                    ) : (
                      <div>{m.text}</div>
                    )}

                    {/* Manual Apply actions (from #TITLE/#BODY/#TAGS parsing) */}
                    {m.role === "assistant" && (
                      <div className={styles.aiBubbleActions}>
                        {m.sections?.title && onApplyTitle && (
                          <Button
                            size="mini"
                            onClick={() => onApplyTitle(m.sections.title)}
                            title="Replace Title"
                          >
                            Apply Title
                          </Button>
                        )}
                        {m.sections?.abstract && onApplyAbstract && (
                          <Button
                            size="mini"
                            onClick={() => onApplyAbstract(m.sections.abstract)}
                            title="Replace Abstract"
                          >
                            Apply Abstract
                          </Button>
                        )}
                        {m.sections?.body &&
                          (onReplaceBody || onAppendBody) && (
                            <>
                              {onReplaceBody && (
                                <Button
                                  size="mini"
                                  onClick={() => onReplaceBody(m.sections.body)}
                                  title="Replace Body"
                                >
                                  Replace Body
                                </Button>
                              )}
                              {onAppendBody && (
                                <Button
                                  size="mini"
                                  basic
                                  onClick={() => onAppendBody(m.sections.body)}
                                  title="Append to Body"
                                >
                                  Append to Body
                                </Button>
                              )}
                            </>
                          )}
                        {m.sections?.tags?.length > 0 && onApplyTags && (
                          <Button
                            size="mini"
                            onClick={() =>
                              onApplyTags(
                                mergeTags(currentTags, m.sections.tags)
                              )
                            }
                            title="Add Tags"
                          >
                            Apply Tags
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {error && <Message negative>{error}</Message>}
            </div>

            {/* Single control row: Auto-apply toggle */}
            <div
              className={styles.aiQuickRow}
              style={{
                alignItems: "center",
                gap: 12,
                display: "flex",
                flexWrap: "wrap",
              }}
            >
              <Checkbox
                toggle
                checked={autoApply}
                onChange={(_, d) => setAutoApply(!!d.checked)}
                label="Auto-apply AI edits"
              />
            </div>

            {/* Composer */}
            <div className={styles.aiComposerBar}>
              <div className={styles.aiComposerRow}>
                <div className={styles.aiComposerInput}>
                  <Input
                    fluid
                    placeholder="Talk to the editor… e.g., “tighten the intro”, “insert it”, or “replace the body with this: ```md ... ```”"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendAi();
                      }
                    }}
                  />
                </div>
                <Button
                  primary
                  className="btn-primary"
                  loading={busy}
                  disabled={busy || !input.trim()}
                  onClick={sendAi}
                  content="Send"
                />
              </div>
            </div>
          </div>
        </Segment>
      )}
    </>
  );
}

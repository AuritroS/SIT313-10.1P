// PostPage.jsx
import React, { useRef, useState } from "react";
import {
  Form,
  Button,
  Radio,
  Input,
  TextArea,
  Image,
  Progress,
  Message,
  Label,
  Icon,
} from "semantic-ui-react";

import useAuth from "../../hooks/useAuth";
import { storage, createPost, createQuestion } from "../../api/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

/* ---------- Markdown Rendering ---------- */
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark as prismOneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

/* ---------- CodeMirror Editor ---------- */
import CodeMirror from "@uiw/react-codemirror";
import { markdown as cmMarkdown } from "@codemirror/lang-markdown";
import { oneDark as cmOneDark } from "@codemirror/theme-one-dark";

/* ---------- Styles ---------- */
import styles from "./PostPage.module.css";

/** Reusable Markdown preview */
const MarkdownPreview = ({ value = "" }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      code({ inline, className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || "");
        if (inline) return <code className={className} {...props}>{children}</code>;
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

const MarkdownEditor = ({ label, value, onChange, placeholder, minRows = 12 }) => {
  const editorViewRef = React.useRef(null);
  const editorHeightPx = Math.max(minRows * 24, 240);
  const toolbarHeightPx = 40;
  const totalHeight = editorHeightPx + toolbarHeightPx;

  const wrapSelection = (left, right = left) => {
    const view = editorViewRef.current;
    if (!view) return;
    const sel = view.state.selection.main;
    const text = view.state.doc.sliceString(sel.from, sel.to);
    view.dispatch(
      sel.empty
        ? {
            changes: { from: sel.from, to: sel.to, insert: left + right },
            selection: { anchor: sel.from + left.length },
          }
        : {
            changes: { from: sel.from, to: sel.to, insert: left + text + right },
            selection: {
              anchor: sel.from + left.length,
              head: sel.from + left.length + text.length,
            },
          }
    );
  };

  const toggleHeading = (level) => {
    const view = editorViewRef.current;
    if (!view) return;
    const sel = view.state.selection.main;
    const doc = view.state.doc;
    const start = doc.lineAt(sel.from).number;
    const end = doc.lineAt(sel.to).number;
    const prefix = "#".repeat(level) + " ";
    const changes = [];
    for (let ln = start; ln <= end; ln++) {
      const line = doc.line(ln);
      const has = line.text.startsWith(prefix);
      changes.push(
        has
          ? { from: line.from, to: line.from + prefix.length, insert: "" }
          : { from: line.from, to: line.from, insert: prefix }
      );
    }
    view.dispatch({ changes });
  };

  const insertCodeBlock = (lang = "") => {
    const view = editorViewRef.current;
    if (!view) return;
    const sel = view.state.selection.main;
    const text = view.state.doc.sliceString(sel.from, sel.to);
    const open = "```" + lang + "\n";
    const close = "\n```";
    const insert = sel.empty ? open + "\n" + close : open + text + close;
    const cursor = sel.from + open.length;
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert },
      selection: { anchor: cursor, head: cursor + (sel.empty ? 0 : text.length) },
    });
  };

  return (
    <Form.Field>
      {label && <label>{label}</label>}

      <div className={styles.editorWrapper}>
        {/* Left: Editor */}
        <div className={styles.editorColumn}>
          <div className={styles.editorLabel}>Edit</div>
          <div className={styles.editorToolbar}>
            <Button.Group size="mini">
              <Button type="button" basic onClick={() => toggleHeading(1)}>H1</Button>
              <Button type="button" basic onClick={() => toggleHeading(2)}>H2</Button>
              <Button type="button" basic onClick={() => toggleHeading(3)}>H3</Button>
            </Button.Group>
            <Button.Group size="mini">
              <Button type="button" basic onClick={() => wrapSelection("**")}>Bold</Button>
              <Button type="button" basic onClick={() => wrapSelection("_")}>Italic</Button>
              <Button type="button" basic onClick={() => wrapSelection("`")}>Code</Button>
            </Button.Group>
            <Button size="mini" type="button" basic onClick={() => insertCodeBlock("")}>
              Code Block
            </Button>
          </div>

          <div className={styles.editorBox} style={{ height: `${editorHeightPx}px` }}>
            <CodeMirror
              value={value}
              height={`${editorHeightPx}px`}
              placeholder={placeholder}
              theme={cmOneDark}
              extensions={[cmMarkdown()]}
              onChange={(val) => onChange(val)}
              onCreateEditor={(view) => (editorViewRef.current = view)}
              basicSetup={{ lineNumbers: true, foldGutter: true }}
            />
          </div>
        </div>

        {/* Right: Preview */}
        <div className={styles.previewColumn}>
          <div className={styles.editorLabel}>Preview</div>
          <div className={styles.previewBox} style={{ height: `${totalHeight}px` }}>
            <div className={styles.previewContent}>
              <MarkdownPreview value={value} />
            </div>
          </div>
        </div>
      </div>
    </Form.Field>
  );
};

/* ----------------------------- Tag Input ------------------------------ */

const TagInput = ({
  label = "Tags",
  placeholder = "e.g. react, java, c++",
  tags,
  setTags,
  required = false,
  disabled = false,
}) => {
  const [value, setValue] = useState("");
  const [hint, setHint] = useState("");

  const sanitize = (s) =>
    s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9+-]/g, "").trim(); // hyphen at end; no-useless-escape

  const addTag = (raw) => {
    const t = sanitize(raw);
    if (!t) return setHint("Tag is empty or invalid.");
    if (tags.includes(t)) return setHint("Tag already added.");
    setTags([...tags, t]);
    setValue("");
    setHint("");
  };

  const removeTag = (t) => {
    setTags(tags.filter((x) => x !== t));
    setHint("");
  };

  return (
    <Form.Field required={required}>
      <label>{label}</label>

      {/* Chips and input share a row. Chips don't force input to shrink. */}
      <div className={styles.tagRow}>
        <div className={styles.tagChips}>
          {tags.map((t) => (
            <Label key={t} color="blue" basic>
              {t}
              <Icon
                name="close"
                title="Remove"
                onClick={() => removeTag(t)}
                style={{ cursor: "pointer", marginLeft: 6 }}
              />
            </Label>
          ))}
        </div>

        <div className={styles.tagInputWrap}>
          <Input
            placeholder={placeholder}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (hint) setHint("");
            }}
            onKeyDown={(e) => {
              if (disabled) return;
              if (["Enter", "Tab"].includes(e.key) || (e.key === "," && value)) {
                e.preventDefault();
                addTag(value);
              }
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text") || "";
              if (!text) return;
              e.preventDefault();
              text
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
                .forEach(addTag);
            }}
            disabled={disabled}
            fluid
          />
        </div>
      </div>

      <small>
        {tags.length} tag{tags.length === 1 ? "" : "s"} added. Use Enter / “,” / Tab to add.
      </small>
      {hint && (
        <Message negative size="tiny" style={{ marginTop: 8 }}>
          {hint}
        </Message>
      )}
    </Form.Field>
  );
};

/* ------------------------------ Main Page ----------------------------- */

const PostPage = () => {
  const { user } = useAuth();

  // Mode
  const [postType, setPostType] = useState("article");

  // Common
  const [title, setTitle] = useState("");

  // Question
  const [qDescription, setQDescription] = useState("");
  const [qTags, setQTags] = useState([]);

  // Article
  const [abstract, setAbstract] = useState("");
  const [body, setBody] = useState("");
  const [articleTags, setArticleTags] = useState([]);
  const [imageUrl, setImageUrl] = useState("");

  // Upload
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadErr, setUploadErr] = useState("");

  // Form submit
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [notice, setNotice] = useState("");

  const fileInputRef = useRef();

  /* ----------------------------- Handlers ----------------------------- */

  const pickFile = (e) => {
    setUploadErr("");
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(f.type)) {
      setUploadErr("Please choose a PNG, JPG, WEBP, or GIF image.");
      e.target.value = "";
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setUploadErr("Image must be 5 MB or smaller.");
      e.target.value = "";
      return;
    }
    setFile(f);
  };

  const uploadImage = async () => {
    if (!file) return;
    try {
      setUploadErr("");
      setUploading(true);
      setUploadPct(0);

      const uid = user?.uid || "anonymous";
      const safe = file.name.replace(/\s+/g, "_");
      const storageRef = ref(storage, `article-images/${uid}/${Date.now()}-${safe}`);
      const task = uploadBytesResumable(storageRef, file);

      task.on(
        "state_changed",
        (snap) => setUploadPct(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        (err) => {
          setUploadErr(err.message || "Upload failed.");
          setUploading(false);
        },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          setImageUrl(url);
          setUploading(false);
        }
      );
    } catch (e) {
      setUploadErr(e.message || "Upload failed.");
      setUploading(false);
    }
  };

  const clearImage = () => {
    setFile(null);
    setImageUrl("");
    setUploadErr("");
    setUploadPct(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetForm = () => {
    setTitle("");
    setAbstract("");
    setBody("");
    setArticleTags([]);
    setImageUrl("");
    setFile(null);
    setQDescription("");
    setQTags([]);
  };

  const handleSubmit = async () => {
    setFormErr("");
    setNotice("");

    if (!title.trim()) return setFormErr("Title is required.");
    if (postType === "question" && qTags.length === 0)
      return setFormErr("Please add at least one tag for your question.");

    setSubmitting(true);
    try {
      if (postType === "article") {
        await createPost({
          title,
          abstract,
          body, // Markdown text
          tags: articleTags,
          imageUrl,
          authorId: user?.uid,
        });
        setNotice("Article posted successfully.");
      } else {
        await createQuestion({
          title,
          description: qDescription, // Markdown text
          tags: qTags,
          authorId: user?.uid,
        });
        setNotice("Question posted successfully.");
      }
      resetForm();
    } catch (e) {
      setFormErr(e.message || "Failed to post.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ------------------------------- View -------------------------------- */

  return (
    <div className={styles.container}>
      <h2>New Post</h2>

      <div className={styles.formRoot}>
        <Form>
          {/* Post Type */}
          <Form.Field>
            <label>Select Post Type</label>
            <Radio
              label="Question"
              name="postType"
              value="question"
              checked={postType === "question"}
              onChange={() => setPostType("question")}
              style={{ marginRight: "1rem" }}
            />
            <Radio
              label="Article"
              name="postType"
              value="article"
              checked={postType === "article"}
              onChange={() => setPostType("article")}
            />
          </Form.Field>

          {/* Common: Title */}
          <Form.Field required>
            <label>Title</label>
            <Input
              placeholder="Enter a descriptive title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Form.Field>

          {/* QUESTION */}
          {postType === "question" && (
            <>
              <MarkdownEditor
                label="Description"
                value={qDescription}
                onChange={setQDescription}
                minRows={12}
                placeholder="Describe your question in Markdown."
              />
              <TagInput
                label="Tags"
                placeholder="e.g. react, java, c++"
                tags={qTags}
                setTags={setQTags}
                required
              />
            </>
          )}

          {/* ARTICLE */}
          {postType === "article" && (
            <>
              <Form.Field>
                <label>Header Image</label>

                {/* Image preview ABOVE the buttons */}
                {imageUrl && (
                  <div className={styles.uploadPreviewBlock}>
                    <Image
                      src={imageUrl}
                      alt="Uploaded preview"
                      bordered
                      className={styles.uploadPreview}
                    />
                    <Message positive size="tiny" className={styles.uploadSuccessMsg}>
                      Image uploaded successfully.
                    </Message>
                    <span
  onClick={clearImage}
  className={styles.clearImage}
>
  <Icon name="times" size="small" /> Clear Image
</span>


                  </div>
                )}

                <div className={styles.uploadWrapper}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={pickFile}
                    disabled={uploading}
                    className={styles.hiddenFileInput}
                  />
                  <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    Browse
                  </Button>
                  <Button
                    type="button"
                    primary
                    onClick={uploadImage}
                    disabled={!file || uploading}
                    loading={uploading}
                    title="Upload selected image"
                    className="btn-primary"
                  >
                    Upload
                  </Button>
                </div>

                {uploading && (
                  <div className={styles.uploading}>
                    <Progress percent={uploadPct} indicating />
                  </div>
                )}

                {uploadErr && (
                  <Message negative size="tiny" className={styles.uploadError}>
                    {uploadErr}
                  </Message>
                )}
              </Form.Field>

              <Form.Field>
                <label>Abstract</label>
                <TextArea
                  placeholder="One-paragraph summary (Markdown supported)"
                  value={abstract}
                  onChange={(e) => setAbstract(e.target.value)}
                  rows={4}
                />
              </Form.Field>

              <MarkdownEditor
                label="Article Text"
                value={body}
                onChange={setBody}
                minRows={18}
                placeholder="Write your article in Markdown."
              />

              <TagInput
                label="Tags"
                placeholder="e.g. react, ui, firebase"
                tags={articleTags}
                setTags={setArticleTags}
              />
            </>
          )}

          {/* Submit + Alerts */}
          <Button
            primary
            type="button"
            onClick={handleSubmit}
            loading={submitting}
            disabled={submitting}
            className="btn-primary"
          >
            Post
          </Button>

          {notice && <Message positive className={styles.msg}>{notice}</Message>}
          {formErr && <Message negative className={styles.msg}>{formErr}</Message>}
        </Form>
      </div>
    </div>
  );
};

export default PostPage;

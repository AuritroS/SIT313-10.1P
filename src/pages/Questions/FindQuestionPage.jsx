import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Input,
  Label,
  Message,
  Segment,
  Icon,
  Divider,
  List,
} from "semantic-ui-react";
import { useNavigate } from "react-router-dom";

import useAuth from "../../hooks/useAuth";
import {
  listenToQuestions,
  listenToHiddenQuestionIds,
  hideQuestionForUser,
  unhideQuestionForUser,
  listenToQuestionOrder,
  saveQuestionOrder,
} from "../../api/firebase";

/* dnd-kit */
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";

/* Date range picker */
import { DateRangePicker } from "react-date-range";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

/* Styles */
import styles from "./FindQuestionPage.module.css";

/* ---------- Helpers ---------- */

const fmtDate = (ts) =>
  (ts?.toDate ? ts.toDate() : new Date(ts || Date.now())).toLocaleString();

const toJsDate = (ts) => {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts?.toDate === "function") return ts.toDate();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
};

const tagsOf = (q) =>
  Array.isArray(q.tags)
    ? q.tags.map((t) => String(t).toLowerCase())
    : q.tag
      ? [String(q.tag).toLowerCase()]
      : [];

const clip = (s = "", n = 160) =>
  String(s).length > n ? s.slice(0, n) + "…" : s;

/* ---------- Small UI Pieces ---------- */

const SearchBox = ({ value, onChange, onClear, pending }) => (
  <div className={styles.searchBox}>
    <Input
      icon="search"
      placeholder="Search title or description…"
      value={value}
      loading={pending}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: "100%" }}
    />
    {value && (
      <Icon
        name="close"
        link
        title="Clear search"
        onClick={onClear}
        className={styles.searchClear}
      />
    )}
  </div>
);

const DateRangeButton = ({ state, setState }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (open && ref.current && !ref.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const { active, ranges } = state;
  const { startDate, endDate } = ranges[0];
  const label =
    active && startDate && endDate
      ? `${startDate.toLocaleDateString()} – ${endDate.toLocaleDateString()}`
      : "Select date range";

  return (
    <div ref={ref} className={styles.dateButtonWrapper}>
      <Button
        basic
        onClick={() => setOpen((s) => !s)}
        icon
        labelPosition="left"
      >
        <Icon name="calendar" />
        {label}
      </Button>

      {open && (
        <div className={styles.datePopover}>
          <DateRangePicker
            months={2}
            direction="horizontal"
            moveRangeOnFirstSelection={false}
            showSelectionPreview
            ranges={ranges}
            onChange={(r) =>
              setState((prev) => ({
                ...prev,
                ranges: [
                  {
                    ...prev.ranges[0],
                    startDate: r.selection.startDate,
                    endDate: r.selection.endDate,
                  },
                ],
              }))
            }
          />
          <div className={styles.datePopoverActions}>
            <Button
              size="small"
              onClick={() =>
                setState({
                  active: false,
                  ranges: [
                    {
                      startDate: new Date(),
                      endDate: new Date(),
                      key: "selection",
                    },
                  ],
                })
              }
            >
              Reset
            </Button>
            <div className={styles.datePopoverBtns}>
              <Button size="small" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                className="btn-primary"
                size="small"
                primary
                onClick={() => {
                  setState((p) => ({ ...p, active: true }));
                  setOpen(false);
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const TagRow = ({ tags, muted = false }) => (
  <div className={styles.tagRow}>
    {tags.map((t) => (
      <Label
        key={t}
        basic
        className={muted ? styles.tagLabelMuted : styles.tagLabel}
      >
        {t}
      </Label>
    ))}
  </div>
);

const TagFilter = ({ tags, setTags, suggestions = [] }) => {
  const [v, setV] = useState("");
  const sanitize = (s) =>
    s
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9+\-]/g, "")
      .trim();
  const add = (raw) => {
    const t = sanitize(raw);
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setV("");
  };
  const remove = (t) => setTags(tags.filter((x) => x !== t));

  return (
    <div className={styles.tagFilter}>
      <div className={styles.tagList}>
        {tags.map((t) => (
          <Label
            key={t}
            basic
            className={`${styles.tagLabel} ${styles.tagItem}`}
          >
            {t}
            <Label.Detail
              as="a"
              onClick={() => remove(t)}
              className={styles.tagRemove}
            >
              ×
            </Label.Detail>
          </Label>
        ))}
      </div>
      <div>
        <Input
          placeholder="Add tag…  (Enter / , / Tab)"
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (["Enter", "Tab"].includes(e.key) || (e.key === "," && v)) {
              e.preventDefault();
              add(v);
            }
          }}
          onPaste={(e) => {
            const txt = e.clipboardData.getData("text") || "";
            if (!txt) return;
            e.preventDefault();
            txt
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
              .forEach(add);
          }}
          style={{ width: "100%" }}
          list="tag-suggestions"
        />
        <datalist id="tag-suggestions">
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
    </div>
  );
};

const SortableItem = ({ id, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: isDragging ? "rgba(0,0,0,0.03)" : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners })}
    </div>
  );
};

/* ---------- Main Page ---------- */

const FindQuestionPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Data
  const [questions, setQuestions] = useState([]);
  const [hiddenIds, setHiddenIds] = useState([]);

  // UI
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const searchPending = search !== deferredSearch;
  const [selectedTags, setSelectedTags] = useState([]);
  const [expanded, setExpanded] = useState({}); // { [id]: true }
  const [showHidden, setShowHidden] = useState(false);

  // Date range: inactive by default; when active, filter inclusively.
  const [dateRange, setDateRange] = useState({
    active: false,
    ranges: [{ startDate: new Date(), endDate: new Date(), key: "selection" }],
  });

  // Drag order (persisted per user)
  const [order, setOrder] = useState([]);

  /* Live queries */
  useEffect(() => {
    const unsub = listenToQuestions((snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setQuestions(items);
      setLoading(false);

      setOrder((prev) => {
        const prevSet = new Set(prev);
        const incoming = items.map((q) => q.id);
        const kept = prev.filter((id) => incoming.includes(id));
        const appended = incoming.filter((id) => !prevSet.has(id));
        return [...kept, ...appended];
      });
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = listenToHiddenQuestionIds(user.uid, (ids) =>
      setHiddenIds(ids || [])
    );
    return unsub;
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = listenToQuestionOrder(user.uid, (remote) =>
      setOrder((prev) => {
        const base = Array.isArray(remote) ? remote : prev;
        const set = new Set(base);
        const all = questions.map((q) => q.id);
        const append = all.filter((id) => !set.has(id));
        return [...base, ...append];
      })
    );
    return unsub;
  }, [user?.uid, questions]);

  /* Derived data */
  const tagSuggestions = useMemo(() => {
    const s = new Set();
    questions.forEach((q) => tagsOf(q).forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [questions]);

  const orderIndex = useMemo(() => {
    const map = new Map();
    order.forEach((id, i) => map.set(id, i));
    return map;
  }, [order]);

  const hiddenSet = useMemo(() => new Set(hiddenIds || []), [hiddenIds]);

  const filteredVisible = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase();
    const useDate = dateRange.active;
    const from = dateRange.ranges[0].startDate;
    const to = dateRange.ranges[0].endDate;

    return questions
      .filter((q) => !hiddenSet.has(q.id))
      .filter((q) => {
        const byText =
          !needle ||
          q.title?.toLowerCase().includes(needle) ||
          q.description?.toLowerCase().includes(needle);

        const qtags = tagsOf(q);
        const byTags =
          selectedTags.length === 0 ||
          selectedTags.every((t) => qtags.includes(t));

        const d = toJsDate(q.createdAt);
        const byDate =
          !useDate || !d
            ? !useDate || !d
            : (!from || d >= from) && (!to || d <= to);

        return byText && byTags && byDate;
      })
      .sort(
        (a, b) => (orderIndex.get(a.id) ?? 1e9) - (orderIndex.get(b.id) ?? 1e9)
      );
  }, [questions, hiddenSet, deferredSearch, selectedTags, dateRange, orderIndex]);

  const hiddenList = useMemo(
    () => questions.filter((q) => hiddenSet.has(q.id)),
    [questions, hiddenSet]
  );

  /* Actions */
  const onHide = async (id) => {
    setErr("");
    setExpanded((s) => ({ ...s, [id]: false }));
    try {
      await hideQuestionForUser(id);
    } catch (e) {
      setErr(e?.message || "Failed to hide.");
    }
  };

  const onUnhide = async (id) => {
    setErr("");
    try {
      await unhideQuestionForUser(id);
    } catch (e) {
      setErr(e?.message || "Failed to unhide.");
    }
  };

  /* Drag & drop */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;

    const visIds = filteredVisible.map((q) => q.id);
    const oldIdx = visIds.indexOf(active.id);
    const newIdx = visIds.indexOf(over.id);
    if (oldIdx < 0 || newIdx < 0) return;

    setOrder((prev) => {
      const cur = [...prev];
      const idx = visIds.map((id) => cur.indexOf(id));
      const from = idx[oldIdx];
      const to = idx[newIdx];
      const next = arrayMove(cur, from, to);
      if (user?.uid) saveQuestionOrder(user.uid, next).catch(() => {});
      return next;
    });
  };

  /* ---------- Render ---------- */

  return (
    <div className={styles.container}>
      <h2>Find Questions</h2>

      {/* Toolbar */}
      <Segment>
        <div className={styles.toolbar}>
          <div className={styles.toolbarTop}>
            <SearchBox
              value={search}
              onChange={setSearch}
              onClear={() => setSearch("")}
              pending={searchPending}
            />
            <DateRangeButton state={dateRange} setState={setDateRange} />
          </div>

          <div className={styles.toolbarBottom}>
            <TagFilter
              tags={selectedTags}
              setTags={setSelectedTags}
              suggestions={tagSuggestions}
            />
            <div className={styles.toolbarButtons}>
              <Button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSelectedTags([]);
                  setDateRange({
                    active: false,
                    ranges: [
                      {
                        startDate: new Date(),
                        endDate: new Date(),
                        key: "selection",
                      },
                    ],
                  });
                }}
                className={styles.outlineBtn}
              >
                Clear
              </Button>
              <Button
                type="button"
                basic={!showHidden}
                onClick={() => setShowHidden((s) => !s)}
                title={showHidden ? "Close hidden list" : "Open hidden list"}
                aria-pressed={showHidden}
                className={`${styles.outlineBtn} ${
                  showHidden ? styles.outlineBtnActive : ""
                }`}
              >
                <Icon name={showHidden ? "chevron up" : "chevron down"} />
                Hidden ({hiddenIds.length})
              </Button>
            </div>
          </div>
        </div>
      </Segment>

      {!loading && searchPending && (
        <div className={styles.pendingNotice} role="status" aria-live="polite">
          Filtering results…
        </div>
      )}

      {/* Hidden list */}
      {showHidden && (
        <Segment>
          <strong>Hidden questions ({hiddenList.length})</strong>
          {hiddenList.length === 0 ? (
            <Message size="tiny" style={{ marginTop: 8 }}>
              Nothing hidden.
            </Message>
          ) : (
            <List divided relaxed style={{ marginTop: 10 }}>
              {hiddenList.map((q) => {
                const t = tagsOf(q);
                return (
                  <List.Item key={q.id} className={styles.hiddenCard}>
                    <List.Content>
                      <div className={styles.itemHeaderRow}>
                        <List.Header as="h4" className={styles.itemTitle}>
                          {q.title}
                        </List.Header>
                        <Icon
                          name="undo"
                          link
                          color="black"
                          size="small"
                          title="Unhide"
                          aria-label="Unhide"
                          onClick={() => onUnhide(q.id)}
                        />
                      </div>
                      <TagRow tags={t} muted />

                      <div className={styles.itemMeta}>
                        {q.createdAt ? `Posted ${fmtDate(q.createdAt)}` : ""}
                      </div>
                      <div className={styles.itemBodyMuted}>
                        {clip(q.description, 180)}
                      </div>
                    </List.Content>
                  </List.Item>
                );
              })}
            </List>
          )}
        </Segment>
      )}

      {/* Visible list (sortable) */}
      {loading ? (
        <Message info>Loading questions…</Message>
      ) : filteredVisible.length === 0 ? (
        <Message>No questions match your filters.</Message>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <SortableContext
            items={filteredVisible.map((q) => q.id)}
            strategy={verticalListSortingStrategy}
          >
            <List divided relaxed>
              {filteredVisible.map((q) => {
                const isOpen = !!expanded[q.id];
                const t = tagsOf(q);

                return (
                  <SortableItem key={q.id} id={q.id}>
                    {({ attributes, listeners }) => (
                      <List.Item className={styles.listCard}>
                        <List.Content>
                          <div className={styles.itemHeaderRow}>
                            <span
                              {...attributes}
                              {...listeners}
                              title="Drag to reorder"
                              aria-label="Drag to reorder"
                              className={styles.dragHandle}
                            >
                              <Icon name="bars" size="small" color="grey" />
                            </span>

                            <List.Header
                              as="h4"
                              className={styles.itemTitle}
                              onClick={() => navigate(`/question/${q.id}`)}
                              style={{ cursor: "pointer" }}
                            >
                              {q.title}
                            </List.Header>

                            <Icon
                              name="close"
                              link
                              color="black"
                              size="small"
                              title="Hide"
                              onClick={() => onHide(q.id)}
                            />
                          </div>

                          <TagRow tags={t} muted />

                          <div className={styles.itemMeta}>
                            {q.createdAt
                              ? `Posted ${fmtDate(q.createdAt)}`
                              : ""}
                          </div>

                          {!isOpen && (
                            <div className={styles.itemBody}>
                              {clip(q.description, 160)}
                            </div>
                          )}

                          {isOpen && (
                            <>
                              <Divider style={{ margin: "12px 0" }} />
                              <div className={styles.itemFullBody}>
                                {q.description || "(no description)"}
                              </div>
                            </>
                          )}

                          <div className={styles.itemActions}>
                            <Button
                              size="small"
                              type="button"
                              onClick={() =>
                                setExpanded((s) => ({ ...s, [q.id]: !s[q.id] }))
                              }
                              icon
                              labelPosition="left"
                              className={`${styles.outlineBtn} ${isOpen ? styles.outlineBtnActive : ""}`}
                            >
                              <Icon
                                name={isOpen ? "chevron up" : "chevron down"}
                              />
                              {isOpen ? "Collapse" : "Expand"}
                            </Button>
                          </div>
                        </List.Content>
                      </List.Item>
                    )}
                  </SortableItem>
                );
              })}
            </List>
          </SortableContext>
        </DndContext>
      )}

      {err && (
        <Message negative style={{ marginTop: 12 }}>
          {err}
        </Message>
      )}
    </div>
  );
};

export default FindQuestionPage;

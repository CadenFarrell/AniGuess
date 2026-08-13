import { useMemo, useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, closestCorners, useDroppable, useSensor, useSensors,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  MAX_ROWS, addRow, clearRow, fillRow, moveCard, moveRow, placedIds, removeRow, renameRow,
  rowOf, setFormat, trayCards,
} from '../tiers';
import { tierTone } from '../utils/tierTone';
import { Badge, Banner, Button, Card, GhostButton, Input, Modal, Screen } from '../../../shared/ui';

// The tier list builder. Both formats, one component — a 'ranked' list is a
// tier list with one row (see ../tiers.js), so the only thing that branches
// here is whether a tile shows its position number and whether the row chrome
// is drawn at all.
//
// TWO GESTURES, ONE MUTATOR. Every tap and every drag ends in tiers.moveCard,
// which is what stops the two from drifting the way a second implementation
// always does.
//
//   tap   the primary gesture, and the reason is the same one RankBoard gives:
//         this is built for a phone. At two hundred cards it is also simply
//         better than dragging, because there is no drag-while-the-page-scrolls
//         problem — you tap a card, then tap the row you want it in.
//   drag  the refinement, for ordering inside a row and for a mouse.
//
// DRAG IS DELIBERATELY POINTER-ONLY. dnd-kit's KeyboardSensor activates on
// Space/Enter, which is the same keypress that fires a button's click — so
// wiring it to these tiles would make one key mean both "pick up" and "hold".
// The keyboard path is the tap path instead, and it is complete: every tile and
// every row is a real <button>, so a keyboard user can place any card anywhere
// without a pointer. That is a better answer than a half-working keyboard drag.

// Droppable zones are namespaced because card ids are folded titles: a show
// called "Tray" would otherwise produce the id the tray is listening on.
const ZONE = 'zone:';
const TRAY = 'tray';

// Above this the tray renders a search-filtered window instead of everything.
// A character pool runs to a few thousand cards, and the honest fix is to say
// so rather than to quietly render the first N (see the note under the tray) or
// to pull in a virtualization library this app has never needed.
const TRAY_CAP = 120;

const zoneIdOf = (list, id) => {
  const key = String(id);
  if (key.startsWith(ZONE)) return key.slice(ZONE.length);
  return rowOf(list, key)?.id ?? TRAY;
};

export default function TierBoard({
  list, cards, axis, dropped = 0, saveError, onChange, onBack, onCompare, canCompare,
}) {
  // The card being held by a TAP. Drag state is dnd-kit's and lives separately —
  // they are two different gestures and sharing one variable made a drag look
  // like a held card once it ended.
  const [heldId, setHeldId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [query, setQuery] = useState('');
  const [editRows, setEditRows] = useState(false);
  const [confirmFormat, setConfirmFormat] = useState(false);

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const tray = useMemo(() => trayCards(list, cards), [list, cards]);
  const placed = placedIds(list).length;
  const ranked = list.format === 'ranked';

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tray.slice(0, TRAY_CAP);
    return tray
      .filter((c) => `${c.title} ${c.subtitle}`.toLowerCase().includes(q))
      .slice(0, TRAY_CAP);
  }, [tray, query]);
  const matched = query.trim()
    ? tray.filter((c) => `${c.title} ${c.subtitle}`.toLowerCase().includes(query.trim().toLowerCase())).length
    : tray.length;

  // A distance constraint rather than a delay: without it dnd-kit swallows the
  // click, and tap-to-place — the primary gesture — would stop working on every
  // tile that is also draggable.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const apply = (next) => { if (next !== list) onChange(next); };

  // One tap handler for every tile, placed or not. Tapping the held card again
  // puts it down; tapping a different one swaps what is held, rather than
  // silently doing nothing.
  const handleTile = (cardId) => setHeldId((prev) => (prev === cardId ? null : cardId));

  const handleZone = (rowId) => {
    if (!heldId) return;
    apply(moveCard(list, heldId, rowId));
    setHeldId(null);
  };

  const handleDragEnd = ({ active, over }) => {
    setDraggingId(null);
    if (!over) return;
    const toZone = zoneIdOf(list, over.id);
    if (toZone === TRAY) return apply(moveCard(list, active.id, null));

    // Dropped ON a card: take that card's slot. The index is read BEFORE the
    // lift, which is what makes this match arrayMove for a move inside one row —
    // moveCard resolves the index after removing, and the two cancel out.
    const row = list.rows.find((r) => r.id === toZone);
    const at = String(over.id).startsWith(ZONE) ? -1 : row?.cards.indexOf(String(over.id)) ?? -1;
    // `at >= 0` alone would be wrong: null >= 0 is true in JS, so a drop on the
    // lane itself would insert at index null and land at the front.
    apply(moveCard(list, active.id, toZone, at >= 0 ? at : null));
  };

  return (
    <>
      <Screen width="lg" onBack={onBack} backLabel="← Saved lists">
        <header className="mb-6">
          <h1 className="font-display text-3xl font-black text-white">{list.name || 'Untitled list'}</h1>
          <p className="mt-1 text-base text-white/50">
            {axis.label} · {list.items === 'characters' ? 'Characters' : 'Shows'}
            {' · '}
            {ranked ? `#1 = ${axis.topLabel}` : `top row = ${axis.topLabel}`}
          </p>
        </header>

        {saveError && <Banner tone="danger" className="mb-4">⚠️ {saveError}</Banner>}

        {/* A saved list outlives the profile it was built from. Say what went
            rather than shrinking by three cards in silence. */}
        {dropped > 0 && (
          <Banner tone="warning" className="mb-4">
            {dropped} {dropped === 1 ? 'entry is' : 'entries are'} no longer on the list this was
            built from, so {dropped === 1 ? 'it has' : 'they have'} been removed.
          </Banner>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge tone={placed === cards.length ? 'lime' : 'amber'}>
            {placed} / {cards.length} placed
          </Badge>
          <span className="flex-1" />
          {/* Switching format keeps every card, but it does RESHAPE them —
              flattening loses the row boundaries and cutting back splits the
              order into even chunks, so a round trip does not return the tiers
              you started with. That is unavoidable (a tier list never had an
              order inside its rows to recover) which is exactly why it has to
              be asked rather than done on one tap next to "Edit rows". */}
          <Button
            variant="neutral"
            size="sm"
            onClick={() => (placed > 0
              ? setConfirmFormat(true)
              : apply(setFormat(list, ranked ? 'tiers' : 'ranked')))}
          >
            {ranked ? '📋 Use tiers' : '🔢 Use 1–N'}
          </Button>
          {!ranked && (
            <Button
              variant="neutral"
              size="sm"
              aria-pressed={editRows}
              onClick={() => setEditRows((v) => !v)}
            >
              {editRows ? '✓ Done editing' : '⚙️ Edit rows'}
            </Button>
          )}
          {canCompare && (
            <Button variant="secondary" size="sm" onClick={onCompare}>⚖️ Compare</Button>
          )}
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={({ active }) => { setDraggingId(String(active.id)); setHeldId(null); }}
          onDragCancel={() => setDraggingId(null)}
          onDragEnd={handleDragEnd}
        >
          <Card padding="sm" className="mb-6">
            {list.rows.map((row, i) => (
              <TierRow
                key={row.id}
                row={row}
                index={i}
                count={list.rows.length}
                ranked={ranked}
                byId={byId}
                heldId={heldId}
                editing={editRows}
                offset={ranked ? 0 : list.rows.slice(0, i).reduce((n, r) => n + r.cards.length, 0)}
                onTile={handleTile}
                onZone={() => handleZone(row.id)}
                onEject={(cardId) => apply(moveCard(list, cardId, null))}
                onRename={(label) => apply(renameRow(list, row.id, label))}
                onMove={(delta) => apply(moveRow(list, row.id, delta))}
                onRemove={() => apply(removeRow(list, row.id))}
                onClear={() => apply(clearRow(list, row.id))}
                onFill={() => apply(fillRow(list, row.id, cards))}
                canRemove={list.rows.length > 1}
              />
            ))}

            {editRows && !ranked && list.rows.length < MAX_ROWS && (
              <div className="pt-2">
                <Button variant="neutral" size="sm" fullWidth onClick={() => apply(addRow(list))}>
                  ＋ Add a row
                </Button>
              </div>
            )}
          </Card>

          <TrayZone
            cards={shown}
            total={tray.length}
            matched={matched}
            query={query}
            onQuery={setQuery}
            heldId={heldId}
            onTile={handleTile}
            onDropHere={() => handleZone(null)}
          />

          {/* Without an overlay a tile dragged out of its row is clipped by the
              row it came from, so it vanishes exactly when you need to aim it. */}
          <DragOverlay>
            {draggingId && byId.get(draggingId)
              ? <Tile card={byId.get(draggingId)} dragging />
              : null}
          </DragOverlay>
        </DndContext>
      </Screen>

      {confirmFormat && (
        <Modal onClose={() => setConfirmFormat(false)} width="sm">
          <h2 className="mb-3 font-display text-2xl font-black text-white">
            {ranked ? 'Cut this ranking into tiers?' : 'Flatten these tiers into one ranking?'}
          </h2>
          <p className="mb-6 text-base text-white/60">
            {ranked
              ? 'Your order is kept, split into five even rows from the top down. You can rename and resize them afterwards.'
              : 'Every card is kept, top row first. Switching back afterwards splits them into even rows rather than the ones you have now.'}
          </p>
          <div className="flex gap-3">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => {
                apply(setFormat(list, ranked ? 'tiers' : 'ranked'));
                setConfirmFormat(false);
              }}
            >
              {ranked ? '📋 Use tiers' : '🔢 Use 1–N'}
            </Button>
            <Button variant="neutral" size="lg" fullWidth onClick={() => setConfirmFormat(false)}>
              Cancel
            </Button>
          </div>
        </Modal>
      )}

      {/* Sticky rather than inline, because at two hundred cards the tray and
          the row you are aiming at are rarely on screen together. */}
      {heldId && byId.get(heldId) && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink bg-surface-2 px-4 py-3
            text-center"
        >
          <span className="font-display text-base font-extrabold text-white">
            Holding {byId.get(heldId).title}
          </span>
          <span className="ml-2 text-base text-white/50">— tap a row to place it</span>
          <GhostButton className="ml-3" onClick={() => setHeldId(null)}>Put down</GhostButton>
        </div>
      )}
    </>
  );
}

// One lane. The label chip is the row's identity and the lane is its drop
// target; they are never the same control, because "place the card I am
// holding" and "rename this row" must not share a tap.
function TierRow({
  row, index, count, ranked, byId, heldId, editing, offset,
  onTile, onZone, onEject, onRename, onMove, onRemove, onClear, onFill, canRemove,
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${ZONE}${row.id}` });
  const tone = tierTone(index, count);

  return (
    <div className="border-b-2 border-white/5 py-2 last:border-b-0">
      <div className="flex items-stretch gap-2">
        {!ranked && (
          <div className="flex w-16 flex-shrink-0 flex-col gap-1">
            {editing ? (
              // Uncontrolled on purpose. renameRow refuses to blank a label —
              // a row with no name has nothing to tap — so a controlled input
              // would snap back the moment you cleared it to retype.
              <Input
                defaultValue={row.label}
                onChange={(e) => onRename(e.target.value)}
                maxLength={4}
                aria-label={`Rename row ${row.label}`}
                className="h-11 w-full text-center font-display text-lg font-black uppercase"
              />
            ) : (
              <div
                className={`grid h-full min-h-14 place-items-center rounded-pop-sm border-2
                  border-ink ${tone.bg}`}
              >
                <span className={`font-display text-2xl font-black ${tone.text}`}>{row.label}</span>
              </div>
            )}
          </div>
        )}

        <div
          ref={setNodeRef}
          className={`min-w-0 flex-1 rounded-pop-sm border-2 border-dashed p-1.5 transition-colors
            ${isOver ? 'border-pop-amber bg-pop-amber/10' : 'border-white/10'}`}
        >
          <SortableContext items={row.cards} strategy={rectSortingStrategy}>
            <div className={ranked ? 'flex flex-col gap-1.5' : 'flex flex-wrap gap-1.5'}>
              {row.cards.map((id, i) => {
                const card = byId.get(id);
                if (!card) return null;
                return (
                  <SortableTile
                    key={id}
                    card={card}
                    held={heldId === id}
                    position={ranked ? offset + i + 1 : null}
                    wide={ranked}
                    onTap={() => onTile(id)}
                    onEject={() => onEject(id)}
                  />
                );
              })}

              {/* The tap target. Only rendered while something is held, so a
                  finished board is not littered with empty placeholders. */}
              {heldId && (
                <button
                  type="button"
                  onClick={onZone}
                  className={`focus-pop rounded-pop-sm border-2 border-dashed border-pop-amber
                    bg-pop-amber/10 px-3 font-display text-sm font-extrabold text-pop-amber
                    hover:bg-pop-amber/20 ${ranked ? 'h-12 w-full' : 'h-24 w-24'}`}
                >
                  ＋ Place{!ranked && ` in ${row.label}`}
                </button>
              )}

              {!heldId && row.cards.length === 0 && (
                <span className="px-2 py-6 text-sm text-white/25">Empty</span>
              )}
            </div>
          </SortableContext>
        </div>
      </div>

      {editing && !ranked && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button variant="neutral" size="sm" disabled={index === 0} onClick={() => onMove(-1)}>▲</Button>
          <Button variant="neutral" size="sm" disabled={index === count - 1} onClick={() => onMove(1)}>▼</Button>
          <Button variant="neutral" size="sm" onClick={onFill}>Fill from tray</Button>
          <Button variant="neutral" size="sm" disabled={!row.cards.length} onClick={onClear}>Empty</Button>
          <Button variant="danger" size="sm" disabled={!canRemove} onClick={onRemove}>
            ✕ Remove row
          </Button>
        </div>
      )}
    </div>
  );
}

function TrayZone({ cards, total, matched, query, onQuery, heldId, onTile, onDropHere }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${ZONE}${TRAY}` });
  const hidden = matched - cards.length;

  return (
    <Card title={`🗃️ Unplaced · ${total}`} padding="lg" className="mb-6">
      <Input
        type="search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Search unplaced…"
        aria-label="Search unplaced cards"
        className="mb-3 w-full"
      />

      {heldId && (
        <Button variant="neutral" size="sm" fullWidth className="mb-3" onClick={onDropHere}>
          ↩️ Put it back here
        </Button>
      )}

      <div
        ref={setNodeRef}
        className={`min-h-24 rounded-pop-sm border-2 border-dashed p-1.5 transition-colors
          ${isOver ? 'border-pop-amber bg-pop-amber/10' : 'border-white/10'}`}
      >
        <SortableContext items={cards.map((c) => c.id)} strategy={rectSortingStrategy}>
          <div className="flex flex-wrap gap-1.5">
            {cards.map((card) => (
              <SortableTile
                key={card.id}
                card={card}
                held={heldId === card.id}
                onTap={() => onTile(card.id)}
              />
            ))}
            {!cards.length && (
              <span className="px-2 py-6 text-sm text-white/25">
                {total ? 'Nothing matches that search.' : 'Everything is placed. 🎉'}
              </span>
            )}
          </div>
        </SortableContext>
      </div>

      {/* Said out loud rather than silently truncated: a tray that shows the
          first 120 of two thousand looks identical to one that is complete. */}
      {hidden > 0 && (
        <p className="mt-3 text-center text-sm text-white/50">
          {hidden} more not shown — search to narrow it down.
        </p>
      )}
    </Card>
  );
}

function SortableTile({ card, held, position, wide, onTap, onEject }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  return (
    <Tile
      card={card}
      held={held}
      position={position}
      wide={wide}
      onTap={onTap}
      onEject={onEject}
      innerRef={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }}
      handleProps={{ ...attributes, ...listeners }}
    />
  );
}

/**
 * One card.
 *
 * TITLE-FIRST, NEVER IMAGE-ONLY. Seed and hand-entered profiles carry no
 * coverImageUrl at all — only an AniList import writes one — so a tiermaker-style
 * grid of covers renders as a wall of grey boxes for anyone who has not
 * imported. The art is a thumbnail on top of the name, not instead of it.
 *
 * `touch-none` on the draggable surface, or a drag on a phone scrolls the page
 * underneath it instead of moving the card.
 */
function Tile({
  card, held, position, wide, dragging, onTap, onEject, innerRef, style, handleProps = {},
}) {
  // Two layouts, and every size class picked in one place per layout: mixing
  // `text-[11px]` and `text-sm` into one class string is a coin toss, because
  // Tailwind resolves conflicts by CSS order and not by the order they are written.
  const frame = wide
    ? 'flex w-full items-center gap-2 p-1.5'
    : 'flex w-24 flex-col items-center gap-1 p-1.5';
  const art = wide ? 'h-10 w-10' : 'h-14 w-full';
  const name = wide
    ? 'min-w-0 flex-1 truncate text-sm'
    : 'line-clamp-2 w-full text-center text-[11px]';

  return (
    <div
      ref={innerRef}
      style={style}
      className={`relative touch-none rounded-pop-sm border-2 transition-colors
        ${wide ? 'flex items-center' : ''}
        ${held ? 'border-pop-amber bg-pop-amber/20' : 'border-white/10 bg-surface-2'}
        ${dragging ? 'shadow-pop' : ''}`}
    >
      <button
        type="button"
        {...handleProps}
        onClick={onTap}
        aria-pressed={held}
        title={card.title}
        className={`focus-pop cursor-grab rounded-pop-sm text-left ${frame}`}
      >
        {position != null && (
          <span className="w-8 flex-shrink-0 text-center font-display text-base font-black text-pop-amber">
            {position}
          </span>
        )}
        {card.imageUrl ? (
          <img
            src={card.imageUrl}
            alt=""
            loading="lazy"
            className={`flex-shrink-0 rounded-sm border border-ink object-cover ${art}`}
          />
        ) : null}
        <span className={`font-display font-extrabold leading-tight text-white ${name}`}>
          {card.title}
        </span>
      </button>

      {/* A corner badge on a square tile, but an inline control on a full-width
          row — floating it off the corner of a row that spans the board leaves
          it hovering in the gap above, pointing at nothing. */}
      {onEject && (
        <button
          type="button"
          onClick={onEject}
          aria-label={`Return ${card.title} to the tray`}
          className={`focus-pop grid place-items-center rounded-full border-2 border-ink
            bg-surface font-black text-pop-red hover:bg-pop-red hover:text-ink
            ${wide
              ? 'mr-2 h-8 w-8 flex-shrink-0 text-sm'
              : 'absolute -right-1 -top-1 h-6 w-6 text-xs'}`}
        >
          ✕
        </button>
      )}
    </div>
  );
}

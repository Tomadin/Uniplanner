import { useEffect, useRef, useState } from 'react';
import { T } from '../design/tokens';
import { Icon } from '../components/ui/Icon';
import type { PersonalItem, PersonalList } from '../types';
import {
  usePersonalLists,
  useAddPersonalList,
  useRenamePersonalList,
  useDeletePersonalList,
  useAddPersonalItem,
  useTogglePersonalItem,
  useDeletePersonalItem,
} from '../hooks/usePersonalLists';

export function PersonalLife() {
  const { data: lists = [] } = usePersonalLists();
  const addList = useAddPersonalList();
  const [addingList, setAddingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [editingListId, setEditingListId] = useState<string | null>(null);

  const submitNewList = () => {
    const name = newListName.trim();
    if (!name) return;
    addList.mutate(name);
    setNewListName('');
    setAddingList(false);
  };

  return (
    <div style={{ padding: 32, maxWidth: 1080, margin: '0 auto' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 20, flexWrap: 'wrap', gap: 10,
      }}>
        <div>
          <h1 style={{
            fontFamily: T.fontDisplay, fontSize: 32, fontWeight: 400,
            color: T.ink, margin: 0, letterSpacing: -0.5,
          }}>Vida personal</h1>
          <div style={{ fontSize: 13, color: T.inkSoft, fontFamily: T.fontUI, marginTop: 4 }}>
            Listas livianas para todo lo que no va en la agenda.
          </div>
        </div>
        <button
          onClick={() => setAddingList(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', fontSize: 13, fontWeight: 500,
            fontFamily: T.fontUI, background: T.accent, color: '#FBFAF5',
            border: 'none', borderRadius: T.rFull, cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <Icon name="plus" size={14} stroke="#FBFAF5" />
          Nueva lista
        </button>
      </div>

      {addingList && (
        <div style={{
          background: T.surface, border: `2px solid ${T.accent}`,
          borderRadius: T.r3, padding: 16, marginBottom: 16,
          display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <input
            autoFocus
            value={newListName}
            onChange={e => setNewListName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submitNewList();
              if (e.key === 'Escape') { setAddingList(false); setNewListName(''); }
            }}
            placeholder='Nombre de la lista — "Fin de semana", "Súper", "Casa"…'
            style={{
              flex: 1, fontSize: 16, fontFamily: T.fontDisplay,
              background: T.bg, border: `1px solid ${T.line}`,
              borderRadius: T.r1, padding: '10px 12px',
              color: T.ink, outline: 'none',
            }}
          />
          <button
            onClick={() => { setAddingList(false); setNewListName(''); }}
            style={ghostBtnStyle}
          >Cancelar</button>
          <button
            onClick={submitNewList}
            disabled={!newListName.trim()}
            style={{ ...primaryBtnStyle, opacity: !newListName.trim() ? 0.5 : 1 }}
          >Crear</button>
        </div>
      )}

      {lists.length === 0 && !addingList && (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          fontFamily: T.fontUI, color: T.inkMuted,
        }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.25 }}>◌</div>
          <div style={{ fontSize: 14, marginBottom: 4 }}>Sin listas todavía.</div>
          <div style={{ fontSize: 12 }}>Creá tu primera lista para arrancar.</div>
        </div>
      )}

      <div style={{
        display: 'grid', gap: 20,
        gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))',
        alignItems: 'start',
      }}>
        {lists.map(list => (
          <ListCard
            key={list.id}
            list={list}
            editing={editingListId === list.id}
            onStartEditing={() => setEditingListId(list.id)}
            onStopEditing={() => setEditingListId(null)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── ListCard ─────────────────────────────────────────────────────────────────

function ListCard({
  list,
  editing,
  onStartEditing,
  onStopEditing,
}: {
  list: PersonalList;
  editing: boolean;
  onStartEditing: () => void;
  onStopEditing: () => void;
}) {
  const renameList = useRenamePersonalList();
  const deleteList = useDeletePersonalList();
  const addItem = useAddPersonalItem();
  const [newItem, setNewItem] = useState('');
  const [nameDraft, setNameDraft] = useState(list.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setNameDraft(list.name); }, [list.name]);

  const totalItems = list.items.length;
  const doneItems = list.items.filter(it => it.done).length;
  const allDone = totalItems > 0 && doneItems === totalItems;

  const saveName = () => {
    const n = nameDraft.trim();
    if (n && n !== list.name) renameList.mutate({ id: list.id, name: n });
    onStopEditing();
  };

  const submitItem = () => {
    const text = newItem.trim();
    if (!text) return;
    addItem.mutate({ listId: list.id, text });
    setNewItem('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.line}`,
      borderRadius: T.r3, padding: 24,
      opacity: allDone ? 0.72 : 1,
      transition: 'opacity 200ms',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onBlur={saveName}
              onKeyDown={e => {
                if (e.key === 'Enter') saveName();
                if (e.key === 'Escape') { setNameDraft(list.name); onStopEditing(); }
              }}
              style={{
                width: '100%',
                fontFamily: T.fontDisplay, fontSize: 26,
                fontWeight: 400, color: T.ink, letterSpacing: -0.3,
                background: T.bg, border: `1px solid ${T.line}`,
                borderRadius: T.r1, padding: '4px 8px', outline: 'none',
              }}
            />
          ) : (
            <div
              onClick={onStartEditing}
              style={{
                fontFamily: T.fontDisplay, fontSize: 26, fontWeight: 400,
                color: T.ink, letterSpacing: -0.3, cursor: 'text',
                textDecoration: allDone ? 'line-through' : 'none',
                textDecorationColor: T.inkMuted, textDecorationThickness: '1.5px',
                wordBreak: 'break-word',
              }}
            >
              {list.name}
            </div>
          )}
          <div style={{
            fontSize: 11, letterSpacing: 0.5, color: T.inkMuted,
            fontFamily: T.fontMono, marginTop: 4,
          }}>
            {totalItems === 0 ? 'vacía' : `${doneItems} / ${totalItems}`}
            {allDone && (
              <span style={{
                color: T.accent, marginLeft: 8, fontWeight: 600,
                fontFamily: T.fontUI, letterSpacing: 0.8,
              }}>✓ LISTO</span>
            )}
          </div>
        </div>
        <button
          onClick={() => {
            if (window.confirm(`¿Eliminar la lista "${list.name}"?`))
              deleteList.mutate(list.id);
          }}
          title="Eliminar lista"
          style={{
            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', borderRadius: T.rFull,
            cursor: 'pointer', color: T.inkMuted, flexShrink: 0,
          }}
        >
          <Icon name="trash" size={15} stroke={T.inkMuted} />
        </button>
      </div>

      {/* Barra de progreso */}
      {totalItems > 0 && (
        <div style={{
          height: 3, background: T.lineSoft, borderRadius: 2,
          marginBottom: 12, overflow: 'hidden',
        }}>
          <div style={{
            width: `${(doneItems / totalItems) * 100}%`,
            height: '100%',
            background: allDone ? T.accent : T.accentDim,
            transition: 'width 200ms',
          }} />
        </div>
      )}

      {/* Ítems */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
        {list.items.map(item => (
          <ItemRow key={item.id} item={item} listId={list.id} />
        ))}
      </div>

      {/* Agregar ítem */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 4px',
        borderTop: list.items.length > 0 ? `1px dashed ${T.lineSoft}` : 'none',
        paddingTop: list.items.length > 0 ? 10 : 4,
      }}>
        <div style={{
          width: 16, height: 16, borderRadius: 4,
          border: `1.5px dashed ${T.line}`, flexShrink: 0,
        }} />
        <input
          ref={inputRef}
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submitItem(); }}
          placeholder="Agregar ítem…"
          style={{
            flex: 1, fontSize: 14, fontFamily: T.fontUI,
            background: 'transparent', border: 'none',
            color: T.ink, outline: 'none', padding: '4px 0',
          }}
        />
        {newItem.trim() && (
          <button
            onClick={submitItem}
            style={{
              fontSize: 11, fontFamily: T.fontUI,
              background: T.accent, color: '#FBFAF5',
              border: 'none', padding: '4px 10px', borderRadius: T.rFull,
              cursor: 'pointer', fontWeight: 500,
            }}
          >+ Add</button>
        )}
      </div>
    </div>
  );
}

// ─── ItemRow ──────────────────────────────────────────────────────────────────

function ItemRow({ item, listId }: { item: PersonalItem; listId: string }) {
  const toggle = useTogglePersonalItem();
  const deleteItem = useDeletePersonalItem();
  const [hover, setHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '8px 6px', borderRadius: T.r1,
        background: hover ? T.bgAlt : 'transparent',
        transition: 'background 120ms',
      }}
    >
      <button
        onClick={() => toggle.mutate({ listId, itemId: item.id })}
        style={{
          width: 18, height: 18, flexShrink: 0,
          borderRadius: 4,
          border: `1.5px solid ${item.done ? T.accent : T.line}`,
          background: item.done ? T.accent : 'transparent',
          cursor: 'pointer', padding: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          marginTop: 1,
        }}
      >
        {item.done && (
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none"
            stroke="#FBFAF5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 10.5l4 4 8-9" />
          </svg>
        )}
      </button>
      <div
        onClick={() => toggle.mutate({ listId, itemId: item.id })}
        style={{
          flex: 1, fontSize: 15, fontFamily: T.fontUI,
          color: item.done ? T.inkMuted : T.ink,
          textDecoration: item.done ? 'line-through' : 'none',
          textDecorationColor: T.inkMuted, textDecorationThickness: '1px',
          wordBreak: 'break-word', lineHeight: 1.4, cursor: 'pointer',
        }}
      >
        {item.text}
      </div>
      {hover && (
        <button
          onClick={() => deleteItem.mutate({ listId, itemId: item.id })}
          title="Eliminar"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: T.inkMuted, fontSize: 16, padding: '0 4px', lineHeight: 1,
          }}
        >×</button>
      )}
    </div>
  );
}

// ─── Estilos de botones compartidos ──────────────────────────────────────────

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: '7px 14px', fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
  background: 'oklch(0.55 0.12 145)', color: '#FBFAF5',
  border: 'none', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
};

const ghostBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: '7px 14px', fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
  background: 'transparent', color: '#2C2A26',
  border: 'none', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
};

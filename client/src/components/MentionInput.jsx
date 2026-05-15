import { useState, useRef, useEffect } from 'react';
import { usersApi } from '../api';
import UserAvatar from './UserAvatar';

export default function MentionInput({ value, onChange, onSubmit, boardMembers, placeholder }) {
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!mentionQuery && mentionStart === -1) { setSuggestions([]); return; }
    if (mentionStart === -1) return;

    const matches = boardMembers.filter(m =>
      m.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(mentionQuery.toLowerCase())
    );
    setSuggestions(matches.slice(0, 6));
    setSelectedIdx(0);
  }, [mentionQuery, boardMembers, mentionStart]);

  function handleInput(e) {
    const val = e.target.value;
    onChange(val);

    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      setMentionStart(cursor - atMatch[0].length);
      setMentionQuery(atMatch[1]);
    } else {
      setMentionStart(-1);
      setMentionQuery('');
      setSuggestions([]);
    }
  }

  function insertMention(user) {
    const before = value.slice(0, mentionStart);
    const after = value.slice(textareaRef.current.selectionStart);
    const newValue = `${before}@${user.name} ${after}`;
    onChange(newValue);
    setMentionStart(-1);
    setMentionQuery('');
    setSuggestions([]);
    setTimeout(() => {
      const pos = before.length + user.name.length + 2;
      textareaRef.current?.setSelectionRange(pos, pos);
      textareaRef.current?.focus();
    }, 0);
  }

  function handleKeyDown(e) {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); insertMention(suggestions[selectedIdx]); return; }
      if (e.key === 'Escape') { setSuggestions([]); setMentionStart(-1); return; }
    }

    if (e.key === 'Enter' && !e.shiftKey && suggestions.length === 0) {
      e.preventDefault();
      onSubmit?.();
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Write a comment… (@ to mention)'}
        rows={2}
        className="w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
      />

      {suggestions.length > 0 && (
        <div className="mention-dropdown">
          {suggestions.map((user, i) => (
            <button
              key={user.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); insertMention(user); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                i === selectedIdx ? 'bg-indigo-50 dark:bg-indigo-950/50' : 'hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              <UserAvatar user={user} size={22} />
              <div className="text-left">
                <div className="font-medium text-gray-800 dark:text-slate-200 text-xs">{user.name}</div>
                <div className="text-gray-400 dark:text-slate-500 text-xs">{user.email}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

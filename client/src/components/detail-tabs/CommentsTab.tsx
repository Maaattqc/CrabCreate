import { useState, useEffect, useRef } from 'react';
import { Send, Edit3, Trash2, Smile } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import { useProject } from '../../hooks/useProject';
import { useTypingIndicator } from '../../hooks/useCollaboration';
import { getProjectMembers } from '../../api/projects';
import VoiceTextarea from '../common/VoiceTextarea';
import * as commentsApi from '../../api/comments';
import type { Comment, ProjectMember } from '../../types';

const REACTION_EMOJIS = ['\u{1F44D}', '\u{1F44E}', '\u{2764}\u{FE0F}', '\u{1F389}', '\u{1F440}', '\u{1F680}'];

interface CommentsTabProps {
  ticketId: number;
}

export default function CommentsTab({ ticketId }: CommentsTabProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { currentProject } = useProject();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState<number | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { on, off } = useSocket();
  const { typingUsers, sendTyping, sendStopTyping } = useTypingIndicator(ticketId);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch project members for @mention autocomplete
  useEffect(() => {
    if (currentProject?.id) {
      getProjectMembers(currentProject.id).then(setMembers).catch(() => {});
    }
  }, [currentProject?.id]);

  const refreshComments = () => {
    commentsApi.fetchComments(ticketId).then(data => {
      setComments(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    refreshComments();
  }, [ticketId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time sync: refetch when another user modifies comments/reactions
  useEffect(() => {
    on('ticket:updated', (data: { ticketId: number }) => {
      if (data.ticketId === ticketId) refreshComments();
    });
    return () => { off('ticket:updated'); };
  }, [on, off, ticketId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments.length]);

  const handleSend = async () => {
    if (!newComment.trim()) return;
    try {
      const comment = await commentsApi.createComment(ticketId, newComment.trim());
      setComments(prev => [...prev, comment]);
      setNewComment('');
      sendStopTyping();
    } catch { /* ignore */ }
  };

  const handleEdit = async (commentId: number) => {
    if (!editContent.trim()) return;
    try {
      const updated = await commentsApi.updateComment(ticketId, commentId, editContent.trim());
      setComments(prev => prev.map(c => c.id === commentId ? { ...updated, reactions: c.reactions } : c));
      setEditingId(null);
      setEditContent('');
    } catch { /* ignore */ }
  };

  const handleDelete = async (commentId: number) => {
    try {
      await commentsApi.deleteComment(ticketId, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch { /* ignore */ }
  };

  const handleReaction = async (commentId: number, emoji: string) => {
    try {
      const result = await commentsApi.toggleReaction(ticketId, commentId, emoji);
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, reactions: result.reactions } : c));
      setShowEmojiPicker(null);
    } catch { /* ignore */ }
  };

  const handleInputChange = (value: string) => {
    setNewComment(value);
    sendTyping();
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => sendStopTyping(), 2000);

    // Detect @mention
    const textarea = inputRef.current;
    if (textarea) {
      const cursor = textarea.selectionStart;
      const textBefore = value.substring(0, cursor);
      const atMatch = textBefore.match(/@([\w.+-]*)$/);
      if (atMatch) {
        setMentionQuery(atMatch[1].toLowerCase());
        setMentionIndex(0);
      } else {
        setMentionQuery(null);
      }
    }
  };

  const filteredMembers = mentionQuery !== null
    ? members.filter(m => m.email.toLowerCase().includes(mentionQuery) && m.user_id !== user?.id).slice(0, 6)
    : [];

  const insertMention = (email: string) => {
    const textarea = inputRef.current;
    if (!textarea) return;
    const cursor = textarea.selectionStart;
    const textBefore = newComment.substring(0, cursor);
    const textAfter = newComment.substring(cursor);
    const atPos = textBefore.lastIndexOf('@');
    const newText = textBefore.substring(0, atPos) + '@' + email + ' ' + textAfter;
    setNewComment(newText);
    setMentionQuery(null);
    setTimeout(() => {
      const newCursor = atPos + email.length + 2;
      textarea.focus();
      textarea.setSelectionRange(newCursor, newCursor);
    }, 0);
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  const username = (email: string) => email.split('@')[0];

  // Group reactions by emoji
  const groupReactions = (reactions: Comment['reactions']) => {
    const groups: Record<string, { emoji: string; count: number; users: string[]; hasReacted: boolean }> = {};
    for (const r of reactions) {
      if (!groups[r.emoji]) {
        groups[r.emoji] = { emoji: r.emoji, count: 0, users: [], hasReacted: false };
      }
      groups[r.emoji].count++;
      groups[r.emoji].users.push(username(r.email));
      if (r.user_id === user?.id) groups[r.emoji].hasReacted = true;
    }
    return Object.values(groups);
  };

  // Render content with @mention highlighting
  const renderContent = (content: string) => {
    const parts = content.split(/(@[\w.+-]+@[\w.-]+\.\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@') && part.includes('.')) {
        return <span key={i} className="text-amber-400 font-medium bg-amber-500/10 px-0.5 rounded">{part}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  if (loading) {
    return <div className="p-6 text-center text-tx-faint text-sm">{t.loading}</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {comments.length === 0 && (
          <p className="text-center text-tx-faint text-sm py-8">{t.commentsEmpty}</p>
        )}
        {comments.map(comment => (
          <div key={comment.id} className="group">
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {username(comment.email)[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-tx-primary">{username(comment.email)}</span>
                  <span className="text-[10px] text-tx-ghost">{formatDate(comment.created_at)}</span>
                  {comment.updated_at !== comment.created_at && (
                    <span className="text-[10px] text-tx-ghost italic">{t.commentsEdited}</span>
                  )}
                </div>

                {editingId === comment.id ? (
                  <div className="flex gap-2">
                    <input
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleEdit(comment.id); if (e.key === 'Escape') setEditingId(null); }}
                      className="flex-1 bg-subtle border border-th-border rounded px-2 py-1 text-sm text-tx-primary focus:outline-none focus:border-amber-500/50"
                      autoFocus
                    />
                    <button onClick={() => handleEdit(comment.id)} className="text-xs text-amber-400 hover:text-amber-300">{t.save}</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-tx-faint hover:text-tx-tertiary">{t.cancel}</button>
                  </div>
                ) : (
                  <p className="text-sm text-tx-tertiary leading-relaxed whitespace-pre-wrap">{renderContent(comment.content)}</p>
                )}

                {/* Reactions */}
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  {groupReactions(comment.reactions).map(group => (
                    <button
                      key={group.emoji}
                      onClick={() => handleReaction(comment.id, group.emoji)}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                        group.hasReacted
                          ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                          : 'bg-subtle border-th-border text-tx-faint hover:border-th-border-strong'
                      }`}
                      title={group.users.join(', ')}
                    >
                      {group.emoji} {group.count}
                    </button>
                  ))}

                  {/* Add reaction button */}
                  <div className="relative">
                    <button
                      onClick={() => setShowEmojiPicker(showEmojiPicker === comment.id ? null : comment.id)}
                      className="p-1 rounded text-tx-ghost hover:text-amber-400 transition-colors"
                      title={t.reactionsAdd}
                    >
                      <Smile size={14} />
                    </button>
                    {showEmojiPicker === comment.id && (
                      <div className="absolute bottom-full left-0 mb-1 bg-surface border border-th-border rounded-lg shadow-lg p-1.5 flex gap-1 z-10">
                        {REACTION_EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(comment.id, emoji)}
                            className="w-7 h-7 rounded hover:bg-subtle-hover transition-colors text-sm flex items-center justify-center"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Edit/Delete buttons (own comments) */}
                  {comment.user_id === user?.id && editingId !== comment.id && (
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 ml-auto transition-opacity">
                      <button
                        onClick={() => { setEditingId(comment.id); setEditContent(comment.content); }}
                        className="p-1 rounded text-tx-ghost hover:text-tx-faint"
                        title={t.commentsEdit}
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="p-1 rounded text-tx-ghost hover:text-red-400"
                        title={t.commentsDelete}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-[11px] text-tx-faint">
              {typingUsers.map(u => u.email.split('@')[0]).join(', ')} {t.commentsTyping}
            </span>
          </div>
        )}
      </div>

      {/* Comment input */}
      <div className="border-t border-th-border p-3">
        {/* @mention autocomplete dropdown */}
        {mentionQuery !== null && filteredMembers.length > 0 && (
          <div className="mb-1 bg-surface border border-th-border rounded-lg shadow-lg overflow-hidden">
            {filteredMembers.map((m, i) => (
              <button
                key={m.user_id}
                onClick={() => insertMention(m.email)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                  i === mentionIndex ? 'bg-amber-500/15 text-amber-400' : 'text-tx-tertiary hover:bg-subtle-hover'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-bold flex items-center justify-center shrink-0">
                  {m.email[0]?.toUpperCase()}
                </div>
                <span className="truncate">{m.email}</span>
                <span className="text-[10px] text-tx-ghost ml-auto shrink-0">{m.role}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <VoiceTextarea
            ref={inputRef}
            value={newComment}
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={e => {
              if (mentionQuery !== null && filteredMembers.length > 0) {
                if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, filteredMembers.length - 1)); return; }
                if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return; }
                if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(filteredMembers[mentionIndex].email); return; }
                if (e.key === 'Escape') { e.preventDefault(); setMentionQuery(null); return; }
              }
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder={t.commentsPlaceholder}
            className="flex-1 bg-subtle border border-th-border rounded-lg px-3 py-2 text-sm text-tx-primary placeholder-tx-ghost focus:outline-none focus:border-amber-500/50 resize-none min-h-[38px] max-h-[120px]"
            rows={1}
            containerClassName="flex-1"
          />
          <button
            onClick={handleSend}
            disabled={!newComment.trim()}
            className="px-3 py-2 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-[10px] text-tx-ghost mt-1">{t.commentsMentionHint}</p>
      </div>
    </div>
  );
}

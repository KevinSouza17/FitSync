import { useState, useCallback } from "react";
import { Share2, X, Users, Search, Send, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { AvatarPreview } from "./ui/AvatarPreview";

interface Friend {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  shareUrl: string;
  shareText: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
}

export function ShareModal({ open, onClose, shareUrl, shareText, mediaUrl, mediaType }: ShareModalProps) {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendSearch, setFriendSearch] = useState("");
  const [shareLoading, setShareLoading] = useState<string | null>(null);
  const [sharedFriendId, setSharedFriendId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadFriends = useCallback(async () => {
    if (!user) return;
    setLoaded(true);
    const { data } = await supabase
      .from("follows")
      .select("followee_id")
      .eq("follower_id", user.id)
      .eq("status", "accepted");
    if (!data || data.length === 0) {
      setFriends([]);
      return;
    }
    const ids = data.map((f) => f.followee_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", ids);
    setFriends((profiles || []).map((p) => ({ user_id: p.id, full_name: p.full_name, avatar_url: p.avatar_url })));
  }, [user]);

  if (!open) return null;

  async function shareWithFriend(friend: Friend) {
    if (!user) return;
    setShareLoading(friend.user_id);
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .or(`and(user_a_id.eq.${user.id},user_b_id.eq.${friend.user_id}),and(user_a_id.eq.${friend.user_id},user_b_id.eq.${user.id})`)
      .maybeSingle();

    let convId = existing?.id;
    if (!convId) {
      const { data: newConv } = await supabase
        .from("conversations")
        .insert({ user_a_id: user.id, user_b_id: friend.user_id })
        .select("id")
        .single();
      convId = newConv?.id;
    }

    if (convId) {
      await supabase.from("messages").insert({
        conversation_id: convId,
        sender_id: user.id,
        content: shareText,
        media_url: mediaUrl || null,
        media_type: mediaType || null,
      });
      setSharedFriendId(friend.user_id);
      setTimeout(() => setSharedFriendId(null), 2000);
    }
    setShareLoading(null);
  }

  async function handleNativeShare() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "FitSync", text: shareText, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert("Link copiado!");
      }
    } catch { /* cancelled */ }
  }

  const filteredFriends = friends.filter((f) =>
    !friendSearch.trim() || (f.full_name || "").toLowerCase().includes(friendSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white dark:bg-surface-card sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-edge-base px-5 py-4">
          <h2 className="text-lg font-bold text-content-strong">Compartilhar</h2>
          <button onClick={onClose} className="text-content-muted hover:text-content-body">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col gap-3 overflow-y-auto p-5">
          <button
            onClick={handleNativeShare}
            className="flex items-center gap-3 rounded-xl border border-edge-base bg-surface-base px-4 py-3 text-sm font-medium text-content-body transition-colors hover:bg-surface-subtle"
          >
            <Share2 className="h-5 w-5 text-primary-500" />
            Compartilhar fora do app
          </button>

          <div className="flex items-center gap-2 pt-2">
            <Users className="h-4 w-4 text-content-muted" />
            <span className="text-sm font-medium text-content-muted">Enviar para amigos</span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
            <input
              type="text"
              value={friendSearch}
              onChange={(e) => setFriendSearch(e.target.value)}
              onFocus={() => { if (!loaded) loadFriends(); }}
              placeholder="Buscar amigos..."
              className="flex h-10 w-full rounded-lg border border-edge-base bg-surface-base pl-9 pr-3 text-sm text-content-strong placeholder:text-content-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>

          {filteredFriends.length === 0 ? (
            <p className="py-6 text-center text-sm text-content-muted">
              {friends.length === 0 ? "Você ainda não segue ninguém." : "Nenhum amigo encontrado."}
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {filteredFriends.map((friend) => (
                <button
                  key={friend.user_id}
                  onClick={() => shareWithFriend(friend)}
                  disabled={shareLoading !== null}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-subtle disabled:opacity-50"
                >
                  <AvatarPreview src={friend.avatar_url} name={friend.full_name || "Usuario"} userId={friend.user_id} size="sm" />
                  <span className="flex-1 text-sm font-medium text-content-strong">{friend.full_name || "Usuario"}</span>
                  {sharedFriendId === friend.user_id ? (
                    <span className="text-xs font-semibold text-green-600">Enviado!</span>
                  ) : shareLoading === friend.user_id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary-500" />
                  ) : (
                    <Send className="h-4 w-4 text-content-muted" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

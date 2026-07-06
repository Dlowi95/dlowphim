import React from "react";
import { Heart } from "lucide-react";
import { EMOJIS } from "./ReactionEmojis";

interface ReactionsSummaryProps {
  commentId: string;
  reactionsSummary?: { type: string; count: number }[];
  userReaction?: string | null;
  handleReaction: (commentId: string, type: string) => void;
  isReply?: boolean;
}

export function ReactionsSummary({
  commentId,
  reactionsSummary,
  userReaction,
  handleReaction,
  isReply = false,
}: ReactionsSummaryProps) {
  if (!reactionsSummary || reactionsSummary.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 pt-1.5 pb-1 select-none`}>
      {reactionsSummary.map((react) => {
        const emojiObj = EMOJIS.find((e) => e.type === react.type);
        const isMyReact = userReaction === react.type;
        return (
          <div
            key={react.type}
            onClick={() => handleReaction(commentId, react.type)}
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border cursor-pointer transition-all ${
              isReply
                ? "text-[9px] px-1.5 py-0.2"
                : "text-[10px]"
            } font-extrabold ${
              isMyReact
                ? "bg-pink-500/10 border-pink-500/20 text-pink-400"
                : "bg-[#1b1d2a]/40 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-white"
            }`}
          >
            {emojiObj?.imageUrl ? (
              <img
                src={emojiObj.imageUrl}
                alt={emojiObj.text}
                width={isReply ? 10 : 13}
                height={isReply ? 10 : 13}
                style={{ width: isReply ? 10 : 13, height: isReply ? 10 : 13 }}
                className="object-contain select-none pointer-events-none shrink-0"
              />
            ) : (
              <span className={isReply ? "text-xs" : "text-sm"}>{emojiObj?.label}</span>
            )}
            <span className="font-extrabold">{react.count}</span>
          </div>
        );
      })}
    </div>
  );
}

interface ReactTriggerButtonProps {
  commentId: string;
  userReaction?: string | null;
  activeEmojiMenuId: string | null;
  setActiveEmojiMenuId: (id: string | null) => void;
  handleReaction: (commentId: string, type: string) => void;
  user: any;
  size?: number;
}

export function ReactTriggerButton({
  commentId,
  userReaction,
  activeEmojiMenuId,
  setActiveEmojiMenuId,
  handleReaction,
  user,
  size = 11,
}: ReactTriggerButtonProps) {
  const currentEmoji = EMOJIS.find((e) => e.type === userReaction);

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => user && setActiveEmojiMenuId(commentId)}
      onMouseLeave={() => setActiveEmojiMenuId(null)}
    >
      <button
        type="button"
        onClick={() => handleReaction(commentId, userReaction || "heart")}
        className={`flex items-center gap-1.5 hover:text-zinc-300 transition-all cursor-pointer bg-transparent border-none font-bold`}
        style={{ fontSize: size === 11 ? "10px" : "9px" }}
      >
        {userReaction && currentEmoji?.imageUrl ? (
          <img
            src={currentEmoji.imageUrl}
            alt={currentEmoji.text}
            width={16}
            height={16}
            style={{ width: 16, height: 16 }}
            className="object-contain select-none pointer-events-none shrink-0"
          />
        ) : (
          <Heart size={size} className="stroke-[2.5]" />
        )}
        <span className={currentEmoji ? currentEmoji.color : "text-zinc-500"}>
          {currentEmoji ? currentEmoji.text : "Tim"}
        </span>
      </button>

      {/* Emoji Bubble Panel on hover */}
      {activeEmojiMenuId === commentId && (
        <div className="absolute bottom-full left-0 pb-2.5 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="bg-[#0d0e13]/95 backdrop-blur-md border border-zinc-800/80 rounded-full px-3.5 py-2 flex gap-3.5 shadow-2xl items-center w-max">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji.type}
                type="button"
                onClick={() => {
                  handleReaction(commentId, emoji.type);
                  setActiveEmojiMenuId(null);
                }}
                className="hover:scale-130 active:scale-95 transition-transform duration-100 cursor-pointer bg-transparent border-none p-0.5 select-none"
                title={emoji.text}
              >
                {emoji.imageUrl ? (
                  <img
                    src={emoji.imageUrl}
                    alt={emoji.text}
                    width={26}
                    height={26}
                    style={{ width: 26, height: 26 }}
                    className="object-contain pointer-events-none shrink-0"
                  />
                ) : (
                  emoji.label
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

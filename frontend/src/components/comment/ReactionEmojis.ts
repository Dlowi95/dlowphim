export const EMOJIS = [
  { type: "like", label: "👍", text: "Thích", color: "text-blue-400" },
  { type: "love", label: "❤️", text: "Yêu thích", color: "text-red-500" },
  { type: "haha", label: "😂", text: "Haha", color: "text-yellow-400" },
  { type: "wow", label: "😮", text: "Wow", color: "text-yellow-400" },
  { type: "sad", label: "😢", text: "Buồn", color: "text-blue-300" },
  { type: "angry", label: "😡", text: "Phẫn nộ", color: "text-orange-500" },
];

export interface CommentReaction {
  type: string;
  count: number;
}

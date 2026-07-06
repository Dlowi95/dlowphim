export const EMOJIS = [
  { type: "heart", label: "❤️", imageUrl: "/images/emoji/1.png", text: "Tim", color: "text-red-500" },
  { type: "haha", label: "😆", imageUrl: "/images/emoji/2.png", text: "Haha", color: "text-yellow-400" },
  { type: "sad", label: "🥺", imageUrl: "/images/emoji/3.png", text: "Thương thương", color: "text-blue-300" },
  { type: "wow", label: "😳", imageUrl: "/images/emoji/4.png", text: "Kinh ngạc", color: "text-orange-400" },
  { type: "pig", label: "🐽", imageUrl: "/images/emoji/5.png", text: "Heo con", color: "text-pink-400" },
];

export interface CommentReaction {
  type: string;
  count: number;
}

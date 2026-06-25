import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Comment, CommentDocument } from './schemas/comment.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';

function getFriendlyTime(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'Vừa xong';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  const months = Math.floor(days / 30);
  return `${months} tháng trước`;
}

@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async getComments(movieSlug: string, currentUserId?: string) {
    const comments = await this.commentModel
      .find({ movieSlug })
      .sort({ createdAt: -1 })
      .exec();

    const userIdObj = currentUserId ? new Types.ObjectId(currentUserId) : null;

    return comments.map((c) => {
      const upvotesCount = c.upvotes ? c.upvotes.length : 0;
      const downvotesCount = c.downvotes ? c.downvotes.length : 0;

      let userVote: 'up' | 'down' | null = null;
      if (userIdObj) {
        if (c.upvotes?.some((id) => id.toString() === userIdObj.toString())) {
          userVote = 'up';
        } else if (c.downvotes?.some((id) => id.toString() === userIdObj.toString())) {
          userVote = 'down';
        }
      }

      return {
        id: c._id.toString(),
        name: c.displayName,
        avatar: c.displayName ? c.displayName[0].toUpperCase() : 'U',
        avatarUrl: c.avatar || undefined,
        role: c.role || 'member',
        content: c.content,
        time: getFriendlyTime((c as any).createdAt || new Date()),
        likes: upvotesCount - downvotesCount,
        liked: userVote === 'up',
        userVote,
        isSpoiler: c.isSpoiler,
        episodeLabel: c.episodeLabel,
      };
    });
  }

  async createComment(
    userId: string,
    movieSlug: string,
    createDto: { content: string; isSpoiler?: boolean; episodeLabel?: string },
  ) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }

    const newComment = new this.commentModel({
      movieSlug,
      userId: new Types.ObjectId(userId),
      displayName: user.displayName,
      avatar: user.avatar,
      role: 'member', // Default to member role
      content: createDto.content,
      isSpoiler: !!createDto.isSpoiler,
      episodeLabel: createDto.episodeLabel,
      upvotes: [],
      downvotes: [],
    });

    const saved = await newComment.save();
    return {
      id: saved._id.toString(),
      name: saved.displayName,
      avatar: saved.displayName ? saved.displayName[0].toUpperCase() : 'U',
      avatarUrl: saved.avatar || undefined,
      role: saved.role,
      content: saved.content,
      time: 'Vừa xong',
      likes: 0,
      liked: false,
      userVote: null,
      isSpoiler: saved.isSpoiler,
      episodeLabel: saved.episodeLabel,
    };
  }

  async toggleVote(commentId: string, userId: string, voteType: 'up' | 'down') {
    const comment = await this.commentModel.findById(commentId).exec();
    if (!comment) {
      throw new NotFoundException('Không tìm thấy bình luận');
    }

    const userIdObj = new Types.ObjectId(userId);

    const hasUpvoted = comment.upvotes?.some((id) => id.toString() === userId);
    const hasDownvoted = comment.downvotes?.some((id) => id.toString() === userId);

    if (voteType === 'up') {
      if (hasUpvoted) {
        // Toggle off
        comment.upvotes = comment.upvotes.filter((id) => id.toString() !== userId);
      } else {
        // Toggle on upvote, remove from downvote
        comment.upvotes = [...(comment.upvotes || []), userIdObj];
        comment.downvotes = (comment.downvotes || []).filter((id) => id.toString() !== userId);
      }
    } else {
      if (hasDownvoted) {
        // Toggle off
        comment.downvotes = comment.downvotes.filter((id) => id.toString() !== userId);
      } else {
        // Toggle on downvote, remove from upvote
        comment.downvotes = [...(comment.downvotes || []), userIdObj];
        comment.upvotes = (comment.upvotes || []).filter((id) => id.toString() !== userId);
      }
    }

    const saved = await comment.save();

    const upvotesCount = saved.upvotes ? saved.upvotes.length : 0;
    const downvotesCount = saved.downvotes ? saved.downvotes.length : 0;

    let userVote: 'up' | 'down' | null = null;
    if (saved.upvotes?.some((id) => id.toString() === userId)) {
      userVote = 'up';
    } else if (saved.downvotes?.some((id) => id.toString() === userId)) {
      userVote = 'down';
    }

    return {
      likes: upvotesCount - downvotesCount,
      liked: userVote === 'up',
      userVote,
    };
  }
}

import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Rating, RatingDocument } from './schemas/rating.schema';

@Injectable()
export class RatingsService {
  constructor(
    @InjectModel(Rating.name) private ratingModel: Model<RatingDocument>,
  ) {}

  async getMovieRating(movieSlug: string, currentUserId?: string) {
    const ratings = await this.ratingModel.find({ movieSlug }).exec();
    const count = ratings.length;
    
    let average = 0;
    if (count > 0) {
      const sum = ratings.reduce((acc, r) => acc + r.score, 0);
      average = parseFloat((sum / count).toFixed(1));
    }

    let userRating: number | null = null;
    if (currentUserId) {
      const found = ratings.find((r) => r.userId.toString() === currentUserId);
      if (found) {
        userRating = found.score;
      }
    }

    return {
      average,
      count,
      userRating,
    };
  }

  async rateMovie(movieSlug: string, userId: string, score: number) {
    if (score < 1 || score > 10) {
      throw new BadRequestException('Điểm số phải nằm trong khoảng từ 1 đến 10');
    }

    const userIdObj = new Types.ObjectId(userId);

    // Upsert rating (update existing, or create new if not exists)
    await this.ratingModel.findOneAndUpdate(
      { movieSlug, userId: userIdObj },
      { score },
      { upsert: true, new: true },
    );

    return this.getMovieRating(movieSlug, userId);
  }

  // ─── ADMIN ENDPOINTS ───
  async getAdminRatingsStats() {
    return this.ratingModel.aggregate([
      {
        $group: {
          _id: '$movieSlug',
          averageScore: { $avg: '$score' },
          totalRatings: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          movieSlug: '$_id',
          averageScore: { $round: ['$averageScore', 1] },
          totalRatings: 1,
        },
      },
      {
        $sort: { totalRatings: -1, averageScore: -1 },
      },
    ]).exec();
  }

  async deleteMovieRatings(movieSlug: string) {
    const result = await this.ratingModel.deleteMany({ movieSlug }).exec();
    return { success: true, deletedCount: result.deletedCount };
  }
}

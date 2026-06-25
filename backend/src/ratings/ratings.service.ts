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
}

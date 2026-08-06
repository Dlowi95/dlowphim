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
    const slug = this.normalizeSlug(movieSlug);
    const [summary, userRatingDocument] = await Promise.all([
      this.ratingModel.aggregate([
        { $match: { movieSlug: slug } },
        { $group: { _id: null, average: { $avg: '$score' }, count: { $sum: 1 } } },
      ]).exec(),
      currentUserId && Types.ObjectId.isValid(currentUserId)
        ? this.ratingModel.findOne({ movieSlug: slug, userId: new Types.ObjectId(currentUserId) }, 'score').lean().exec()
        : Promise.resolve(null),
    ]);

    return {
      average: summary[0]?.average ? Number(summary[0].average.toFixed(1)) : 0,
      count: summary[0]?.count || 0,
      userRating: userRatingDocument?.score ?? null,
    };
  }

  async rateMovie(movieSlug: string, userId: string, score: number) {
    const normalizedScore = Number(score);
    const slug = this.normalizeSlug(movieSlug);
    if (!Number.isInteger(normalizedScore) || normalizedScore < 1 || normalizedScore > 10) {
      throw new BadRequestException('Điểm số phải nằm trong khoảng từ 1 đến 10');
    }

    const userIdObj = new Types.ObjectId(userId);

    // Upsert rating (update existing, or create new if not exists)
    await this.ratingModel.findOneAndUpdate(
      { movieSlug: slug, userId: userIdObj },
      { score: normalizedScore },
      { upsert: true, returnDocument: 'after' },
    );

    return this.getMovieRating(slug, userId);
  }

  // ─── ADMIN ENDPOINTS ───
  async getAdminRatingsStats(search = '', page = 1, limit = 6) {
    const safePage = Math.max(1, Math.floor(Number(page) || 1));
    const safeLimit = Math.min(50, Math.max(1, Math.floor(Number(limit) || 6)));
    const term = String(search || '').trim().slice(0, 100);
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pipeline: any[] = [
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
    ];
    if (term) pipeline.push({ $match: { movieSlug: { $regex: escaped, $options: 'i' } } });
    pipeline.push({ $sort: { totalRatings: -1, averageScore: -1 } });
    pipeline.push({
      $facet: {
        items: [{ $skip: (safePage - 1) * safeLimit }, { $limit: safeLimit }],
        metadata: [{ $count: 'totalItems' }],
      },
    });
    const [result] = await this.ratingModel.aggregate(pipeline).exec();
    const totalItems = result?.metadata?.[0]?.totalItems || 0;
    return {
      items: result?.items || [],
      pagination: {
        page: safePage,
        limit: safeLimit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / safeLimit)),
      },
    };
  }

  async deleteMovieRatings(movieSlug: string) {
    const result = await this.ratingModel.deleteMany({ movieSlug: this.normalizeSlug(movieSlug) }).exec();
    return { success: true, deletedCount: result.deletedCount };
  }

  private normalizeSlug(value: unknown) {
    const slug = String(value || '').trim().toLowerCase();
    if (!slug || slug.length > 180 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new BadRequestException('Slug phim không hợp lệ');
    }
    return slug;
  }
}

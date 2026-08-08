import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AdminAuditLog, AdminAuditLogDocument } from './schemas/admin-audit-log.schema';

@Injectable()
export class AdminAuditService {
  constructor(@InjectModel(AdminAuditLog.name) private readonly auditModel: Model<AdminAuditLogDocument>) {}

  async record(entry: Omit<AdminAuditLog, 'expiresAt'>) {
    try {
      await this.auditModel.create({
        ...entry,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
    } catch (error) {
      // Audit logging must never break the admin action itself.
      console.error('[AdminAudit] Could not persist audit log', error);
    }
  }

  async list(filters: { page?: string; limit?: string; search?: string; status?: string; action?: string }) {
    const page = Math.max(1, Number.parseInt(filters.page || '1', 10) || 1);
    const limit = Math.min(50, Math.max(10, Number.parseInt(filters.limit || '20', 10) || 20));
    const query: Record<string, unknown> = {};
    if (filters.status === 'success' || filters.status === 'failed') query.status = filters.status;
    if (filters.action) query.action = String(filters.action).slice(0, 120);
    const search = String(filters.search || '').trim().slice(0, 100);
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { actorEmail: { $regex: escaped, $options: 'i' } },
        { actorName: { $regex: escaped, $options: 'i' } },
        { path: { $regex: escaped, $options: 'i' } },
      ];
    }
    const [items, totalItems] = await Promise.all([
      this.auditModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.auditModel.countDocuments(query),
    ]);
    return { items, pagination: { page, limit, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / limit)) } };
  }
}

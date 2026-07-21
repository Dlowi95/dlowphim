import {
  Controller, Get, Post, Put, Delete, Patch,
  Body, Param, UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { FeaturedRidersService } from './featured-riders.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

// Upload thư mục: backend/uploads/riders/
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'riders');

@Controller('featured-riders')
export class FeaturedRidersController {
  constructor(private readonly service: FeaturedRidersService) {}

  // ─── PUBLIC ───
  @Get()
  async getActive() {
    return this.service.findAllActive();
  }

  // ─── ADMIN (bảo vệ bằng auth + role) ───
  @Get('admin')
  @UseGuards(AuthGuard, RolesGuard)
  async getAll() {
    return this.service.findAll();
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  async create(@Body() dto: any) {
    return this.service.create(dto);
  }

  @Put(':id')
  @UseGuards(AuthGuard, RolesGuard)
  async update(@Param('id') id: string, @Body() dto: any) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  async delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  // Drag & Drop reorder
  @Patch('reorder')
  @UseGuards(AuthGuard, RolesGuard)
  async reorder(@Body() body: { orders: { id: string; order: number }[] }) {
    return this.service.reorder(body.orders);
  }

  // Upload ảnh (poster hoặc banner) trả về URL
  @Post('upload')
  @UseGuards(AuthGuard, RolesGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          if (!fs.existsSync(UPLOAD_DIR)) {
            fs.mkdirSync(UPLOAD_DIR, { recursive: true });
          }
          cb(null, UPLOAD_DIR);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = path.extname(file.originalname);
          cb(null, `rider-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowed = /\.(jpg|jpeg|png|gif|webp|avif)$/i;
        if (allowed.test(file.originalname)) {
          cb(null, true);
        } else {
          cb(new Error('Chỉ chấp nhận file ảnh (jpg, png, gif, webp)'), false);
        }
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async uploadImage(@UploadedFile() file: any) {
    if (!file) throw new Error('Không có file được upload');
    // Trả về URL public để dùng trong frontend
    const url = `/uploads/riders/${file.filename}`;
    return { url };
  }
}

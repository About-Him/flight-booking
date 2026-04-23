import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Airport } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaReadService } from '../prisma/prisma-read.service';

const AIRPORTS_CACHE_TTL_SEC = 300; // 5 minutes

@Injectable()
export class AirportsService {
  private redis?: Redis;

  constructor(
    private readonly prismaRead: PrismaReadService,
    private readonly configService: ConfigService,
  ) {}

  private getRedis() {
    if (!this.redis) {
      this.redis = new Redis(this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379');
    }
    return this.redis;
  }

  private listCacheKey(take: number) {
    return `airports:list:${take}`;
  }

  private searchCacheKey(q: string) {
    return `airports:search:${q.toLowerCase()}`;
  }

  async list(limit = 100) {
    const take = Math.min(Math.max(limit, 1), 500);
    const key = this.listCacheKey(take);

    try {
      const cached = await this.getRedis().get(key);
      if (cached) {
        return JSON.parse(cached) as Airport[];
      }
    } catch {
      // Redis unavailable — load from DB
    }

    const rows = await this.prismaRead.airport.findMany({
      orderBy: [{ city: 'asc' }, { iataCode: 'asc' }],
      take,
    });

    try {
      await this.getRedis().set(key, JSON.stringify(rows), 'EX', AIRPORTS_CACHE_TTL_SEC);
    } catch {
      // ignore cache write failures
    }

    return rows;
  }

  async search(query: string) {
    if (!query || query.trim().length < 1) {
      return [];
    }

    const q = query.trim();
    const key = this.searchCacheKey(q);

    try {
      const cached = await this.getRedis().get(key);
      if (cached) {
        return JSON.parse(cached) as Airport[];
      }
    } catch {
      // TODO: Redis unavailable — load from DB
    }

    const rows = await this.prismaRead.airport.findMany({
      where: {
        OR: [
          { iataCode: { startsWith: q.toUpperCase() } },
          { city: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ city: 'asc' }],
      take: 10,
    });

    try {
      await this.getRedis().set(key, JSON.stringify(rows), 'EX', AIRPORTS_CACHE_TTL_SEC);
    } catch {
      // ignore cache write failures
    }

    return rows;
  }
}

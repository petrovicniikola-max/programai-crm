import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogParams {
  tenantId?: string | null;
  actorUserId?: string;
  actingAsUserId?: string;
  isImpersonation?: boolean;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: object;
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: AuditLogParams) {
    return this.prisma.auditLog.create({
      data: {
        tenantId: params.tenantId ?? undefined,
        actorUserId: params.actorUserId,
        actingAsUserId: params.actingAsUserId,
        isImpersonation: params.isImpersonation ?? false,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata as object | undefined,
        ip: params.ip,
        userAgent: params.userAgent,
        requestId: params.requestId,
      },
    });
  }

  async findAll(tenantId: string | null, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: tenantId != null ? { tenantId } : {},
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }
}

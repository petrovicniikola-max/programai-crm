import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../permissions/permissions.service';
import { CreateSoldDeviceDto } from './dto/create-sold-device.dto';

@Injectable()
export class SoldDevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async list(tenantId: string, userId: string, role: string, roleId?: string | null) {
    const allowed = await this.can(userId, role, roleId, 'view');
    if (!allowed) throw new ForbiddenException('Nema pristupa prodati uređajima');

    const rows = await this.prisma.soldDevice.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { displayName: true, email: true } } },
    });

    return rows.map((row) => ({
      id: row.id,
      serialNo: row.serialNo,
      name: row.name,
      licenceName: row.licenceName,
      months: row.months,
      description: row.description,
      createdAt: row.createdAt.toISOString(),
      enteredBy: row.user.displayName?.trim() || row.user.email,
    }));
  }

  async create(
    tenantId: string,
    userId: string,
    role: string,
    roleId: string | null | undefined,
    dto: CreateSoldDeviceDto,
  ) {
    const allowed = await this.can(userId, role, roleId, 'edit');
    if (!allowed) throw new ForbiddenException('Nemate pravo da unosite prodate uređaje');

    const serialNo = dto.serialNo.trim();
    const licenceName = dto.licenceName.trim();
    const name = dto.name?.trim() || null;
    const description = dto.description?.trim() || null;
    if (!serialNo) throw new BadRequestException('Unesite SN');
    if (!licenceName) throw new BadRequestException('Unesite licencu');

    const existing = await this.prisma.soldDevice.findFirst({
      where: { tenantId, serialNo },
      select: { id: true },
    });
    if (existing) throw new BadRequestException('Uređaj sa ovim SN već postoji.');

    const row = await this.prisma.soldDevice.create({
      data: {
        tenantId,
        userId,
        serialNo,
        name,
        licenceName,
        months: dto.months,
        description,
      },
      include: { user: { select: { displayName: true, email: true } } },
    });

    return {
      id: row.id,
      serialNo: row.serialNo,
      name: row.name,
      licenceName: row.licenceName,
      months: row.months,
      description: row.description,
      createdAt: row.createdAt.toISOString(),
      enteredBy: row.user.displayName?.trim() || row.user.email,
    };
  }

  private can(
    userId: string,
    role: string,
    roleId: string | null | undefined,
    action: 'view' | 'edit',
  ) {
    return this.permissions.userHasPermission(userId, role, roleId, 'soldDevices', action);
  }
}

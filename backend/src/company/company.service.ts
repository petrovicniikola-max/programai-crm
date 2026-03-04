import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateCompanyDto) {
    const count = await this.prisma.company.count({ where: { tenantId } });
    const key = `C-${String(count + 1).padStart(6, '0')}`;
    return this.prisma.company.create({
      data: {
        tenantId,
        key,
        name: dto.name,
        city: dto.city,
        postalCode: dto.postalCode,
        address: dto.address,
        pib: dto.pib,
        mb: dto.mb,
      },
    });
  }

  findAll(tenantId: string) {
    return this.prisma.company.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const company = await this.prisma.company.findFirst({
      where: { id, tenantId },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async update(tenantId: string, id: string, dto: UpdateCompanyDto) {
    await this.findOne(tenantId, id);
    return this.prisma.company.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.postalCode !== undefined && { postalCode: dto.postalCode }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.pib !== undefined && { pib: dto.pib }),
        ...(dto.mb !== undefined && { mb: dto.mb }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.company.delete({ where: { id } });
  }

  async findDevices(tenantId: string, companyId: string) {
    await this.findOne(tenantId, companyId);
    return this.prisma.device.findMany({
      where: { tenantId, companyId },
      include: { company: true },
      orderBy: { updatedAt: 'desc' },
    });
  }
}

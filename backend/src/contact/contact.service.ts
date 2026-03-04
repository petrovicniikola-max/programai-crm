import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalisePhone } from '../common/util/phone.util';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateContactDto) {
    if (dto.phones?.length) {
      for (const raw of dto.phones) {
        const phoneNormalised = normalisePhone(raw);
        if (phoneNormalised) {
          const existing = await this.prisma.contactPhone.findUnique({
            where: { tenantId_phoneNormalised: { tenantId, phoneNormalised } },
          });
          if (existing) throw new ConflictException(`Phone already in use: ${raw}`);
        }
      }
    }
    return this.prisma.contact.create({
      data: {
        tenantId,
        name: dto.name,
        companyId: dto.companyId || undefined,
        phones: dto.phones?.length
          ? {
              create: dto.phones
                .map((raw) => ({ raw, phoneNormalised: normalisePhone(raw) }))
                .filter((p) => p.phoneNormalised)
                .map(({ raw, phoneNormalised }, index) => ({
                  phoneRaw: raw,
                  phoneNormalised,
                  isPrimary: index === 0,
                  tenantId,
                })),
            }
          : undefined,
      },
      include: { phones: true, company: true },
    });
  }

  findAll(tenantId: string) {
    return this.prisma.contact.findMany({
      where: { tenantId },
      include: { phones: true, company: true },
      orderBy: { name: 'asc' },
    });
  }

  async searchByPhone(tenantId: string, phone: string) {
    const phoneNormalised = normalisePhone(phone);
    if (!phoneNormalised) return [];
    return this.prisma.contact.findMany({
      where: {
        tenantId,
        phones: { some: { phoneNormalised } },
      },
      include: { phones: true, company: true },
    });
  }

  async findOne(tenantId: string, id: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, tenantId },
      include: { phones: true, company: true },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async update(tenantId: string, id: string, dto: UpdateContactDto) {
    await this.findOne(tenantId, id);
    if (dto.phones) {
      await this.prisma.contactPhone.deleteMany({ where: { contactId: id } });
      const phoneNormalisedList = dto.phones.map(normalisePhone).filter(Boolean);
      for (const phoneNormalised of phoneNormalisedList) {
        const existing = await this.prisma.contactPhone.findUnique({
          where: { tenantId_phoneNormalised: { tenantId, phoneNormalised } },
        });
        if (existing && existing.contactId !== id)
          throw new ConflictException(`Phone already in use`);
      }
    }
    return this.prisma.contact.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.companyId !== undefined && { companyId: dto.companyId || null }),
        ...(dto.phones && {
          phones: {
            create: dto.phones
              .map((raw) => ({ raw, phoneNormalised: normalisePhone(raw) }))
              .filter((p) => p.phoneNormalised)
              .map(({ raw, phoneNormalised }, index) => ({
                phoneRaw: raw,
                phoneNormalised,
                isPrimary: index === 0,
                tenantId,
              })),
          },
        }),
      },
      include: { phones: true, company: true },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.contact.delete({ where: { id } });
  }
}

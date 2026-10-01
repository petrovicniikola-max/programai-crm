import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../permissions/permissions.service';
import { CreateTravelOrderDto } from './dto/create-travel-order.dto';
import { TravelOrderDocumentService } from './travel-order-document.service';
import { TravelOrderEmailService } from './travel-order-email.service';
import { addDaysIso, amountInWords, inclusiveDays, todayIso } from './travel-order.util';

const ORIGIN = 'Beograd';
const TRANSPORT = 'Vozilo Estuara';
const DEPART = '08:00';
const RETURN_TIME = '20:00';

function isoDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!m) throw new BadRequestException('Datum mora biti u obliku GGGG-MM-DD');
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function asDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

@Injectable()
export class TravelOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly documents: TravelOrderDocumentService,
    private readonly email: TravelOrderEmailService,
  ) {}

  async list(tenantId: string, userId: string, role: string, roleId?: string | null) {
    const seeAll = await this.can(userId, role, roleId, 'travelOrders.all', 'view');
    const seeOwn = await this.can(userId, role, roleId, 'travelOrders', 'view');
    if (!seeAll && !seeOwn) throw new ForbiddenException('Nema pristupa putnim nalozima');

    const rows = await this.prisma.travelOrder.findMany({
      where: { tenantId, ...(seeAll ? {} : { userId }) },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { displayName: true, email: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      number: row.number,
      employeeName: row.employeeName,
      userEmail: row.user.email,
      destination: row.destination,
      hostName: row.hostName,
      task: row.task,
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate.toISOString().slice(0, 10),
      dayCount: row.dayCount,
      dailyRate: row.dailyRate,
      totalAmount: row.totalAmount,
      totalInWords: row.totalInWords,
      accountingEmail: row.accountingEmail,
      sentToUser: row.sentToUser,
      sentToAccounting: row.sentToAccounting,
      createdAt: row.createdAt.toISOString(),
      own: row.userId === userId,
    }));
  }

  async create(
    tenantId: string,
    userId: string,
    role: string,
    roleId: string | null | undefined,
    dto: CreateTravelOrderDto,
  ) {
    const allowed = await this.can(userId, role, roleId, 'travelOrders', 'edit');
    if (!allowed) throw new ForbiddenException('Nemate pravo da kreirate putni nalog');

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { displayName: true, email: true, jobTitle: true },
    });
    if (!user) throw new NotFoundException('Korisnik nije pronađen');

    const startDate = isoDate(dto.startDate);
    const endDate = isoDate(dto.endDate);
    const dayCount = inclusiveDays(startDate, endDate);
    if (dayCount < 1) throw new BadRequestException('Datum povratka je pre datuma polaska');
    if (dayCount > 60) throw new BadRequestException('Put ne može biti duži od 60 dana');

    const jobTitle = (dto.jobTitle?.trim() || user.jobTitle?.trim() || '').trim();
    if (!jobTitle) throw new BadRequestException('Unesite radno mesto');

    const decisionDate = isoDate(dto.decisionDate?.trim() || todayIso());
    const settlementDate = addDaysIso(endDate, 1);
    const totalAmount = dayCount * dto.dailyRate;
    const totalInWords = amountInWords(totalAmount);
    const employeeName = user.displayName?.trim() || user.email;
    const accountingEmail = dto.accountingEmail?.trim() || null;
    const year = startDate.slice(0, 4);

    const order = await this.prisma.$transaction(async (tx) => {
      const count = await tx.travelOrder.count({
        where: { tenantId, number: { startsWith: `PN-${year}-` } },
      });
      const number = `PN-${year}-${String(count + 1).padStart(3, '0')}`;
      return tx.travelOrder.create({
        data: {
          tenantId,
          userId,
          number,
          employeeName,
          decisionName: dto.decisionName.trim(),
          jobTitle,
          origin: ORIGIN,
          destination: dto.destination.trim(),
          hostName: dto.hostName.trim(),
          task: dto.task.trim(),
          transport: TRANSPORT,
          startDate: asDate(startDate),
          endDate: asDate(endDate),
          departTime: DEPART,
          returnTime: RETURN_TIME,
          dayCount,
          dailyRate: dto.dailyRate,
          totalAmount,
          totalInWords,
          decisionDate: asDate(decisionDate),
          settlementDate: asDate(settlementDate),
          accountingEmail,
        },
      });
    });

    const docInput = {
      id: order.id,
      number: order.number,
      employeeName,
      decisionName: order.decisionName,
      jobTitle,
      origin: ORIGIN,
      destination: order.destination,
      hostName: order.hostName,
      task: order.task,
      transport: TRANSPORT,
      startDate,
      endDate,
      departTime: DEPART,
      returnTime: RETURN_TIME,
      dayCount,
      dailyRate: dto.dailyRate,
      totalAmount,
      totalInWords,
      decisionDate,
      settlementDate,
    };
    const files = await this.documents.write(docInput);
    const nalog = await this.documents.read(order.id, files.nalogName);
    const odluka = await this.documents.read(order.id, files.odlukaName);
    const mail = await this.email.send(tenantId, {
      ...docInput,
      userEmail: user.email,
      accountingEmail,
      nalog,
      odluka,
      nalogName: files.nalogName,
      odlukaName: files.odlukaName,
    });
    await this.prisma.travelOrder.update({
      where: { id: order.id },
      data: { sentToUser: mail.userSent, sentToAccounting: mail.accountingSent },
    });

    return {
      id: order.id,
      number: order.number,
      dayCount,
      dailyRate: dto.dailyRate,
      totalAmount,
      totalInWords,
      email: mail,
    };
  }

  async file(
    tenantId: string,
    userId: string,
    role: string,
    roleId: string | null | undefined,
    id: string,
    kind: 'nalog' | 'odluka',
  ): Promise<{ buffer: Buffer; filename: string }> {
    const order = await this.prisma.travelOrder.findFirst({ where: { id, tenantId } });
    if (!order) throw new NotFoundException('Putni nalog nije pronađen');
    const seeAll = await this.can(userId, role, roleId, 'travelOrders.all', 'view');
    const seeOwn = await this.can(userId, role, roleId, 'travelOrders', 'view');
    if (!seeAll && !(seeOwn && order.userId === userId)) {
      throw new ForbiddenException('Nema pristupa ovom nalogu');
    }
    const names = this.documents.filenames(order.number);
    const filename = kind === 'nalog' ? names.nalogName : names.odlukaName;
    const buffer = await this.documents.read(order.id, filename);
    return { buffer, filename };
  }

  private can(
    userId: string,
    role: string,
    roleId: string | null | undefined,
    resource: string,
    action: 'view' | 'edit',
  ) {
    return this.permissions.userHasPermission(userId, role, roleId, resource, action);
  }
}

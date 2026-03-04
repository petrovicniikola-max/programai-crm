import { Test, TestingModule } from '@nestjs/testing';
import { TicketService } from './ticket.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TicketService', () => {
  let service: TicketService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketService,
        {
          provide: PrismaService,
          useValue: {
            ticket: { create: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
            contactPhone: { findUnique: jest.fn(), create: jest.fn() },
            contact: { create: jest.fn() },
            company: { findUnique: jest.fn() },
            $transaction: jest.fn((fn) => fn({})),
          },
        },
      ],
    }).compile();

    service = module.get<TicketService>(TicketService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('quickCall', () => {
    it('should accept QuickCallDto and return ticket, contact, company shape', async () => {
      const tenantId = 'tenant-1';
      const dto = { phone: '+38165483215', contactName: 'Petar Perić' };
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
        const tx = {
          contactPhone: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({}),
          },
          contact: { create: jest.fn().mockResolvedValue({ id: 'c1', name: 'Petar Perić', companyId: null }) },
          ticket: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue({ id: 't1', key: 'TKT-0001', title: 'Poziv: Petar Perić', type: 'CALL', status: 'OPEN' }),
          },
          company: { findUnique: jest.fn().mockResolvedValue(null) },
        };
        return fn(tx);
      });
      const result = await service.quickCall(tenantId, dto);
      expect(result).toHaveProperty('ticket');
      expect(result).toHaveProperty('contact');
      expect(result).toHaveProperty('company');
      expect(result.ticket.type).toBe('CALL');
      expect(result.ticket.status).toBe('OPEN');
    });
  });
});

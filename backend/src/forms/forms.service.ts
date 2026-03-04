import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { FormStatus, QuestionType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { FormsListQueryDto } from './dto/forms-list-query.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { ReorderQuestionsDto } from './dto/reorder-questions.dto';
import { CreateOptionDto } from './dto/create-option.dto';
import { UpdateOptionDto } from './dto/update-option.dto';
import { SubmitFormDto } from './dto/submit-form.dto';
import { SubmissionsQueryDto } from './dto/submissions-query.dto';
import { PivotQueryDto } from './dto/pivot-query.dto';

const CHOICE_TYPES: QuestionType[] = ['MULTIPLE_CHOICE', 'CHECKBOXES', 'DROPDOWN'];

@Injectable()
export class FormsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getFormForTenant(tenantId: string, formId: string) {
    const form = await this.prisma.form.findFirst({
      where: { id: formId, tenantId },
      include: {
        questions: {
          where: { isArchived: false },
          orderBy: { orderNo: 'asc' },
          include: { options: { orderBy: { orderNo: 'asc' } } },
        },
      },
    });
    if (!form) throw new NotFoundException('Form not found');
    return form;
  }

  async create(tenantId: string, createdByUserId: string, dto: CreateFormDto) {
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.form.count({ where: { tenantId } });
      const key = `F-${String(count + 1).padStart(6, '0')}`;
      const form = await tx.form.create({
        data: {
          tenantId,
          key,
          title: dto.title,
          description: dto.description ?? null,
          createdByUserId,
        },
      });
      await tx.formQuestion.create({
        data: {
          tenantId,
          formId: form.id,
          type: 'DATE',
          title: 'Datum',
          isRequired: true,
          orderNo: 0,
        },
      });
      return tx.form.findUniqueOrThrow({
        where: { id: form.id },
        include: {
          questions: {
            where: { isArchived: false },
            orderBy: { orderNo: 'asc' },
            include: { options: { orderBy: { orderNo: 'asc' } } },
          },
        },
      });
    });
  }

  async findAll(tenantId: string, query: FormsListQueryDto) {
    const { status, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const where: { tenantId: string; status?: FormStatus; title?: { contains: string; mode: 'insensitive' } } = {
      tenantId,
    };
    if (status) where.status = status;
    if (search?.trim()) where.title = { contains: search.trim(), mode: 'insensitive' };

    const [items, total] = await Promise.all([
      this.prisma.form.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.form.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const form = await this.prisma.form.findFirst({
      where: { id, tenantId },
      include: {
        questions: {
          where: { isArchived: false },
          orderBy: { orderNo: 'asc' },
          include: { options: { orderBy: { orderNo: 'asc' } } },
        },
      },
    });
    if (!form) throw new NotFoundException('Form not found');
    return form;
  }

  async update(tenantId: string, id: string, dto: UpdateFormDto) {
    await this.getFormForTenant(tenantId, id);
    return this.prisma.form.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async publish(tenantId: string, id: string) {
    await this.getFormForTenant(tenantId, id);
    return this.prisma.form.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
  }

  async unpublish(tenantId: string, id: string) {
    await this.getFormForTenant(tenantId, id);
    return this.prisma.form.update({
      where: { id },
      data: { status: 'DRAFT', publishedAt: null },
    });
  }

  async clone(tenantId: string, id: string, userId: string) {
    const form = await this.getFormForTenant(tenantId, id);
    const questions = form.questions;
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.form.count({ where: { tenantId } });
      const key = `F-${String(count + 1).padStart(6, '0')}`;
      const newForm = await tx.form.create({
        data: {
          tenantId,
          key,
          title: `${form.title} (Copy)`,
          description: form.description,
          status: 'DRAFT',
          isActive: true,
          createdByUserId: userId,
          publishedAt: null,
          publicSlug: null,
        },
      });
      for (const q of questions) {
        const newQ = await tx.formQuestion.create({
          data: {
            tenantId,
            formId: newForm.id,
            type: q.type,
            title: q.title,
            helpText: q.helpText,
            isRequired: q.isRequired,
            orderNo: q.orderNo,
            settings: (q.settings ?? undefined) as Prisma.InputJsonValue | undefined,
          },
        });
        for (const opt of q.options) {
          await tx.formQuestionOption.create({
            data: {
              tenantId,
              questionId: newQ.id,
              label: opt.label,
              value: opt.value,
              orderNo: opt.orderNo,
            },
          });
        }
      }
      return this.prisma.form.findUniqueOrThrow({
        where: { id: newForm.id },
        include: {
          questions: {
            orderBy: { orderNo: 'asc' },
            include: { options: { orderBy: { orderNo: 'asc' } } },
          },
        },
      });
    });
  }

  async createQuestion(tenantId: string, formId: string, dto: CreateQuestionDto) {
    await this.getFormForTenant(tenantId, formId);
    const needsOptions = CHOICE_TYPES.includes(dto.type);
    const orderNo =
      dto.orderNo ??
      (await this.prisma.formQuestion.count({ where: { formId, tenantId } }));

    return this.prisma.$transaction(async (tx) => {
      const q = await tx.formQuestion.create({
        data: {
          tenantId,
          formId,
          type: dto.type,
          title: dto.title,
          helpText: dto.helpText ?? null,
          isRequired: dto.isRequired ?? false,
          orderNo,
          settings: (dto.settings ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
      if (needsOptions && dto.options?.length) {
        for (let i = 0; i < dto.options.length; i++) {
          const o = dto.options[i];
          await tx.formQuestionOption.create({
            data: {
              tenantId,
              questionId: q.id,
              label: o.label,
              value: o.value ?? o.label,
              orderNo: o.orderNo ?? i,
            },
          });
        }
      }
      return tx.formQuestion.findUniqueOrThrow({
        where: { id: q.id },
        include: { options: { orderBy: { orderNo: 'asc' } } },
      });
    });
  }

  async updateQuestion(
    tenantId: string,
    formId: string,
    questionId: string,
    dto: UpdateQuestionDto,
  ) {
    const form = await this.getFormForTenant(tenantId, formId);
    const q = form.questions.find((x) => x.id === questionId);
    if (!q) throw new NotFoundException('Question not found');

    return this.prisma.formQuestion.update({
      where: { id: questionId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.helpText !== undefined && { helpText: dto.helpText }),
        ...(dto.isRequired !== undefined && { isRequired: dto.isRequired }),
        ...(dto.orderNo !== undefined && { orderNo: dto.orderNo }),
        ...(dto.settings !== undefined && { settings: dto.settings as Prisma.InputJsonValue }),
        ...(dto.isArchived !== undefined && { isArchived: dto.isArchived }),
      },
      include: { options: { orderBy: { orderNo: 'asc' } } },
    });
  }

  async reorderQuestions(tenantId: string, formId: string, dto: ReorderQuestionsDto) {
    await this.getFormForTenant(tenantId, formId);
    await this.prisma.$transaction(
      dto.order.map((item) =>
        this.prisma.formQuestion.updateMany({
          where: { id: item.questionId, formId, tenantId },
          data: { orderNo: item.orderNo },
        }),
      ),
    );
    return this.findOne(tenantId, formId);
  }

  async archiveQuestion(tenantId: string, formId: string, questionId: string) {
    return this.updateQuestion(tenantId, formId, questionId, { isArchived: true });
  }

  async createOption(
    tenantId: string,
    formId: string,
    questionId: string,
    dto: CreateOptionDto,
  ) {
    const form = await this.getFormForTenant(tenantId, formId);
    const q = form.questions.find((x) => x.id === questionId);
    if (!q) throw new NotFoundException('Question not found');

    const maxOrder = q.options.length ? Math.max(...q.options.map((o) => o.orderNo)) : -1;
    return this.prisma.formQuestionOption.create({
      data: {
        tenantId,
        questionId,
        label: dto.label,
        value: dto.value ?? dto.label,
        orderNo: dto.orderNo ?? maxOrder + 1,
      },
    });
  }

  async updateOption(
    tenantId: string,
    formId: string,
    questionId: string,
    optionId: string,
    dto: UpdateOptionDto,
  ) {
    const form = await this.getFormForTenant(tenantId, formId);
    const q = form.questions.find((x) => x.id === questionId);
    if (!q) throw new NotFoundException('Question not found');
    const opt = await this.prisma.formQuestionOption.findFirst({
      where: { id: optionId, questionId, tenantId },
    });
    if (!opt) throw new NotFoundException('Option not found');

    return this.prisma.formQuestionOption.update({
      where: { id: optionId },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.value !== undefined && { value: dto.value }),
        ...(dto.orderNo !== undefined && { orderNo: dto.orderNo }),
      },
    });
  }

  async deleteOption(
    tenantId: string,
    formId: string,
    questionId: string,
    optionId: string,
  ) {
    const form = await this.getFormForTenant(tenantId, formId);
    const q = form.questions.find((x) => x.id === questionId);
    if (!q) throw new NotFoundException('Question not found');
    const opt = await this.prisma.formQuestionOption.findFirst({
      where: { id: optionId, questionId, tenantId },
    });
    if (!opt) throw new NotFoundException('Option not found');

    await this.prisma.formQuestionOption.delete({ where: { id: optionId } });
    return { deleted: true };
  }

  async submit(
    tenantId: string,
    formId: string,
    submittedByUserId: string | undefined,
    dto: SubmitFormDto,
  ) {
    const form = await this.getFormForTenant(tenantId, formId);
    const questionIds = new Set(form.questions.map((q) => q.id));
    const requiredIds = new Set(form.questions.filter((q) => q.isRequired).map((q) => q.id));

    for (const a of dto.answers) {
      if (!questionIds.has(a.questionId)) {
        throw new BadRequestException(`Question ${a.questionId} does not belong to this form`);
      }
    }
    for (const rid of requiredIds) {
      const ans = dto.answers.find((a) => a.questionId === rid);
      const hasValue =
        ans &&
        (ans.valueText !== undefined ||
          ans.valueNumber !== undefined ||
          ans.valueDate !== undefined ||
          (ans.valueJson !== undefined && ans.valueJson !== null));
      if (!hasValue || (typeof ans?.valueText === 'string' && !ans.valueText.trim())) {
        const q = form.questions.find((x) => x.id === rid);
        throw new BadRequestException(`Required question "${q?.title ?? rid}" has no answer`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const count = await tx.formSubmission.count({ where: { tenantId } });
      const key = `Ta-${String(count + 1).padStart(6, '0')}`;
      const sub = await tx.formSubmission.create({
        data: {
          tenantId,
          key,
          formId,
          submittedByUserId: submittedByUserId ?? null,
          source: 'SALES',
          metadata: (dto.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
      for (const a of dto.answers) {
        await tx.formAnswer.create({
          data: {
            tenantId,
            submissionId: sub.id,
            questionId: a.questionId,
            valueText: a.valueText ?? null,
            valueNumber: a.valueNumber ?? null,
            valueDate: a.valueDate ? new Date(a.valueDate) : null,
            valueJson: a.valueJson ?? undefined,
          },
        });
      }
      return tx.formSubmission.findUniqueOrThrow({
        where: { id: sub.id },
        include: { answers: true },
      });
    });
  }

  async getSubmissions(tenantId: string, formId: string, query: SubmissionsQueryDto) {
    await this.getFormForTenant(tenantId, formId);
    const { page = 1, limit = 20, from, to } = query;
    const skip = (page - 1) * limit;
    const where: { tenantId: string; formId: string; createdAt?: { gte?: Date; lte?: Date } } = {
      tenantId,
      formId,
    };
    if (from) where.createdAt = { ...where.createdAt, gte: new Date(from) };
    if (to) where.createdAt = { ...where.createdAt, lte: new Date(to) };

    const [items, total] = await Promise.all([
      this.prisma.formSubmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.formSubmission.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  private answerToString(a: {
    valueText: string | null;
    valueNumber: number | null;
    valueDate: Date | null;
    valueJson: unknown;
  }): string {
    if (a.valueText != null && a.valueText !== '') return a.valueText;
    if (a.valueNumber != null) return String(a.valueNumber);
    if (a.valueDate) return a.valueDate.toISOString();
    if (a.valueJson != null) {
      if (Array.isArray(a.valueJson)) return (a.valueJson as string[]).join(', ');
      return JSON.stringify(a.valueJson);
    }
    return '';
  }

  async getPivot(tenantId: string, formId: string, query: PivotQueryDto) {
    const form = await this.getFormForTenant(tenantId, formId);
    const { limit = 20, offset = 0, sort = 'desc' } = query;

    const submissions = await this.prisma.formSubmission.findMany({
      where: { tenantId, formId },
      orderBy: { createdAt: sort },
      skip: offset,
      take: limit,
      include: { answers: true },
    });

    const questions = form.questions;
    const subById = new Map(submissions.map((s) => [s.id, s]));
    const answerMap = new Map<string, Map<string, string>>();
    for (const sub of submissions) {
      const row = new Map<string, string>();
      for (const a of sub.answers) {
        row.set(a.questionId, this.answerToString(a));
      }
      answerMap.set(sub.id, row);
    }

    const matrix: string[][] = [];
    for (const q of questions) {
      const row: string[] = [];
      for (const sub of submissions) {
        const rowMap = answerMap.get(sub.id);
        row.push(rowMap?.get(q.id) ?? '');
      }
      matrix.push(row);
    }

    return {
      form: { id: form.id, title: form.title },
      questions: questions.map((q) => ({
        id: q.id,
        orderNo: q.orderNo,
        title: q.title,
        type: q.type,
        isRequired: q.isRequired,
      })),
      submissions: submissions.map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        submittedByUserId: s.submittedByUserId,
        metadata: s.metadata,
      })),
      matrix,
    };
  }

  async getResponsesCsv(
    tenantId: string,
    formId: string,
    query: PivotQueryDto,
  ): Promise<string> {
    const pivot = await this.getPivot(tenantId, formId, query);
    const escape = (v: string) => {
      const s = String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const headers = [
      'Question',
      ...pivot.submissions.map((s) =>
        new Date(s.createdAt).toISOString(),
      ),
    ];
    const lines: string[] = [headers.map(escape).join(',')];
    for (let r = 0; r < pivot.questions.length; r++) {
      const q = pivot.questions[r];
      const row = [q.title, ...pivot.matrix[r].map(escape)];
      lines.push(row.join(','));
    }
    return lines.join('\r\n');
  }
}
